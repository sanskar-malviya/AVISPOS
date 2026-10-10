# Avi's Food Corner — Cloud POS

A fast, touch-first point-of-sale web app for **Avi's Food Corner**, a vegetarian Indian food stall.
It runs full-screen on an Android tablet beside the counter. The cashier taps food photos, takes Cash or
UPI, and a Bluetooth thermal printer prints the receipt. An ordinary order takes about 10 seconds.

![Billing screen](docs/images/billing.png)

## What it does

| Area | Highlights |
|---|---|
| **Billing** | Large photo cards; one tap = +1; live quantity badges; +/−/remove; Clear Order with confirmation; grand total always visible |
| **Payment** | Cash or UPI only. UPI needs an explicit "customer has paid" confirmation; picking UPI never marks an order paid. Double-submit proof. |
| **Receipts** | 58 mm / 80 mm. Silent auto-print to a Bluetooth (BLE) ESC/POS printer, with a browser-print fallback. Retry and reprint never create a second sale. |
| **Offline-safe** | Orders made without internet are stored on the tablet, clearly flagged, and sync automatically when the connection returns. |
| **Owner area** | PIN-protected Settings: products (name, price, photo, available, on/off menu), business & receipt text, printer, staff accounts |
| **Reports** | Orders by date range, search by order number, order details, reprint, cancel/refund with reason, daily summary (Cash vs UPI, quantity per product), CSV export |
| **Security** | Owner/cashier roles, Firestore rules that reject tampered orders, server-side re-validation of every order, append-only audit log, sales never deletable |

## Tech stack

Everything runs on **free plans — no payment card needed**.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS, installable **PWA** (full-screen, landscape)
- **Hosting + server functions:** Netlify (auto-deploys from GitHub; `netlify.toml`, `netlify/functions`)
- **Database + logins:** Firebase **Spark (free)** — Firestore with offline persistence, Authentication
- **Money** is stored as **integer paise** everywhere; every order keeps a price snapshot, so later price
  changes never alter past receipts or reports.

```
 Android tablet (Chrome / installed PWA)            ┌────────── Firebase (free) ──────────┐
 ┌──────────────────────────────────────────┐       │ Auth (owner / cashier roles)        │
 │ Billing · Payment · Orders · Settings    │       │ Firestore + security rules          │
 │  ├ Firestore SDK + offline IndexedDB ────┼──────►│  (tampered orders rejected; price   │
 │  │  (orders queue & sync when online)    │       │   & cancel changes need an audit)   │
 │  ├ calls Netlify functions ──────┐       │       └──────────────▲──────────────────────┘
 │  └ Web Bluetooth ─► BLE printer  │       │                      │ Admin SDK
 └──────────────────────────────────┼───────┘       ┌──────────────┴──────────────────────┐
                                    └──────────────►│ Netlify (free)                      │
                                                    │  website (PWA)                      │
                                                    │  staff · process-orders (check      │
                                                    │  totals, number offline orders)     │
                                                    │  schedules: checks /10 min, nightly │
                                                    │  backup → Netlify Blobs             │
                                                    └─────────────────────────────────────┘
```

## Quick start (local, no cloud account needed)

Requires Node 20+ (22 recommended), the Firebase CLI (`npm i -g firebase-tools`) and Java 21 (for the emulators).

```bash
npm install
npm run dev:emu          # Firebase emulators + local server functions + app at http://localhost:5173
```

In a second terminal, load the menu and create an owner login (local emulators only):

```bash
npm run seed -- --emulator
npm run bootstrap-owner -- owner@aviz.test "Owner@12345" --emulator
```

Open <http://localhost:5173> and sign in. The emulator dashboard is at <http://localhost:4000>.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev:emu` | Local emulators + server functions + app (safe sandbox, nothing leaves the computer) |
| `npm run dev` | App against the real Firebase project in `.env` |
| `npm test` | Unit tests (cart, money, receipts, reports, server validation, backup format) |
| `npm run test:rules` | Firestore security-rules tests (starts the Firestore emulator itself) |
| `npm run test:e2e` | Full acceptance test in a real browser (needs `npm run dev:emu` running) |
| `npm run typecheck` | TypeScript check (app, server functions, scripts) |
| `npm run build` | Production build into `dist/` (Netlify runs this automatically) |
| `npm run deploy:rules` | Publish `firestore.rules` (or paste them into the Firebase console) |
| `npm run netlify-admin-env -- <key.json>` | Print the 3 secret Netlify settings from the admin key |
| `npm run seed` / `npm run bootstrap-owner` | One-off setup scripts (add `-- --emulator` for local) |
| `npm run restore-backup -- <files…>` | Restore downloaded daily backups |

## Documentation

| Guide | For |
|---|---|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Going live on free plans: Firebase + Netlify |
| [docs/ENV.md](docs/ENV.md) | Configuration files and how secrets are handled |
| [docs/SETUP.md](docs/SETUP.md) | Owner's first-time setup: products, prices, photos, receipt, staff |
| [docs/PRINTER.md](docs/PRINTER.md) | Choosing, pairing and troubleshooting the receipt printer |
| [docs/CASHIER_GUIDE.md](docs/CASHIER_GUIDE.md) | One-page guide for cashiers |
| [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md) | All 15 acceptance tests: automated results + on-device checklist |
| [docs/COSTS.md](docs/COSTS.md) | Hosting, database, printer and other running costs |
| [docs/BACKUP.md](docs/BACKUP.md) | Backups and the recovery process |

## Project layout

```
src/
  app/          routing, auth & role guards, layout, offline banner, shared live data
  screens/      Login, Billing, Payment, Orders, OrderDetail, Settings (+ settings/ tabs)
  components/   ProductCard, OrderPanel, QtyStepper, ReceiptPreview, ConfirmDialog, Toast…
  store/        cart (Zustand, persisted so a refresh never loses an order)
  data/         Firestore repositories + server-function calls (staff, order checks, backups)
  printer/      receipt layout, ESC/POS encoder, Web Bluetooth driver, browser-print fallback
  payments/     UPI confirmation strategy (manual now; gateway can be plugged in later)
  lib/          types, money (paise), formatting, reports/CSV, ids, Firebase init
netlify/        server functions (staff, process-orders, scheduled checks, backups) + shared lib
shared/         order validation + backup format (used by server and tests)
scripts/        seed, bootstrap-owner, restore-backup, netlify-admin-env, local functions server
tests/          unit tests, rules/ (security rules), e2e/ (browser acceptance test)
firestore.rules · firebase.json · netlify.toml
```

## Status

All automated checks pass: 33 unit tests, 30 security-rules tests and 43 end-to-end browser checks
covering acceptance tests 1–15. **It is not production-ready until the real tablet + printer workflow has
been tested.** Bluetooth printing in particular can only be proven on the actual hardware; see
[docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md).
