// Every night at 00:15 India time, back up the business day that just ended
// (and re-save the day before, in case the previous run was missed).
import { adminDb } from '../lib/admin';
import { saveBackup } from '../lib/backup';
import { istDateKey } from '../../shared/backupFormat';

const DAY = 24 * 60 * 60 * 1000;

export default async (): Promise<Response> => {
  const db = adminDb();
  const now = Date.now();
  for (const dk of [istDateKey(now - DAY), istDateKey(now - 2 * DAY)]) {
    console.log('[backup-daily]', dk, await saveBackup(db, dk));
  }
  return new Response('ok');
};

// 18:45 UTC = 00:15 IST
export const config = { schedule: '45 18 * * *' };
