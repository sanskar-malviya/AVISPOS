// Server-side checking of new orders (spec §11), replacing the former
// Firestore-triggered Cloud Function so the app runs on Firebase's free plan.
//
// For every order not yet checked:
//  - re-validate its money against the menu (shared/validate.ts),
//  - give offline orders their canonical daily order number,
//  - mark it checked (+ validated / validationErrors).
// Safe to run concurrently (app trigger + schedule): each order is processed
// inside a transaction that skips it if another run already checked it.
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { formatOrderNumber, validateOrder } from '../../shared/validate';

export interface ProcessResult {
  processed: number;
  flagged: number;
  renumbered: number;
}

export async function processPendingOrders(db: Firestore, max = 100): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, flagged: 0, renumbered: 0 };
  const pending = await db.collection('orders').where('checked', '==', false).limit(max).get();
  if (pending.empty) return result;

  const products = await db.collection('products').get();
  const menuPrices = new Map(products.docs.map((d) => [d.id, Number(d.get('pricePaise'))]));

  for (const snap of pending.docs) {
    const errors = validateOrder(snap.data(), menuPrices);
    const outcome = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (!fresh.exists || fresh.get('checked') === true) return null;
      const data = fresh.data()!;

      const update: Record<string, unknown> = {
        checked: true,
        validated: errors.length === 0,
        validationErrors: errors,
        validatedAt: FieldValue.serverTimestamp(),
      };

      let renumbered = false;
      const dk = String(data.dateKey ?? '');
      if (data.orderNumberProvisional === true && /^\d{8}$/.test(dk)) {
        const counterRef = db.collection('counters').doc(dk);
        const counter = await tx.get(counterRef); // all reads before writes
        const seq = (counter.exists ? Number(counter.get('seq') ?? 0) : 0) + 1;
        tx.set(counterRef, { seq, dateKey: dk });
        update.provisionalNumber = data.orderNumber;
        update.orderNumber = formatOrderNumber(dk, seq);
        update.orderNumberProvisional = false;
        renumbered = true;
      }
      tx.update(snap.ref, update);
      return { renumbered };
    });

    if (outcome) {
      result.processed++;
      if (errors.length) result.flagged++;
      if (outcome.renumbered) result.renumbered++;
    }
  }
  return result;
}
