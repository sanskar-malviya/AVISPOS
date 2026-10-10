// Restore one or more daily backup files into Firestore.
//
//   npm run restore-backup -- day-20261010.json [day-20261011.json …] [--with-menu] [--emulator]
//
// Restores the orders, audit entries and order counters from each file.
// Existing documents with the same id are overwritten with the backed-up copy;
// nothing else is deleted. Add --with-menu to also restore products and
// business settings (from the LAST file given).
import { readFileSync } from 'node:fs';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { fromPlain, type BackupFile } from '../shared/backupFormat';
import { args, initAdmin } from './admin';

async function main() {
  const files = args();
  if (!files.length) {
    console.error('Usage: npm run restore-backup -- <backup.json> [...] [--with-menu] [--emulator]');
    process.exit(1);
  }
  initAdmin();
  const db = getFirestore();
  const withMenu = process.argv.includes('--with-menu');
  const revive = (v: unknown) =>
    fromPlain(v, (d) => Timestamp.fromDate(d)) as DocumentData;

  let last: BackupFile | undefined;
  for (const f of files) {
    const backup = JSON.parse(readFileSync(f, 'utf8')) as BackupFile;
    if (backup.format !== 'avis-pos-backup') throw new Error(`${f} is not a POS backup file`);
    const writer = db.bulkWriter();
    for (const d of backup.orders) writer.set(db.collection('orders').doc(d.id), revive(d.data));
    for (const d of backup.audit) writer.set(db.collection('audit').doc(d.id), revive(d.data));
    for (const d of backup.counters) writer.set(db.collection('counters').doc(d.id), revive(d.data));
    await writer.close();
    console.log(`✔ ${f}: ${backup.orders.length} orders, ${backup.audit.length} audit entries`);
    last = backup;
  }

  if (withMenu && last) {
    const writer = db.bulkWriter();
    for (const d of last.products) writer.set(db.collection('products').doc(d.id), revive(d.data));
    for (const d of last.settings) writer.set(db.collection('settings').doc(d.id), revive(d.data));
    await writer.close();
    console.log(`✔ Menu and settings restored from ${last.dateKey}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
