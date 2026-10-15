import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { requestServerCheck } from './serverCheck';
import { dateKey, getDeviceId } from '../lib/ids';
import type { Order, OrderItem, PaymentMethod } from '../lib/types';

const ordersCol = collection(db, 'orders');

export interface OrderDraft {
  items: OrderItem[];
  subtotalPaise: number;
  grandTotalPaise: number;
  paymentMethod: PaymentMethod;
}

export interface SubmitResult {
  order: Order;
  provisional: boolean;
}

/**
 * Provisional, device-local order number used when offline. Monotonic per
 * device+day so two offline orders on the same tablet never collide. The
 * server (Cloud Function) reconciles it to the canonical daily sequence once
 * the write syncs; the original is kept in `provisionalNumber` so a printed
 * offline receipt can still be looked up.
 */
function provisionalNumber(dk: string, deviceId: string): string {
  const key = `aviz.offseq.${dk}`;
  let n = 1;
  try {
    n = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(n));
  } catch {
    /* localStorage unavailable; fall back to 1 */
  }
  return `OFF-${deviceId}-${dk}-${String(n).padStart(3, '0')}`;
}

export function formatOrderNumber(dk: string, seq: number): string {
  return `${dk}-${String(seq).padStart(4, '0')}`;
}

const TX_TIMEOUT_MS = 5000;

/**
 * Weak-network mode. When a sale had to fall back to a device save because the
 * server didn't answer in time, the next sales for a couple of minutes skip
 * the server round-trip and save on the device straight away, so the cashier
 * isn't kept waiting on every order. They sync (and get their final number)
 * in the background as usual.
 */
const SLOW_MODE_MS = 2 * 60_000;
let slowUntil = 0;
let slowTimer: ReturnType<typeof setTimeout> | undefined;
const slowListeners = new Set<(slow: boolean) => void>();

function setSlow(slow: boolean) {
  const was = Date.now() < slowUntil;
  slowUntil = slow ? Date.now() + SLOW_MODE_MS : 0;
  clearTimeout(slowTimer);
  if (slow) slowTimer = setTimeout(() => setSlow(false), SLOW_MODE_MS);
  if (was !== slow) slowListeners.forEach((l) => l(slow));
}

export function onSlowNetworkChange(listener: (slow: boolean) => void): () => void {
  slowListeners.add(listener);
  listener(Date.now() < slowUntil);
  return () => slowListeners.delete(listener);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function buildOrder(
  id: string,
  draft: OrderDraft,
  cashierUid: string,
  dk: string,
  orderNumber: string,
  provisional: boolean,
): Order {
  return {
    id,
    orderNumber,
    orderNumberProvisional: provisional,
    createdAt: null,
    clientCreatedAt: Date.now(),
    dateKey: dk,
    items: draft.items,
    subtotalPaise: draft.subtotalPaise,
    grandTotalPaise: draft.grandTotalPaise,
    paymentMethod: draft.paymentMethod,
    paymentStatus: 'paid',
    status: 'completed',
    cashierUid,
    deviceId: getDeviceId(),
    reprintCount: 0,
    checked: false,
    validated: false,
    validationErrors: [],
    provisionalNumber: '',
    source: provisional ? 'offline' : 'online',
    statusReason: '',
  };
}

/** The stored Firestore shape: createdAt becomes a server timestamp. */
function toStored(order: Order) {
  return { ...order, createdAt: serverTimestamp() };
}

/**
 * Persist a completed, paid order.
 *
 * - `id` is a client-generated UUID chosen ONCE when the payment screen opens
 *   and used as the Firestore doc id, so retrying never creates a second sale.
 * - ONLINE: a single transaction reads the day counter and the order doc. If
 *   the order already exists (an earlier attempt actually succeeded) it is
 *   returned as-is; otherwise the counter is incremented and the order written
 *   atomically. No duplicate orders, no orphaned order numbers.
 * - OFFLINE, ON A WEAK NETWORK, or when the transaction can't reach the server
 *   in time: a provisional number is used and the write goes into Firestore's
 *   persistent offline queue. It is NOT awaited — an offline write only
 *   resolves on reconnect — but the order is already durably stored on the
 *   device and syncs automatically.
 *
 * The provisional number is chosen before the transaction starts and stored on
 * the online order too. On a slow line the transaction can still commit after
 * we gave up waiting and printed the provisional number; the order is then
 * still found by the number on that receipt.
 */
export async function submitOrder(
  id: string,
  draft: OrderDraft,
  opts: { cashierUid: string },
): Promise<SubmitResult> {
  const dk = dateKey();
  const ref = doc(ordersCol, id);
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const fallbackNumber = provisionalNumber(dk, getDeviceId());

  if (online && Date.now() >= slowUntil) {
    try {
      const order = await withTimeout(
        runTransaction(db, async (tx) => {
          const existing = await tx.get(ref);
          if (existing.exists()) {
            return mapOrder(existing.id, existing.data());
          }
          const counterRef = doc(db, 'counters', dk);
          const counter = await tx.get(counterRef);
          const seq = (counter.exists() ? Number(counter.data().seq ?? 0) : 0) + 1;
          const fresh = buildOrder(id, draft, opts.cashierUid, dk, formatOrderNumber(dk, seq), false);
          fresh.provisionalNumber = fallbackNumber;
          tx.set(counterRef, { seq, dateKey: dk });
          tx.set(ref, toStored(fresh));
          return fresh;
        }),
        TX_TIMEOUT_MS,
      );
      setSlow(false);
      requestServerCheck(); // verify totals on the server within seconds
      return { order, provisional: false };
    } catch (err) {
      // Permission/validation errors are real failures — surface them.
      const code = (err as { code?: string }).code ?? '';
      if (code === 'permission-denied' || code === 'invalid-argument') throw err;
      // Otherwise (network unavailable / timeout) fall through to offline save.
      setSlow(true);
    }
  }

  const order = buildOrder(id, draft, opts.cashierUid, dk, fallbackNumber, true);
  // Not awaited: resolves only once the server acknowledges (on reconnect).
  setDoc(ref, toStored(order))
    .then(() => {
      // Saved to the cloud: get it checked and renumbered now rather than at
      // the next scheduled run.
      requestServerCheck();
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[Aviz POS] queued order write rejected by server', id, e);
    });
  return { order, provisional: true };
}

/**
 * True if this device still holds sales that haven't reached the cloud.
 * Firestore keeps queued writes per signed-in account, so signing out now
 * would hold them back until the same person signs in here again.
 */
export async function hasUnsyncedWrites(): Promise<boolean> {
  return Promise.race([
    waitForPendingWrites(db).then(
      () => false,
      () => false,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1500)),
  ]);
}

// ── Reads / history ──────────────────────────────────────────────────────────

export function mapOrder(id: string, data: Record<string, unknown>): Order {
  const ts = data.createdAt as Timestamp | null | undefined;
  const createdAt =
    ts && typeof (ts as Timestamp).toMillis === 'function' ? (ts as Timestamp).toMillis() : null;
  return {
    id,
    orderNumber: String(data.orderNumber ?? ''),
    orderNumberProvisional: Boolean(data.orderNumberProvisional),
    createdAt,
    clientCreatedAt: Number(data.clientCreatedAt ?? 0),
    dateKey: String(data.dateKey ?? ''),
    items: Array.isArray(data.items) ? (data.items as OrderItem[]) : [],
    subtotalPaise: Number(data.subtotalPaise ?? 0),
    grandTotalPaise: Number(data.grandTotalPaise ?? 0),
    paymentMethod: data.paymentMethod === 'upi' ? 'upi' : 'cash',
    paymentStatus: data.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    status:
      data.status === 'cancelled' || data.status === 'refunded' ? data.status : 'completed',
    cashierUid: String(data.cashierUid ?? ''),
    deviceId: String(data.deviceId ?? ''),
    reprintCount: Number(data.reprintCount ?? 0),
    checked: Boolean(data.checked),
    validated: Boolean(data.validated),
    validationErrors: Array.isArray(data.validationErrors)
      ? (data.validationErrors as string[])
      : [],
    provisionalNumber: String(data.provisionalNumber ?? ''),
    source: data.source === 'offline' ? 'offline' : 'online',
    statusReason: String(data.statusReason ?? ''),
    ...(data.lastPaymentAuditId ? { paymentCorrected: true } : {}),
  };
}

/**
 * Live subscription to all orders between two local dates (inclusive, YYYYMMDD),
 * newest first. A range on a single field needs no composite index.
 */
export function subscribeOrdersInRange(
  fromDk: string,
  toDk: string,
  onData: (orders: Order[], fromCache: boolean, pendingWrites: number) => void,
  onError: (e: Error) => void,
): () => void {
  const q = query(
    ordersCol,
    where('dateKey', '>=', fromDk),
    where('dateKey', '<=', toDk),
    orderBy('dateKey', 'desc'),
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const orders = snap.docs
        .map((d) => mapOrder(d.id, d.data()))
        .sort((a, b) => b.clientCreatedAt - a.clientCreatedAt);
      const pending = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
      onData(orders, snap.metadata.fromCache, pending);
    },
    (err) => onError(err as Error),
  );
}

export function subscribeOrder(
  id: string,
  onData: (order: Order | null, pendingWrite: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(ordersCol, id),
    { includeMetadataChanges: true },
    (snap) =>
      onData(snap.exists() ? mapOrder(snap.id, snap.data()) : null, snap.metadata.hasPendingWrites),
    (err) => onError(err as Error),
  );
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(ordersCol, id));
  return snap.exists() ? mapOrder(snap.id, snap.data()) : null;
}

/**
 * Find an order by the number printed on its receipt. Checks the canonical
 * number first, then the original offline (provisional) number.
 */
export async function findByOrderNumber(orderNumber: string): Promise<Order | null> {
  const n = orderNumber.trim();
  if (!n) return null;
  for (const field of ['orderNumber', 'provisionalNumber']) {
    const snap = await getDocs(query(ordersCol, where(field, '==', n), limit(1)));
    if (!snap.empty) return mapOrder(snap.docs[0].id, snap.docs[0].data());
  }
  return null;
}

/**
 * Record a reprint. Only increments a counter on the existing order — it never
 * creates a new sale (spec §6). Not awaited by callers when offline.
 */
export function recordReprint(id: string): Promise<void> {
  return updateDoc(doc(ordersCol, id), { reprintCount: increment(1) });
}

/**
 * Mark an order cancelled or refunded (owner only). Orders are never deleted.
 * The status change and its audit entry are written in ONE batch; the security
 * rules reject either without the other, so the audit trail can't be skipped
 * (spec §8, §11).
 */
export async function changeOrderStatus(
  order: Pick<Order, 'id' | 'orderNumber' | 'grandTotalPaise'>,
  status: 'cancelled' | 'refunded',
  reason: string,
): Promise<void> {
  const uid = auth.currentUser?.uid ?? '';
  const statusReason = reason.trim().slice(0, 200);
  const batch = writeBatch(db);
  batch.update(doc(ordersCol, order.id), {
    status,
    statusReason,
    statusChangedBy: uid,
    statusChangedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'audit', `order-${order.id}-${status}`), {
    type: status === 'refunded' ? 'refund' : 'order_cancel',
    orderId: order.id,
    orderNumber: order.orderNumber,
    before: 'completed',
    after: status,
    amountPaise: order.grandTotalPaise,
    reason: statusReason,
    who: uid,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Correct how a completed order was paid (owner only), e.g. UPI was selected
 * but the payment failed and the customer paid cash. Only the method changes;
 * the amount and everything else stay as sold. The change and its audit entry
 * are written in ONE batch, and the rules insist on a fresh entry every time.
 */
export async function changePaymentMethod(
  order: Pick<Order, 'id' | 'orderNumber' | 'grandTotalPaise' | 'paymentMethod'>,
  method: PaymentMethod,
  reason = '',
): Promise<void> {
  if (method === order.paymentMethod) return;
  const uid = auth.currentUser?.uid ?? '';
  const auditId = `order-${order.id}-payment-${Date.now()}`;
  const batch = writeBatch(db);
  batch.update(doc(ordersCol, order.id), {
    paymentMethod: method,
    paymentChangedBy: uid,
    paymentChangedAt: serverTimestamp(),
    lastPaymentAuditId: auditId,
  });
  batch.set(doc(db, 'audit', auditId), {
    type: 'payment_change',
    orderId: order.id,
    orderNumber: order.orderNumber,
    before: order.paymentMethod,
    after: method,
    amountPaise: order.grandTotalPaise,
    reason: reason.trim().slice(0, 200),
    who: uid,
    at: serverTimestamp(),
  });
  await batch.commit();
}
