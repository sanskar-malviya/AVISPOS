// Load the default menu and business settings into an EMPTY database.
// Safe to re-run: existing products and settings are never overwritten.
//
//   npm run seed               (real project — needs GOOGLE_APPLICATION_CREDENTIALS)
//   npm run seed -- --emulator (local emulators)
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_PRODUCTS } from '../src/lib/defaultProducts';
import { initAdmin } from './admin';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

async function main() {
  initAdmin();
  const db = getFirestore();

  const products = await db.collection('products').limit(1).get();
  if (products.empty) {
    const batch = db.batch();
    const now = Date.now();
    DEFAULT_PRODUCTS.forEach((p, i) =>
      batch.set(db.collection('products').doc(slug(p.name)), {
        name: p.name,
        pricePaise: p.pricePaise,
        imageUrl: p.image,
        imagePath: '',
        active: true,
        available: true,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'seed-script',
      }),
    );
    await batch.commit();
    console.log(`✔ Added ${DEFAULT_PRODUCTS.length} default products:`);
    for (const p of DEFAULT_PRODUCTS) console.log(`   ${p.name.padEnd(15)} ₹${p.pricePaise / 100}`);
  } else {
    console.log('• Products already exist — left unchanged.');
  }

  const settingsRef = db.collection('settings').doc('business');
  if (!(await settingsRef.get()).exists) {
    await settingsRef.set({
      businessName: "AVI'S FOOD CORNER",
      tagline: '100% Vegetarian',
      contact: '',
      receiptHeader: '',
      receiptFooter: 'Thank you for visiting!',
      paperWidth: '58',
      printer: { type: 'none' },
      vegLabel: 'VEG',
      updatedBy: 'seed-script',
      updatedAt: Date.now(),
    });
    console.log('✔ Created default business settings.');
  } else {
    console.log('• Business settings already exist — left unchanged.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
