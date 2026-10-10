// Safety net: every 10 minutes, check any orders the app's own trigger missed
// (e.g. the tablet went offline again straight after reconnecting).
import { adminDb } from '../lib/admin';
import { processPendingOrders } from '../lib/processOrders';

export default async (): Promise<Response> => {
  const result = await processPendingOrders(adminDb());
  if (result.processed) console.log('[process-orders-scheduled]', result);
  return new Response('ok');
};

export const config = { schedule: '*/10 * * * *' };
