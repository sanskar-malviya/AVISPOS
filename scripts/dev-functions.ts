// Local stand-in for Netlify Functions, used with the Firebase emulators
// (`npm run dev:emu`). Serves /.netlify/functions/<name> on port 8888; Vite
// proxies that path, exactly like Netlify does in production.
import { createServer } from 'node:http';
import { join } from 'node:path';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIREBASE_PROJECT_ID ??= 'demo-aviz-pos';
process.env.LOCAL_BLOBS_DIR ??= join(process.cwd(), '.local-backups');

type Handler = (req: Request) => Promise<Response>;
const handlers: Record<string, () => Promise<{ default: Handler }>> = {
  staff: () => import('../netlify/functions/staff.mts'),
  products: () => import('../netlify/functions/products.mts'),
  'process-orders': () => import('../netlify/functions/process-orders.mts'),
  backups: () => import('../netlify/functions/backups.mts'),
  // Scheduled functions can be run by hand locally: POST /.netlify/functions/<name>
  'process-orders-scheduled': () => import('../netlify/functions/process-orders-scheduled.mts'),
  'backup-daily': () => import('../netlify/functions/backup-daily.mts'),
};

const PORT = Number(process.env.FUNCTIONS_PORT || 8888);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const name = url.pathname.match(/^\/\.netlify\/functions\/([\w-]+)/)?.[1];
  const load = name ? handlers[name] : undefined;
  if (!load) {
    res.writeHead(404).end('Unknown function');
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });
  try {
    const response = await (await load()).default(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(`[${name}]`, e);
    res.writeHead(500).end('Function crashed');
  }
  console.log(`${req.method} /${name} → ${res.statusCode}`);
}).listen(PORT, () => console.log(`Netlify functions (local) on http://localhost:${PORT}`));
