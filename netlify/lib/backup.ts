// Daily backups to Netlify Blobs (spec §11). Firebase's managed backups need
// the paid plan, so each business day's data is saved here instead: that day's
// orders, audit entries and counter, plus a copy of the menu and settings.
import { Timestamp, type Firestore, type QuerySnapshot } from 'firebase-admin/firestore';
import {
  istDayBounds,
  toPlain,
  type BackupDoc,
  type BackupFile,
} from '../../shared/backupFormat';
import { backupStore } from './blobStore';

const docs = (snap: QuerySnapshot): BackupDoc[] =>
  snap.docs.map((d) => ({ id: d.id, data: toPlain(d.data()) }));

export async function buildBackup(db: Firestore, dateKey: string): Promise<BackupFile> {
  const { start, end } = istDayBounds(dateKey);
  const [orders, audit, products, business, counter] = await Promise.all([
    db.collection('orders').where('dateKey', '==', dateKey).get(),
    db
      .collection('audit')
      .where('at', '>=', Timestamp.fromMillis(start))
      .where('at', '<', Timestamp.fromMillis(end))
      .get(),
    db.collection('products').get(),
    db.collection('settings').doc('business').get(),
    db.collection('counters').doc(dateKey).get(),
  ]);
  return {
    format: 'avis-pos-backup',
    version: 1,
    dateKey,
    createdAt: new Date().toISOString(),
    orders: docs(orders),
    audit: docs(audit),
    products: docs(products),
    settings: business.exists ? [{ id: 'business', data: toPlain(business.data()) }] : [],
    counters: counter.exists ? [{ id: dateKey, data: toPlain(counter.data()) }] : [],
  };
}

export const backupKey = (dateKey: string) => `day-${dateKey}.json`;

export async function saveBackup(db: Firestore, dateKey: string) {
  const file = await buildBackup(db, dateKey);
  const store = await backupStore();
  await store.set(backupKey(dateKey), JSON.stringify(file));
  return { key: backupKey(dateKey), orders: file.orders.length, audit: file.audit.length };
}
