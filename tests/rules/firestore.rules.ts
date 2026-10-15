// Firestore security-rules tests (spec §11). Run with: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const DK = '20261010';
const as = (uid: string, role?: string): Firestore =>
  env.authenticatedContext(uid, role ? { role } : {}).firestore() as unknown as Firestore;
const owner = () => as('owner1', 'owner');
const owner2 = () => as('owner2', 'owner');
const cashier = () => as('cash1', 'cashier');
const noRole = () => as('nobody');
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

function newOrder(uid: string, over: Record<string, unknown> = {}) {
  return {
    id: 'o2',
    orderNumber: `${DK}-0002`,
    orderNumberProvisional: false,
    createdAt: serverTimestamp(),
    clientCreatedAt: 1_760_000_000_000,
    dateKey: DK,
    items: [{ productId: 'vada-pav', name: 'Vada Pav', unitPricePaise: 3000, qty: 1, lineTotalPaise: 3000 }],
    subtotalPaise: 3000,
    grandTotalPaise: 3000,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    status: 'completed',
    cashierUid: uid,
    deviceId: 'dev1',
    reprintCount: 0,
    checked: false,
    validated: false,
    validationErrors: [],
    provisionalNumber: '',
    source: 'online',
    statusReason: '',
    ...over,
  };
}

const product = (over: Record<string, unknown> = {}) => ({
  name: 'Vada Pav',
  pricePaise: 3000,
  imageUrl: '',
  imagePath: '',
  active: true,
  available: true,
  sortOrder: 4,
  createdAt: 1,
  updatedAt: 1,
  updatedBy: 'owner1',
  lastPriceAuditId: 'price-vada-pav-1',
  ...over,
});

let seq = 1000;
interface PriceChange {
  db: Firestore;
  productId?: string;
  newPrice: number;
  by?: string; // updatedBy on the product
  audit?: false | Partial<{ before: number | null; after: number; who: string; productId: string }>;
  create?: boolean;
}
/** Change (or create) a product's price the way the app does: product + audit in one batch. */
function priceBatch({ db, productId = 'vada-pav', newPrice, by = 'owner1', audit = {}, create }: PriceChange) {
  const auditId = `price-${productId}-${++seq}`;
  const b = writeBatch(db);
  if (create) b.set(doc(db, 'products', productId), product({ pricePaise: newPrice, updatedBy: by, lastPriceAuditId: auditId }));
  else b.update(doc(db, 'products', productId), { pricePaise: newPrice, updatedBy: by, lastPriceAuditId: auditId });
  if (audit !== false) {
    b.set(doc(db, 'audit', auditId), {
      type: 'price_change',
      productId: audit.productId ?? productId,
      productName: 'Vada Pav',
      beforePaise: 'before' in audit ? audit.before : create ? null : 3000,
      afterPaise: audit.after ?? newPrice,
      who: audit.who ?? by,
      at: serverTimestamp(),
    });
  }
  return b.commit();
}

interface StatusChange {
  db: Firestore;
  status?: 'cancelled' | 'refunded';
  reason?: string;
  by?: string;
  audit?: false | Partial<{ amountPaise: number; type: string; reason: string; id: string }>;
}
/** Cancel/refund the way the app does: order update + audit entry in one batch. */
function statusBatch({ db, status = 'cancelled', reason = 'Customer changed mind', by = 'owner1', audit = {} }: StatusChange) {
  const b = writeBatch(db);
  b.update(doc(db, 'orders/o1'), {
    status,
    statusReason: reason,
    statusChangedBy: by,
    statusChangedAt: serverTimestamp(),
  });
  if (audit !== false) {
    b.set(doc(db, 'audit', audit.id ?? `order-o1-${status}`), {
      type: audit.type ?? (status === 'refunded' ? 'refund' : 'order_cancel'),
      orderId: 'o1',
      orderNumber: `${DK}-0001`,
      before: 'completed',
      after: status,
      amountPaise: audit.amountPaise ?? 3000,
      reason: audit.reason ?? reason,
      who: by,
      at: serverTimestamp(),
    });
  }
  return b.commit();
}

interface PaymentChange {
  db: Firestore;
  to?: 'cash' | 'upi';
  by?: string;
  auditId?: string;
  extra?: Record<string, unknown>; // extra fields on the order update
  audit?: false | Partial<{ before: string; amountPaise: number; reason: unknown; who: string }>;
}
/** Correct the payment method the way the app does: order update + audit entry in one batch. */
function paymentBatch({ db, to = 'upi', by = 'owner1', auditId, extra = {}, audit = {} }: PaymentChange) {
  const id = auditId ?? `order-o1-payment-${++seq}`;
  const b = writeBatch(db);
  b.update(doc(db, 'orders/o1'), {
    paymentMethod: to,
    paymentChangedBy: by,
    paymentChangedAt: serverTimestamp(),
    lastPaymentAuditId: id,
    ...extra,
  });
  if (audit !== false) {
    b.set(doc(db, 'audit', id), {
      type: 'payment_change',
      orderId: 'o1',
      orderNumber: `${DK}-0001`,
      before: audit.before ?? (to === 'upi' ? 'cash' : 'upi'),
      after: to,
      amountPaise: audit.amountPaise ?? 3000,
      reason: 'reason' in audit ? audit.reason : 'UPI failed, paid cash',
      who: audit.who ?? by,
      at: serverTimestamp(),
    });
  }
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aviz-pos-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'products/vada-pav'), product());
    await setDoc(doc(db, 'audit/price-vada-pav-1'), { type: 'price_change', productId: 'vada-pav', afterPaise: 3000 });
    await setDoc(doc(db, 'orders/o1'), { ...newOrder('cash1', { id: 'o1', orderNumber: `${DK}-0001` }), createdAt: new Date() });
    await setDoc(doc(db, `counters/${DK}`), { seq: 1, dateKey: DK });
    await setDoc(doc(db, 'settings/business'), { businessName: "AVI'S FOOD CORNER", paperWidth: '58' });
    await setDoc(doc(db, 'settings/security'), { ownerPinHash: 'abc' });
  });
});

describe('access by role', () => {
  it('signed-out users and users without a role are denied', async () => {
    await assertFails(getDoc(doc(anon(), 'products/vada-pav')));
    await assertFails(getDoc(doc(noRole(), 'products/vada-pav')));
    await assertFails(setDoc(doc(noRole(), 'orders/o2'), newOrder('nobody')));
  });

  it('cashiers can read the menu and settings but not the owner PIN', async () => {
    await assertSucceeds(getDoc(doc(cashier(), 'products/vada-pav')));
    await assertSucceeds(getDoc(doc(cashier(), 'settings/business')));
    await assertFails(getDoc(doc(cashier(), 'settings/security')));
    await assertSucceeds(getDoc(doc(owner(), 'settings/security')));
  });

  it('only owners can change settings', async () => {
    await assertFails(setDoc(doc(cashier(), 'settings/business'), { businessName: 'X' }, { merge: true }));
    await assertSucceeds(setDoc(doc(owner(), 'settings/business'), { businessName: 'X' }, { merge: true }));
    await assertFails(setDoc(doc(owner(), 'settings/business'), { paperWidth: '100' }, { merge: true }));
  });
});

describe('products and the price history', () => {
  it('cashiers cannot change prices', async () => {
    await assertFails(priceBatch({ db: cashier(), newPrice: 100, by: 'cash1' }));
  });

  it('acceptance 5: an owner can change a price together with its audit entry', async () => {
    await assertSucceeds(priceBatch({ db: owner(), newPrice: 3500 }));
  });

  it('a price change WITHOUT its audit entry is rejected', async () => {
    await assertFails(priceBatch({ db: owner(), newPrice: 3500, audit: false }));
    await assertFails(updateDoc(doc(owner(), 'products/vada-pav'), { pricePaise: 3500, updatedBy: 'owner1' }));
  });

  it('a false audit entry is rejected (wrong old price, new price or author)', async () => {
    await assertFails(priceBatch({ db: owner(), newPrice: 3500, audit: { before: 9999 } }));
    await assertFails(priceBatch({ db: owner(), newPrice: 3500, audit: { after: 4000 } }));
    await assertFails(priceBatch({ db: owner(), newPrice: 3500, audit: { who: 'someone-else' } }));
    await assertFails(priceBatch({ db: owner(), newPrice: 3500, audit: { productId: 'pav-bhaji' } }));
  });

  it('a new product needs its starting price recorded', async () => {
    await assertSucceeds(priceBatch({ db: owner(), productId: 'samosa', newPrice: 2000, create: true }));
    await assertFails(priceBatch({ db: owner(), productId: 'dosa', newPrice: 2000, create: true, audit: false }));
  });

  it('non-price edits need no audit entry, but must name the editor', async () => {
    await assertSucceeds(updateDoc(doc(owner(), 'products/vada-pav'), { available: false, updatedBy: 'owner1' }));
    // A second owner who doesn't stamp their own uid is rejected.
    await assertFails(updateDoc(doc(owner2(), 'products/vada-pav'), { available: true }));
    await assertSucceeds(updateDoc(doc(owner2(), 'products/vada-pav'), { available: true, updatedBy: 'owner2' }));
    // …and can't repoint the price history without a price change.
    await assertFails(
      updateDoc(doc(owner(), 'products/vada-pav'), { lastPriceAuditId: 'price-vada-pav-9', updatedBy: 'owner1' }),
    );
  });

  it('prices must be positive whole paise; photos are size-limited', async () => {
    await assertFails(priceBatch({ db: owner(), newPrice: -5 }));
    await assertFails(priceBatch({ db: owner(), newPrice: 35.5 }));
    await assertSucceeds(
      updateDoc(doc(owner(), 'products/vada-pav'), { imageUrl: 'data:image/jpeg;base64,' + 'A'.repeat(200_000), updatedBy: 'owner1' }),
    );
    await assertFails(
      updateDoc(doc(owner(), 'products/vada-pav'), { imageUrl: 'data:image/jpeg;base64,' + 'A'.repeat(500_000), updatedBy: 'owner1' }),
    );
  });

  it('products can never be deleted from the app (only the server function may)', async () => {
    await assertFails(deleteDoc(doc(owner(), 'products/vada-pav')));
    await assertFails(deleteDoc(doc(cashier(), 'products/vada-pav')));
  });
});

describe('audit log', () => {
  it('cannot be written on its own, edited or deleted', async () => {
    await assertFails(setDoc(doc(owner(), 'audit/x'), { type: 'fake' }));
    await assertFails(
      setDoc(doc(owner(), 'audit/price-vada-pav-5'), {
        type: 'price_change', productId: 'vada-pav', productName: 'Vada Pav',
        beforePaise: 3000, afterPaise: 3000, who: 'owner1', at: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(owner(), 'audit/price-vada-pav-1'), { afterPaise: 1 }));
    await assertFails(deleteDoc(doc(owner(), 'audit/price-vada-pav-1')));
  });

  it('is readable only by owners', async () => {
    await assertSucceeds(getDocs(collection(owner(), 'audit')));
    await assertFails(getDocs(collection(cashier(), 'audit')));
  });
});

describe('orders', () => {
  it('a cashier can save a valid paid order', async () => {
    await assertSucceeds(setDoc(doc(cashier(), 'orders/o2'), newOrder('cash1')));
  });

  it('an offline order with a provisional number is accepted', async () => {
    await assertSucceeds(
      setDoc(
        doc(cashier(), 'orders/o2'),
        newOrder('cash1', { orderNumber: `OFF-ab12cd34-${DK}-001`, orderNumberProvisional: true, source: 'offline' }),
      ),
    );
  });

  it("an online order may carry this device's backup number, and nothing else", async () => {
    const c = cashier();
    await assertSucceeds(
      setDoc(doc(c, 'orders/o2'), newOrder('cash1', { provisionalNumber: `OFF-dev1-${DK}-004` })),
    );
    // Another device's number, another day, a made-up value, or on an offline order: rejected.
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { provisionalNumber: `OFF-dev2-${DK}-004` })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { provisionalNumber: 'OFF-dev1-20200101-004' })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { provisionalNumber: `${DK}-0001` })));
    await assertFails(
      setDoc(
        doc(c, 'orders/o2'),
        newOrder('cash1', {
          orderNumber: `OFF-dev1-${DK}-001`,
          orderNumberProvisional: true,
          source: 'offline',
          provisionalNumber: `OFF-dev1-${DK}-002`,
        }),
      ),
    );
    // A device id that could act as a regex pattern is refused.
    await assertFails(
      setDoc(doc(c, 'orders/o2'), newOrder('cash1', { deviceId: '.*', provisionalNumber: `OFF-x-${DK}-001` })),
    );
  });

  it('acceptance 8: an order cannot be saved as unpaid / pending', async () => {
    await assertFails(setDoc(doc(cashier(), 'orders/o2'), newOrder('cash1', { paymentStatus: 'unpaid' })));
    await assertFails(setDoc(doc(cashier(), 'orders/o2'), newOrder('cash1', { paymentMethod: 'card' })));
  });

  it('rejects tampering with server-controlled or money fields', async () => {
    const c = cashier();
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { checked: true })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { validated: true })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { reprintCount: 5 })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { grandTotalPaise: 1 })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { status: 'refunded' })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { createdAt: new Date(2020, 0, 1) })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { discount: 100 })));
    await assertFails(setDoc(doc(c, 'orders/o2'), newOrder('cash1', { items: [] })));
  });

  it('cannot record a sale on behalf of another cashier or under a different doc id', async () => {
    await assertFails(setDoc(doc(cashier(), 'orders/o2'), newOrder('someone-else')));
    await assertFails(setDoc(doc(cashier(), 'orders/o3'), newOrder('cash1')));
  });

  it('order numbers must match the sale date', async () => {
    await assertFails(setDoc(doc(cashier(), 'orders/o2'), newOrder('cash1', { orderNumber: '20250101-0002' })));
  });

  it('acceptance 9 / 11: re-saving an existing order is rejected (no duplicate sale)', async () => {
    await assertFails(setDoc(doc(cashier(), 'orders/o1'), newOrder('cash1', { id: 'o1', orderNumber: `${DK}-0009` })));
  });

  it('the real checkout transaction passes the rules', async () => {
    const db = cashier();
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const orderRef = doc(db, 'orders/o2');
        const counterRef = doc(db, `counters/${DK}`);
        const existing = await tx.get(orderRef);
        if (existing.exists()) return;
        const counter = await tx.get(counterRef);
        const next = Number(counter.data()?.seq ?? 0) + 1;
        tx.set(counterRef, { seq: next, dateKey: DK });
        tx.set(orderRef, newOrder('cash1', { orderNumber: `${DK}-${String(next).padStart(4, '0')}` }));
      }),
    );
  });

  it('cashiers can open a single order but only owners can browse history', async () => {
    await assertSucceeds(getDoc(doc(cashier(), 'orders/o1')));
    await assertFails(getDocs(collection(cashier(), 'orders')));
    await assertSucceeds(getDocs(collection(owner(), 'orders')));
  });

  it('acceptance 11: a reprint only increments the reprint counter', async () => {
    await assertSucceeds(updateDoc(doc(cashier(), 'orders/o1'), { reprintCount: increment(1) }));
    await assertFails(updateDoc(doc(cashier(), 'orders/o1'), { reprintCount: 10 }));
    await assertFails(updateDoc(doc(cashier(), 'orders/o1'), { grandTotalPaise: 1 }));
  });

  it('owners can cancel or refund together with an audit entry', async () => {
    await assertSucceeds(statusBatch({ db: owner() }));
  });

  it('a refund is recorded as a refund', async () => {
    await assertSucceeds(statusBatch({ db: owner(), status: 'refunded' }));
  });

  it('cancelling WITHOUT an audit entry, or with a false one, is rejected', async () => {
    await assertFails(statusBatch({ db: owner(), audit: false }));
    await assertFails(statusBatch({ db: owner(), audit: { amountPaise: 1 } }));
    await assertFails(statusBatch({ db: owner(), audit: { type: 'refund' } }));
    await assertFails(statusBatch({ db: owner(), audit: { reason: 'something else' } }));
    await assertFails(statusBatch({ db: owner(), audit: { id: 'order-o1-other' } }));
  });

  it('cashiers cannot cancel; a reason is required; it is one-way', async () => {
    await assertFails(statusBatch({ db: cashier(), by: 'cash1' }));
    await assertFails(statusBatch({ db: owner(), reason: '' }));
    await assertFails(statusBatch({ db: owner(), by: 'someone-else' }));
    await assertSucceeds(statusBatch({ db: owner() }));
    await assertFails(updateDoc(doc(owner(), 'orders/o1'), { status: 'completed' }));
  });

  it('completed sales can never be deleted', async () => {
    await assertFails(deleteDoc(doc(cashier(), 'orders/o1')));
    await assertFails(deleteDoc(doc(owner(), 'orders/o1')));
  });
});

describe('correcting the payment method', () => {
  it('an owner can change cash ↔ UPI together with an audit entry, more than once', async () => {
    await assertSucceeds(paymentBatch({ db: owner(), to: 'upi' }));
    await assertSucceeds(paymentBatch({ db: owner(), to: 'cash' }));
    await assertSucceeds(paymentBatch({ db: owner2(), to: 'upi', by: 'owner2', audit: { reason: '' } }));
  });

  it('cashiers cannot change it', async () => {
    await assertFails(paymentBatch({ db: cashier(), by: 'cash1' }));
  });

  it('WITHOUT an audit entry, or with a false one, is rejected', async () => {
    await assertFails(paymentBatch({ db: owner(), audit: false }));
    await assertFails(updateDoc(doc(owner(), 'orders/o1'), { paymentMethod: 'upi' }));
    await assertFails(paymentBatch({ db: owner(), audit: { before: 'upi' } }));
    await assertFails(paymentBatch({ db: owner(), audit: { amountPaise: 1 } }));
    await assertFails(paymentBatch({ db: owner(), audit: { who: 'someone-else' } }));
    await assertFails(paymentBatch({ db: owner(), audit: { reason: 'x'.repeat(201) } }));
    await assertFails(paymentBatch({ db: owner(), by: 'someone-else' }));
  });

  it('an old audit entry cannot be pointed at again', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit/order-o1-payment-1'), {
        type: 'payment_change', orderId: 'o1', orderNumber: `${DK}-0001`, before: 'cash', after: 'upi',
        amountPaise: 3000, reason: '', who: 'owner1', at: new Date(),
      });
    });
    await assertFails(paymentBatch({ db: owner(), auditId: 'order-o1-payment-1', audit: false }));
    await assertFails(paymentBatch({ db: owner(), auditId: 'order-o1-payment-1' }));
    // An entry named for another order is refused too.
    await assertFails(paymentBatch({ db: owner(), auditId: 'order-o2-payment-7' }));
  });

  it('only the method may change — not the amount, the items or the status', async () => {
    await assertFails(paymentBatch({ db: owner(), to: 'cash' })); // same as before: no-op
    await assertFails(paymentBatch({ db: owner(), extra: { grandTotalPaise: 1 } }));
    await assertFails(paymentBatch({ db: owner(), extra: { items: [] } }));
    await assertFails(paymentBatch({ db: owner(), extra: { status: 'refunded' } }));
    await assertFails(paymentBatch({ db: owner(), extra: { paymentStatus: 'unpaid' } }));
    await assertFails(
      paymentBatch({ db: owner(), to: 'card' as 'upi', audit: { before: 'cash' } }),
    );
  });

  it('is not allowed on a cancelled or refunded order', async () => {
    await assertSucceeds(statusBatch({ db: owner() }));
    await assertFails(paymentBatch({ db: owner() }));
  });
});

describe('order-number counters', () => {
  it('can only move forward by exactly one', async () => {
    await assertFails(setDoc(doc(cashier(), `counters/${DK}`), { seq: 5, dateKey: DK }));
    await assertFails(setDoc(doc(cashier(), `counters/${DK}`), { seq: 1, dateKey: DK }));
    await assertSucceeds(setDoc(doc(cashier(), `counters/${DK}`), { seq: 2, dateKey: DK }));
    await assertFails(deleteDoc(doc(owner(), `counters/${DK}`)));
  });

  it('a new day starts at 1', async () => {
    await assertFails(setDoc(doc(cashier(), 'counters/20261011'), { seq: 7, dateKey: '20261011' }));
    await assertSucceeds(setDoc(doc(cashier(), 'counters/20261011'), { seq: 1, dateKey: '20261011' }));
  });
});
