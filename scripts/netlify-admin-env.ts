// Turn a downloaded Firebase service-account key file into the three Netlify
// environment variables the server functions need.
//
//   npm run netlify-admin-env -- "C:\keys\avis-pos-admin.json"
//
// Copy the three printed lines into Netlify → Site configuration →
// Environment variables → Add a variable → "Import from a .env file", and tick
// "Contains secret values". Never paste them anywhere else.
import { readFileSync } from 'node:fs';

const path = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!path) {
  console.error('Usage: npm run netlify-admin-env -- <path-to-service-account.json>');
  process.exit(1);
}
const key = JSON.parse(readFileSync(path, 'utf8'));
if (!key.project_id || !key.client_email || !key.private_key) {
  console.error('That file is not a Firebase service-account key.');
  process.exit(1);
}
const oneLine = String(key.private_key).replace(/\r?\n/g, '\\n');
console.log('\n# ── Paste these three lines into Netlify (mark them as secret) ──');
console.log(`FIREBASE_ADMIN_PROJECT_ID=${key.project_id}`);
console.log(`FIREBASE_ADMIN_CLIENT_EMAIL=${key.client_email}`);
console.log(`FIREBASE_ADMIN_PRIVATE_KEY="${oneLine}"`);
console.log('# ─────────────────────────────────────────────────────────────────\n');
