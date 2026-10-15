// POST /.netlify/functions/products — owner-only product management that the
// security rules deliberately don't allow from the app.
// Body: { action: 'delete', id }
//
// Deleting: a product can only be deleted if it has NEVER been sold. Orders
// keep a snapshot of each line (name, price) but also the product id, and the
// server re-checks every order against the menu, so removing a sold product
// would leave history pointing at nothing. Sold products are hidden with the
// "On menu" switch instead. The delete is recorded in the audit log.
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../lib/admin';
import { requireRole } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';

function parseId(v: unknown): string {
  if (typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)) return v;
  throw new HttpError(400, 'Missing product id.');
}

/** True if any order (of any status, synced at any time) contains the product. */
async function hasBeenSold(productId: string): Promise<boolean> {
  const stream = adminDb().collection('orders').select('items').stream();
  for await (const snap of stream as AsyncIterable<QueryDocumentSnapshot>) {
    const items = snap.get('items');
    if (!Array.isArray(items)) continue;
    const hit = items.some(
      (it) => it && typeof it === 'object' && (it as { productId?: unknown }).productId === productId,
    );
    if (hit) return true;
  }
  return false;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const caller = await requireRole(req, ['owner']);
    const body = await readJson(req);
    const db = adminDb();

    switch (body.action) {
      case 'delete': {
        const id = parseId(body.id);
        const ref = db.collection('products').doc(id);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpError(404, 'That product no longer exists.');
        const name = String(snap.get('name') ?? id);

        if (await hasBeenSold(id)) {
          throw new HttpError(
            409,
            `${name} has been sold, so it can't be deleted — past orders and reports need it. ` +
              'Switch "On menu" off to hide it from billing instead.',
          );
        }

        const batch = db.batch();
        batch.delete(ref);
        batch.set(db.collection('audit').doc(`product-delete-${id}-${Date.now()}`), {
          type: 'product_delete',
          productId: id,
          productName: name,
          pricePaise: Number(snap.get('pricePaise') ?? 0),
          who: caller.uid,
          at: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        return json(200, { ok: true });
      }

      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (e) {
    return errorResponse(e);
  }
};
