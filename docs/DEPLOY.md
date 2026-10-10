# Deploying to Firebase

This takes about 30–45 minutes the first time. You need a Google account and a payment card. The card is
for Firebase's Blaze plan; at a single stall's volume the expected bill is about ₹0 (see [COSTS.md](COSTS.md)).

## 0. Before you start

- **Use a Firebase project dedicated to the POS.** Deploying replaces the project's *entire* Firestore and
  Storage security rules. If the project is already used by another app, that app will stop working.
  If in doubt, create a new project (e.g. `aviz-pos`).
- Install on the computer you deploy from:
  - Node.js 22 LTS — <https://nodejs.org>
  - Firebase CLI — `npm install -g firebase-tools`
  - Java 21 (only needed for the local emulators/tests) — <https://adoptium.net>

## 1. Create and configure the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. **Create project** (Google Analytics is not needed).
2. **Upgrade to Blaze:** bottom-left, click *Spark → Upgrade*. Then in Google Cloud Billing set a
   **budget alert** (e.g. ₹500/month) so you are emailed long before any real spend.
3. **Authentication → Get started → Sign-in method → Email/Password → Enable.**
4. **Firestore Database → Create database → Production mode → Location `asia-south1 (Mumbai)`.**
   The location cannot be changed later. If you pick a different region, change `asia-south1` in
   `functions/src/index.ts` **and** `src/lib/firebase/index.ts` to match.
5. **Storage → Get started** (production mode, same region if offered).
6. **Project settings → General → Your apps → Web (`</>`)** → register an app (no Hosting checkbox needed) and
   copy the config values.

## 2. Configure this code

```bash
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Fill `.env` with the six values from step 1.6 ([ENV.md](ENV.md) explains each one). Then point the CLI at
your project:

```bash
firebase login
firebase use --add            # pick your project, alias it "default"
npm install
npm --prefix functions install
```

## 3. Deploy

```bash
npm run deploy
```

This builds the app and deploys Hosting, Firestore rules, Storage rules and Cloud Functions. On the first
Functions deploy the CLI may:

- ask to enable some Google Cloud APIs — answer **yes**;
- ask about an **Artifact Registry cleanup policy** — answer **yes** (keeps storage costs at ~₹0).

When it finishes it prints the app URL, e.g. `https://aviz-pos.web.app`.

> **Windows tip:** if you see *"Cannot determine backend specification. Timeout after 10000"*, the
> antivirus is slowing the first Functions load. `npm run deploy` already sets
> `FUNCTIONS_DISCOVERY_TIMEOUT=60`; if you run `firebase deploy` directly, set it yourself first
> (PowerShell: `$env:FUNCTIONS_DISCOVERY_TIMEOUT=60`).

## 4. Create the owner account and default menu

These one-off scripts need an **Admin service-account key**:

1. Firebase console → *Project settings → Service accounts → Generate new private key*.
2. Save the file **outside this folder** (e.g. `C:\keys\aviz-pos-admin.json`). Never commit or share it.
3. Run (PowerShell):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\aviz-pos-admin.json"
npm run bootstrap-owner -- owner@yourmail.com "a-strong-password"
npm run seed
```

`seed` adds the five default products and business settings, and only fills an empty database. After this
you can delete the key file. All further staff accounts are created from inside the app (*Settings → PIN &
staff*).

## 5. Set up the tablet

1. On the Android tablet, open **Chrome** at the app URL and sign in with the owner account.
2. Chrome menu → **Install app** (or *Add to Home screen*). It now opens full-screen in landscape.
3. Follow [SETUP.md](SETUP.md): set an owner PIN, check products/photos, choose the printer, create a
   cashier account.
4. Day to day, sign the tablet in with the **cashier** account.
5. Optional kiosk lock: Android *Settings → Security → App pinning*, then pin the POS app.

## Updating later

Pull the new code, then run `npm run deploy`. Installed tablets pick up the new version automatically the
next time the app is opened while online.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Missing or insufficient permissions" after sign-in | The account has no role. The owner should set one under *Settings → PIN & staff*. The user must then sign out and in again. |
| Staff list says the server can't be reached | Functions not deployed, or the region doesn't match the Firestore location (step 1.4). |
| Orders never show "Verified" in order details | Check *Firebase console → Functions → Logs* for `onOrderCreated` errors. |
| Bluetooth printer not found | See [PRINTER.md](PRINTER.md). |
