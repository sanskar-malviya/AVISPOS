// Load the default menu and business settings into an EMPTY database. On an
// existing database, only default menu items it doesn't have yet are added.
// Safe to re-run: existing products and settings are never overwritten.
//
//   npm run seed               (real project — needs GOOGLE_APPLICATION_CREDENTIALS)
//   npm run seed -- --emulator (local emulators)
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  DEFAULT_PRODUCTS,
  defaultProductId,
  missingDefaultProducts,
} from '../src/lib/defaultProducts';
import { initAdmin } from './admin';

async function main() {
  initAdmin();
  const db = getFirestore();

  const products = await db.collection('products').get();
  const existing = products.docs.map((d) => ({
    id: d.id,
    name: String(d.get('name') ?? ''),
    sortOrder: Number(d.get('sortOrder') ?? 0),
  }));
  const toAdd = products.empty ? DEFAULT_PRODUCTS : missingDefaultProducts(existing);
  const firstSortOrder = Math.max(-1, ...existing.map((p) => p.sortOrder)) + 1;
  if (toAdd.length > 0) {
    const batch = db.batch();
    const now = Date.now();
    toAdd.forEach((p, i) => {
      const id = defaultProductId(p.name);
      const auditId = `price-${id}-${now}`;
      batch.set(db.collection('products').doc(id), {
        name: p.name,
        pricePaise: p.pricePaise,
        imageUrl: p.image,
        imagePath: '',
        active: true,
        available: true,
        sortOrder: firstSortOrder + i,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'seed-script',
        lastPriceAuditId: auditId,
      });
      // Starting price recorded in the price history, like any other change.
      batch.set(db.collection('audit').doc(auditId), {
        type: 'price_change',
        productId: id,
        productName: p.name,
        beforePaise: null,
        afterPaise: p.pricePaise,
        who: 'seed-script',
        at: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    console.log(`✔ Added ${toAdd.length} default products:`);
    for (const p of toAdd) console.log(`   ${p.name.padEnd(15)} ₹${p.pricePaise / 100}`);
  } else {
    console.log('• All default products already exist — left unchanged.');
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
