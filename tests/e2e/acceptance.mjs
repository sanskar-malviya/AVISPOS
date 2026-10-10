// End-to-end acceptance test (spec §13) — drives the real app in a browser
// against the LOCAL Firebase emulators and checks the data that was saved.
//
//   1. In one terminal:   npm run dev:emu      (emulators + app on :5173)
//   2. In another:        npm run test:e2e
//
// Uses an installed browser (Microsoft Edge by default; set E2E_BROWSER=chrome
// for Google Chrome). WARNING: it wipes the EMULATOR's data (demo-aviz-pos)
// before running — it never touches a real Firebase project.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const SHOTS = join(here, 'screenshots');
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const PROJECT = 'demo-aviz-pos';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

// Fresh emulator state: wipe data, load the default menu, create the owner.
try {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
} catch {
  console.error('Cannot reach the Firebase emulators. Start them first with:  npm run dev:emu');
  process.exit(1);
}
rmSync(join(root, '.local-backups'), { recursive: true, force: true });
execSync('npx tsx scripts/seed.ts --emulator', { cwd: root, stdio: 'ignore' });
execSync('npx tsx scripts/bootstrap-owner.ts owner@aviz.test Owner@12345 --emulator', { cwd: root, stdio: 'ignore' });

initializeApp({ projectId: PROJECT });
const db = getFirestore();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeout = 15000, every = 300) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    await sleep(every);
  }
  return undefined;
}
const orders = async () => (await db.collection('orders').get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER || 'msedge',
  headless: process.env.E2E_HEADED !== '1',
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/queued order write|WebChannel|net::ERR_INTERNET_DISCONNECTED|Could not reach Cloud Firestore/i.test(m.text()))
    pageErrors.push('console: ' + m.text());
});
const shot = (n) => page.screenshot({ path: join(SHOTS, `${n}.png`) });

const menuSection = () => page.locator('main section').first();
const card = (name) => menuSection().locator('button', { hasText: name });
const aside = () => page.locator('aside');
const asideText = async () => (await aside().innerText()).replace(/\s+/g, ' ');

async function login(email, password) {
  await page.goto(BASE + '/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Current Order').waitFor({ timeout: 20000 });
  await card('Vada Pav').waitFor({ timeout: 20000 });
}

async function payCash() {
  await page.getByRole('button', { name: /Continue to Payment/ }).click();
  await page.getByRole('button', { name: 'Cash', exact: true }).click();
  await page.getByRole('button', { name: /Cash Received/ }).click();
  await page.getByText('Payment received').waitFor({ timeout: 20000 });
}

try {
  // ── Login & menu ─────────────────────────────────────────────────────────
  await page.goto(BASE);
  check('Unauthenticated user is sent to the login screen', page.url().includes('/login') || (await page.waitForURL(/login/, { timeout: 10000 }).then(() => true)));
  await shot('01-login');
  await login('owner@aviz.test', 'Owner@12345');
  await shot('02-billing-empty');

  const expected = { 'Chole Bhature': 90, 'Pav Bhaji': 70, 'Veg Biryani': 50, 'Chole Kulche': 60, 'Vada Pav': 30 };
  let pricesOk = true;
  for (const [n, p] of Object.entries(expected)) {
    const t = await card(n).innerText();
    if (!t.includes(`₹${p}`)) pricesOk = false;
  }
  check('T4  Five default products show the correct prices', pricesOk);
  const imgsLoaded = await page.evaluate(() =>
    [...document.querySelectorAll('main section img')].every((i) => i.complete && i.naturalWidth > 0),
  );
  check('     Product photos load', imgsLoaded);
  check('     Empty cart message shown', (await asideText()).includes('No items yet'));

  // ── Cart behaviour ───────────────────────────────────────────────────────
  const t0 = Date.now();
  await card('Chole Bhature').tap();
  await card('Chole Bhature').tap();
  const badge = await card('Chole Bhature').locator('span.rounded-full').innerText();
  const lines = await aside().locator('li').count();
  check('T1  Tapping Chole Bhature twice shows quantity 2 (one line)', badge === '2' && lines === 1, `badge=${badge}, lines=${lines}`);

  await card('Vada Pav').tap();
  check('T2  Multiple products give the correct grand total (₹210)', /Total ₹210/.test(await asideText()));

  await aside().locator('li', { hasText: 'Chole Bhature' }).getByLabel('Decrease quantity').tap();
  const afterDec = /Total ₹120/.test(await asideText());
  await aside().getByLabel('Remove Vada Pav').tap();
  const afterRemove = /Total ₹90/.test(await asideText());
  await aside().locator('li', { hasText: 'Chole Bhature' }).getByLabel('Decrease quantity').tap();
  const emptyAgain = (await asideText()).includes('No items yet');
  check('T3  Decrease / remove update the total instantly; qty 0 removes the line', afterDec && afterRemove && emptyAgain);

  await card('Chole Bhature').tap();
  await card('Chole Bhature').tap();
  await card('Vada Pav').tap();
  await shot('03-billing-order');

  await aside().getByRole('button', { name: 'Clear Order' }).tap();
  const dialogShown = await page.getByRole('dialog').isVisible();
  await page.getByRole('button', { name: 'Cancel' }).tap();
  check('     Clear Order asks for confirmation (cancel keeps items)', dialogShown && /Total ₹210/.test(await asideText()));

  // ── Payment: UPI ─────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /Continue to Payment/ }).tap();
  await page.getByText('Amount payable').waitFor();
  check('     Payment screen shows amount payable ₹210', (await page.locator('main').innerText()).includes('₹210'));
  await page.getByRole('button', { name: /Back to Order/ }).tap();
  await page.getByText('Current Order').waitFor();
  check('     Back to Order keeps the selected items', /Total ₹210/.test(await asideText()));
  await page.getByRole('button', { name: /Continue to Payment/ }).tap();
  await page.getByRole('button', { name: 'UPI', exact: true }).tap();
  await shot('04-payment-upi');
  await page.getByRole('button', { name: /Customer Has Paid/ }).tap();
  await page.getByRole('dialog').waitFor();
  await shot('05-upi-confirm');
  const beforeConfirm = (await orders()).length;
  await page.getByRole('button', { name: 'Not yet' }).tap();
  const stillNone = (await orders()).length;
  check('T8  Selecting UPI does not mark anything paid (no order until confirmed)', beforeConfirm === 0 && stillNone === 0);

  await page.getByRole('button', { name: /Customer Has Paid/ }).tap();
  await page.getByRole('button', { name: 'Yes, payment received' }).tap();
  await page.getByText('Payment received').waitFor({ timeout: 20000 });
  const elapsed = Date.now() - t0;
  await shot('06-success');
  let all = await orders();
  const o1 = all[0];
  check(
    'T7/T9  UPI order saved once, paid, with a unique order number',
    all.length === 1 && o1.paymentMethod === 'upi' && o1.paymentStatus === 'paid' && /^\d{8}-0001$/.test(o1.orderNumber),
    o1 && `${o1.orderNumber}`,
  );
  check(
    '     Order stores a snapshot of name, unit price, qty, line total',
    o1.items.length === 2 &&
      o1.items.some((i) => i.name === 'Chole Bhature' && i.unitPricePaise === 9000 && i.qty === 2 && i.lineTotalPaise === 18000) &&
      o1.grandTotalPaise === 21000,
  );
  const validated = await waitFor(async () => {
    const d = await db.doc(`orders/${o1.id}`).get();
    return d.get('checked') === true && d.get('validated') === true;
  }, 20000);
  check('     Server checked the order within seconds (process-orders function)', !!validated);

  const receipt = await page.getByLabel('Receipt preview').innerText();
  check(
    'T10 Receipt shows items, quantities, totals and payment method',
    /Chole Bhature\s+2\s+₹180/.test(receipt) && /Vada Pav\s+1\s+₹30/.test(receipt) && /TOTAL:\s+₹210/.test(receipt) && receipt.includes('Payment: UPI') && receipt.includes(o1.orderNumber),
  );

  // Printing: no printer configured → manual browser print (headless browsers
  // return from print() immediately, so no dialog blocks the test).
  const statusTxt = await page.getByRole('status').filter({ hasText: /printer/i }).first().innerText();
  check('     With no printer set up, the screen says so (no false "printed" claim)', /No printer set up/.test(statusTxt));
  await page.getByRole('button', { name: 'Print Receipt' }).tap();
  const p1 = await waitFor(async () => /Print dialog opened/.test(await page.locator('main').innerText()), 8000);
  await page.getByRole('button', { name: 'Print Receipt' }).tap();
  await sleep(1500);
  all = await orders();
  const rp = await waitFor(async () => (await db.doc(`orders/${o1.id}`).get()).get('reprintCount') === 1, 8000);
  check('T11 Printing twice creates no new sale (second print counted as a reprint)', !!p1 && all.length === 1 && !!rp);

  await page.getByRole('button', { name: /New Order/ }).tap();
  await page.getByText('Current Order').waitFor();
  check('     "New Order" returns to a fresh billing screen', (await asideText()).includes('No items yet'));
  check('T15 Ordinary order completed quickly', elapsed < 30000, `${(elapsed / 1000).toFixed(1)}s for a scripted run incl. checks`);

  // ── Cash order ───────────────────────────────────────────────────────────
  await card('Pav Bhaji').tap();
  await payCash();
  all = await orders();
  check('T7  Cash order completes', all.length === 2 && all.some((o) => o.paymentMethod === 'cash' && o.grandTotalPaise === 7000));
  await page.getByRole('button', { name: /New Order/ }).tap();

  // ── Owner changes a price ────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByText('Load default menu').or(page.locator('li', { hasText: 'Vada Pav' })).first().waitFor();
  await shot('07-settings-products');
  await page.locator('li', { hasText: 'Vada Pav' }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('form input[type=number]').fill('35');
  // Replace the photo too (stored inside the product on the free plan).
  await page.locator('form input[type=file]').setInputFiles(join(root, 'public/products/vada-pav.jpg'));
  await shot('08-edit-price');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const priceSaved = await waitFor(async () => (await db.doc('products/vada-pav').get()).get('pricePaise') === 3500);
  check('     Owner can change a price (saved to cloud)', !!priceSaved);
  const photo = String((await db.doc('products/vada-pav').get()).get('imageUrl') ?? '');
  check(
    '     Owner can replace a product photo (resized, stored with the product)',
    photo.startsWith('data:image/jpeg') && photo.length < 400000,
    `${Math.round(photo.length / 1024)} KB`,
  );
  const priceAudit = await waitFor(async () => {
    const a = await db.collection('audit').where('type', '==', 'price_change').get();
    return a.docs.some((d) => d.get('productId') === 'vada-pav' && d.get('afterPaise') === 3500 && d.get('beforePaise') === 3000);
  });
  check('     Price change recorded in the audit trail', !!priceAudit);

  await page.getByRole('link', { name: 'Billing' }).click();
  await card('Vada Pav').waitFor();
  check('     New price appears on the billing screen immediately', (await card('Vada Pav').innerText()).includes('₹35'));
  await card('Vada Pav').tap();
  check('     Cart uses the new price', /Total ₹35/.test(await asideText()));
  await payCash();
  all = await orders();
  const newVp = all.find((o) => o.items.length === 1 && o.items[0].productId === 'vada-pav');
  const oldOrder = (await db.doc(`orders/${o1.id}`).get()).data();
  const oldVp = oldOrder.items.find((i) => i.productId === 'vada-pav');
  check('T5  New price is used on future orders', newVp?.items[0].unitPricePaise === 3500);
  check('T6  Earlier completed order keeps its original price (₹30)', oldVp.unitPricePaise === 3000 && oldOrder.grandTotalPaise === 21000);
  await page.getByRole('button', { name: /New Order/ }).tap();

  // ── Orders & reports ─────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Orders' }).click();
  await page.getByText('Sales summary').waitFor();
  await waitFor(async () => (await page.locator('main').innerText()).includes('₹315'), 10000);
  let mainTxt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  check(
    'T12 Daily summary: total ₹315, Cash ₹105, UPI ₹210, 3 orders',
    /Completed orders 3/.test(mainTxt) && /Total collected ₹315/.test(mainTxt) && /Cash ₹105/.test(mainTxt) && /UPI ₹210/.test(mainTxt),
  );
  check('     Quantity sold per product listed', /Chole Bhature 2/.test(mainTxt) && /Vada Pav 2/.test(mainTxt) && /Pav Bhaji 1/.test(mainTxt));
  await shot('09-orders');

  // Search by order number
  await page.getByPlaceholder('Search order number…').fill(o1.orderNumber);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByText('Order details').waitFor();
  check('     Search by order number opens the order', (await page.locator('main').innerText()).includes(o1.orderNumber));
  await page.getByRole('button', { name: /Reprint Receipt/ }).click();
  const rp2 = await waitFor(async () => (await db.doc(`orders/${o1.id}`).get()).get('reprintCount') === 2, 8000);
  check('     Reprint from history only increments the reprint count', !!rp2 && (await orders()).length === 3);
  await shot('10-order-detail');

  // Cancel the Pav Bhaji order
  await page.goto(BASE + '/orders');
  await page.locator('main li', { hasText: 'Pav Bhaji' }).click();
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.locator('textarea').fill('Customer changed mind');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
  await page.getByText(/cancelled — Customer changed mind/).waitFor({ timeout: 10000 });
  const cancelAudit = await waitFor(async () => !(await db.collection('audit').where('type', '==', 'order_cancel').get()).empty);
  check('     Owner can cancel an order; audit entry recorded', !!cancelAudit);
  await page.goto(BASE + '/orders');
  await waitFor(async () => (await page.locator('main').innerText()).includes('₹245'), 10000);
  mainTxt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  check('     Cancelled order excluded from sales (₹245) and shown transparently', /Total collected ₹245/.test(mainTxt) && /1 cancelled/.test(mainTxt));

  // ── Offline sale ─────────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Billing' }).click();
  await card('Veg Biryani').waitFor();
  const before = (await orders()).length;
  await context.setOffline(true);
  await page.getByText(/Offline — orders are being saved/).waitFor({ timeout: 5000 });
  await card('Veg Biryani').tap();
  await shot('11-offline-billing');
  await payCash();
  const offTxt = await page.locator('main').innerText();
  await shot('12-offline-success');
  const offNum = (offTxt.match(/OFF-[A-Za-z0-9]+-\d{8}-\d{3}/) || [])[0];
  check('T13 Offline: order completes, shows "saved on this device" + provisional number', /Saved on this device/.test(offTxt) && !!offNum, offNum);
  check('     Offline order not yet in the cloud', (await orders()).length === before);
  await context.setOffline(false);
  const synced = await waitFor(async () => {
    const list = await orders();
    const o = list.find((x) => x.provisionalNumber === offNum);
    return o && /^\d{8}-\d{4}$/.test(o.orderNumber) && o.checked === true && o.validated === true ? o : undefined;
  }, 40000, 1000);
  check('T13 After reconnect the order syncs and gets a canonical number', !!synced, synced ? `${offNum} → ${synced.orderNumber}` : 'not synced');
  await page.getByRole('button', { name: /New Order/ }).tap();

  // ── Owner PIN ────────────────────────────────────────────────────────────
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'PIN, staff & backups' }).click();
  const pins = page.locator('input[type=password]');
  await pins.nth(0).fill('1234');
  await pins.nth(1).fill('1234');
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await page.getByText('Owner PIN set').waitFor();
  await page.getByRole('link', { name: 'Billing' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByText('Enter the PIN to open Settings').waitFor();
  await shot('13-pin');
  for (const d of '9999') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: '✓' }).click();
  const wrong = await page.getByText(/Wrong PIN/).isVisible();
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: '✓' }).click();
  await page.getByRole('button', { name: 'Business & receipt' }).waitFor();
  check('     Settings protected by owner PIN (wrong PIN rejected, right PIN opens)', wrong);

  // ── Staff: create a cashier via the staff server function ────────────────
  await page.getByRole('button', { name: 'PIN, staff & backups' }).click();
  await page.locator('form input[type=email]').fill('cashier@aviz.test');
  await page.locator('input[autocomplete="new-password"]').fill('Cashier@123');
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByText('Account created for cashier@aviz.test').waitFor({ timeout: 20000 });
  check('     Owner can create a cashier account', true);

  // ── Backups ──────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Back up today now' }).click();
  await page.getByText(/Backed up today \(\d+ orders\)/).waitFor({ timeout: 20000 });
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /Download/ }).first().click();
  const download = await dl;
  const backupPath = join(SHOTS, 'backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  check(
    '     Owner can back up today and download the file (all of today\'s orders + menu)',
    backup.format === 'avis-pos-backup' && backup.orders.length === (await orders()).length && backup.products.length === 5,
    `${backup.orders.length} orders, ${backup.audit.length} audit entries`,
  );
  await shot('14-staff-backups');

  // ── Cashier role ─────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login('cashier@aviz.test', 'Cashier@123');
  const navTxt = await page.locator('header').innerText();
  await page.goto(BASE + '/settings');
  await page.getByText('Current Order').waitFor();
  const blocked = !page.url().includes('/settings');
  check('     Cashier cannot see or open Orders/Settings', !/Settings|Orders/.test(navTxt) && blocked);
  await card('Chole Kulche').tap();
  await payCash();
  check('     Cashier can complete a sale', (await orders()).some((o) => o.items[0]?.productId === 'chole-kulche'));
  await shot('15-cashier-success');

  // ── Tablet usability ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: /New Order/ }).tap();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button')]
      .filter((b) => b.offsetParent)
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.height < 40).length,
  );
  const scroll = await page.evaluate(() => {
    const s = document.querySelector('main section');
    return s.scrollHeight <= s.clientHeight + 1;
  });
  check('T14 Billing fits a landscape tablet: all products visible without scrolling, large touch targets', scroll && small === 0, `small buttons=${small}`);

  check('     No JavaScript errors during the run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (e) {
  check('E2E run completed without an unexpected error', false, String(e).split('\n')[0]);
  await shot('99-error').catch(() => {});
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  // Closing can reject navigations still in flight (e.g. auto-return timers);
  // that's harmless at this point, so don't let it mask the result.
  process.on('unhandledRejection', () => {});
  await browser.close().catch(() => {});
  process.exit(failed.length ? 1 : 0);
}
