// POST /.netlify/functions/process-orders — check new orders now.
// Called by the app right after a sale and whenever the tablet comes back
// online, so orders are verified (and offline ones renumbered) within seconds.
// Any signed-in staff member may trigger it; it only processes pending orders.
import { adminDb } from '../lib/admin';
import { requireRole } from '../lib/auth';
import { errorResponse, json } from '../lib/http';
import { processPendingOrders } from '../lib/processOrders';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    await requireRole(req, ['owner', 'cashier']);
    return json(200, await processPendingOrders(adminDb()));
  } catch (e) {
    return errorResponse(e);
  }
};
