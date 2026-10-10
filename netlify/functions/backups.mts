// Owner-only access to the daily backups.
//   GET  /.netlify/functions/backups            → { backups: [{ key, dateKey }] } newest first
//   GET  /.netlify/functions/backups?key=…      → the backup file (JSON download)
//   POST /.netlify/functions/backups { dateKey } → back up that day now
import { adminDb } from '../lib/admin';
import { requireRole } from '../lib/auth';
import { saveBackup } from '../lib/backup';
import { backupStore } from '../lib/blobStore';
import { errorResponse, HttpError, json, readJson } from '../lib/http';

export default async (req: Request): Promise<Response> => {
  try {
    await requireRole(req, ['owner']);
    const store = await backupStore();

    if (req.method === 'GET') {
      const key = new URL(req.url).searchParams.get('key');
      if (key) {
        const body = await store.get(key);
        if (body === null) throw new HttpError(404, 'Backup not found.');
        return new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="avis-pos-${key}"`,
            'Cache-Control': 'no-store',
          },
        });
      }
      const backups = (await store.list())
        .map((k) => ({ key: k, dateKey: (k.match(/^day-(\d{8})\.json$/) ?? [])[1] ?? '' }))
        .filter((b) => b.dateKey)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .slice(0, 90);
      return json(200, { backups });
    }

    if (req.method === 'POST') {
      const { dateKey } = await readJson(req);
      if (typeof dateKey !== 'string' || !/^\d{8}$/.test(dateKey)) {
        throw new HttpError(400, 'dateKey must be YYYYMMDD.');
      }
      return json(200, await saveBackup(adminDb(), dateKey));
    }

    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return errorResponse(e);
  }
};
