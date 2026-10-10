// Aviz Food Point POS — Cloud Functions (2nd gen), deployed to Mumbai.
//
//  onOrderCreated   validate every new order's money against the menu, and give
//                   offline orders their canonical daily order number
//  onOrderUpdated   audit-log cancellations and refunds
//  onProductWritten audit-log price changes
//  listStaff / createStaffUser / setStaffRole / setStaffDisabled
//                   owner-only staff account management (needs the Admin SDK)

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { formatOrderNumber, validateOrder } from './validate';

initializeApp();
const db = getFirestore();

// Must match FUNCTIONS_REGION in src/lib/firebase/index.ts and the Firestore
// database location chosen when creating the project.
setGlobalOptions({ region: 'asia-south1', maxInstances: 5 });

type Role = 'owner' | 'cashier';
const ROLES: Role[] = ['owner', 'cashier'];

// ── Orders ───────────────────────────────────────────────────────────────────

export const onOrderCreated = onDocumentCreated('orders/{orderId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const order = snap.data();

  // Look up the current menu price of every product on the order.
  const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
  const ids = [...new Set(items.map((i) => String(i?.productId ?? '')).filter(Boolean))];
  const productSnaps = ids.length
    ? await db.getAll(...ids.map((id) => db.collection('products').doc(id)))
    : [];
  const menuPrices = new Map<string, number>();
  for (const p of productSnaps) if (p.exists) menuPrices.set(p.id, Number(p.get('pricePaise')));

  const errors = validateOrder(order, menuPrices);

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(snap.ref);
    if (!fresh.exists) return;
    const data = fresh.data()!;
    // Triggers can be delivered more than once — only process each order once.
    if (data.validatedAt) return;

    const update: Record<string, unknown> = {
      validated: errors.length === 0,
      validationErrors: errors,
      validatedAt: FieldValue.serverTimestamp(),
    };

    // Offline sale: replace the provisional number with the next canonical
    // number for the day it was sold. The printed (provisional) number is
    // kept so the receipt can still be found by searching it.
    if (data.orderNumberProvisional === true && /^\d{8}$/.test(String(data.dateKey))) {
      const dk = String(data.dateKey);
      const counterRef = db.collection('counters').doc(dk);
      const counter = await tx.get(counterRef);
      const seq = (counter.exists ? Number(counter.get('seq') ?? 0) : 0) + 1;
      tx.set(counterRef, { seq, dateKey: dk });
      update.provisionalNumber = data.orderNumber;
      update.orderNumber = formatOrderNumber(dk, seq);
      update.orderNumberProvisional = false;
    }

    tx.update(snap.ref, update);
  });

  if (errors.length) {
    logger.warn('Order failed validation', { orderId: snap.id, errors });
  }
});

export const onOrderUpdated = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  // Deterministic id → a redelivered trigger can't create a duplicate entry.
  await db
    .collection('audit')
    .doc(`order-${event.params.orderId}-${after.status}`)
    .set({
      type: after.status === 'refunded' ? 'refund' : 'order_cancel',
      orderId: event.params.orderId,
      orderNumber: after.orderNumber ?? '',
      before: before.status,
      after: after.status,
      amountPaise: after.grandTotalPaise ?? 0,
      reason: after.statusReason ?? '',
      who: after.statusChangedBy ?? '',
      at: FieldValue.serverTimestamp(),
    });
});

// ── Products ─────────────────────────────────────────────────────────────────

export const onProductWritten = onDocumentWritten('products/{productId}', async (event) => {
  const before = event.data?.before.exists ? event.data.before.data() : undefined;
  const after = event.data?.after.exists ? event.data.after.data() : undefined;
  if (!after) return;
  if (before && before.pricePaise === after.pricePaise) return;

  await db
    .collection('audit')
    .doc(`price-${event.id}`)
    .set({
      type: 'price_change',
      productId: event.params.productId,
      productName: after.name ?? '',
      beforePaise: before ? before.pricePaise ?? null : null,
      afterPaise: after.pricePaise ?? null,
      who: after.updatedBy ?? '',
      at: FieldValue.serverTimestamp(),
    });
});

// ── Staff management (owner only) ────────────────────────────────────────────

function requireOwner(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  if (req.auth.token.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only the owner can manage staff accounts.');
  }
  return req.auth.uid;
}

function parseRole(v: unknown): Role {
  if (typeof v === 'string' && (ROLES as string[]).includes(v)) return v as Role;
  throw new HttpsError('invalid-argument', 'Role must be "owner" or "cashier".');
}

function parseUid(v: unknown): string {
  if (typeof v === 'string' && v.length > 0 && v.length <= 128) return v;
  throw new HttpsError('invalid-argument', 'Missing user id.');
}

async function auditRole(by: string, uid: string, detail: Record<string, unknown>) {
  await db.collection('audit').add({
    type: 'role_change',
    uid,
    who: by,
    ...detail,
    at: FieldValue.serverTimestamp(),
  });
}

export const listStaff = onCall(async (req) => {
  requireOwner(req);
  const { users } = await getAuth().listUsers(1000);
  const staff = users
    .map((u) => {
      const r = u.customClaims?.role;
      return {
        uid: u.uid,
        email: u.email ?? '(no email)',
        role: r === 'owner' || r === 'cashier' ? r : null,
        disabled: u.disabled,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
  return { staff };
});

export const createStaffUser = onCall(async (req) => {
  const by = requireOwner(req);
  const { email, password, role } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpsError('invalid-argument', 'The password must be at least 8 characters.');
  }
  const r = parseRole(role);
  try {
    const user = await getAuth().createUser({ email: email.trim(), password });
    await getAuth().setCustomUserClaims(user.uid, { role: r });
    await db.collection('users').doc(user.uid).set({ email: user.email, role: r, disabled: false });
    await auditRole(by, user.uid, { email: user.email, action: 'created', role: r });
    return { uid: user.uid };
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists.');
    }
    throw e;
  }
});

export const setStaffRole = onCall(async (req) => {
  const by = requireOwner(req);
  const uid = parseUid(req.data?.uid);
  const role = parseRole(req.data?.role);
  if (uid === by) {
    throw new HttpsError('failed-precondition', 'You cannot change your own role.');
  }
  const user = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role });
  // Force a fresh sign-in so the new role takes effect promptly.
  await getAuth().revokeRefreshTokens(uid);
  await db.collection('users').doc(uid).set({ email: user.email ?? '', role }, { merge: true });
  await auditRole(by, uid, { email: user.email ?? '', action: 'role', role });
  return { ok: true };
});

export const setStaffDisabled = onCall(async (req) => {
  const by = requireOwner(req);
  const uid = parseUid(req.data?.uid);
  const disabled = req.data?.disabled === true;
  if (uid === by) {
    throw new HttpsError('failed-precondition', 'You cannot disable your own account.');
  }
  const user = await getAuth().updateUser(uid, { disabled });
  if (disabled) await getAuth().revokeRefreshTokens(uid);
  await db.collection('users').doc(uid).set({ email: user.email ?? '', disabled }, { merge: true });
  await auditRole(by, uid, { email: user.email ?? '', action: disabled ? 'disabled' : 'enabled' });
  return { ok: true };
});
