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
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const DK = '20261010';
const owner = (): Firestore => env.authenticatedContext('owner1', { role: 'owner' }).firestore() as unknown as Firestore;
const cashier = (): Firestore => env.authenticatedContext('cash1', { role: 'cashier' }).firestore() as unknown as Firestore;
const noRole = (): Firestore => env.authenticatedContext('nobody', {}).firestore() as unknown as Firestore;
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
  ...over,
});

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
    await setDoc(doc(db, 'orders/o1'), { ...newOrder('cash1', { id: 'o1', orderNumber: `${DK}-0001` }), createdAt: new Date() });
    await setDoc(doc(db, `counters/${DK}`), { seq: 1, dateKey: DK });
    await setDoc(doc(db, 'settings/business'), { businessName: 'AVIZ FOOD POINT', paperWidth: '58' });
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

  it('nobody can write the audit log from the app', async () => {
    await assertFails(setDoc(doc(owner(), 'audit/x'), { type: 'fake' }));
    await assertSucceeds(getDocs(collection(owner(), 'audit')));
    await assertFails(getDocs(collection(cashier(), 'audit')));
  });
});

describe('products', () => {
  it('cashiers cannot change prices; owners can (recorded with their uid)', async () => {
    await assertFails(updateDoc(doc(cashier(), 'products/vada-pav'), { pricePaise: 100, updatedBy: 'cash1' }));
    await assertSucceeds(updateDoc(doc(owner(), 'products/vada-pav'), { pricePaise: 3500, updatedBy: 'owner1' }));
  });

  it('owner edits must carry their own uid and a valid price', async () => {
    // A second owner who doesn't stamp their uid would leave the change
    // attributed to owner1 in the audit log — rejected.
    const owner2 = env.authenticatedContext('owner2', { role: 'owner' }).firestore() as unknown as Firestore;
    await assertFails(updateDoc(doc(owner2, 'products/vada-pav'), { pricePaise: 3500 }));
    await assertSucceeds(updateDoc(doc(owner2, 'products/vada-pav'), { pricePaise: 3500, updatedBy: 'owner2' }));
    await assertFails(updateDoc(doc(owner(), 'products/vada-pav'), { pricePaise: -5, updatedBy: 'owner1' }));
    await assertFails(updateDoc(doc(owner(), 'products/vada-pav'), { pricePaise: 35.5, updatedBy: 'owner1' }));
  });

  it('products can never be deleted', async () => {
    await assertFails(deleteDoc(doc(owner(), 'products/vada-pav')));
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

  it('acceptance 8: an order cannot be saved as unpaid / pending', async () => {
    await assertFails(setDoc(doc(cashier(), 'orders/o2'), newOrder('cash1', { paymentStatus: 'unpaid' })));
    await assertFails(setDoc(doc(cashier(), 'orders/o2'), newOrder('cash1', { paymentMethod: 'card' })));
  });

  it('rejects tampering with server-controlled or money fields', async () => {
    const c = cashier();
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
        const seq = Number(counter.data()?.seq ?? 0) + 1;
        tx.set(counterRef, { seq, dateKey: DK });
        tx.set(orderRef, newOrder('cash1', { orderNumber: `${DK}-${String(seq).padStart(4, '0')}` }));
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

  it('only owners can cancel/refund, a reason is required, and it is one-way', async () => {
    const cancel = (reason: string, by = 'owner1') => ({
      status: 'cancelled',
      statusReason: reason,
      statusChangedBy: by,
      statusChangedAt: serverTimestamp(),
    });
    await assertFails(updateDoc(doc(cashier(), 'orders/o1'), cancel('mistake', 'cash1')));
    await assertFails(updateDoc(doc(owner(), 'orders/o1'), cancel('')));
    await assertFails(updateDoc(doc(owner(), 'orders/o1'), cancel('mistake', 'someone-else')));
    await assertSucceeds(updateDoc(doc(owner(), 'orders/o1'), cancel('Customer changed mind')));
    await assertFails(updateDoc(doc(owner(), 'orders/o1'), { status: 'completed' }));
  });

  it('completed sales can never be deleted', async () => {
    await assertFails(deleteDoc(doc(cashier(), 'orders/o1')));
    await assertFails(deleteDoc(doc(owner(), 'orders/o1')));
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
