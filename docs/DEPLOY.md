# Deploying

The POS is deployed in two parts:

| Part | Where | Contains | How it updates |
|---|---|---|---|
| **Website** (the app the tablet opens) | **Netlify** | the built PWA (`dist/`) | Automatically on every push to GitHub |
| **Backend** | **Firebase** | database + security rules, logins, photo storage, Cloud Functions | `npm run deploy` (only when rules or functions change) |

The first time takes about 45 minutes. You need a Google account and a payment card for Firebase's Blaze
plan; at a single stall's volume the expected bill is about ₹0 ([COSTS.md](COSTS.md)). You also need a free
Netlify account.

## 0. Before you start

- **Use a Firebase project dedicated to the POS.** Deploying replaces the project's *entire* Firestore and
  Storage security rules, which would break any other app using that project. This POS uses
  `wabot-66e7c`, confirmed as dedicated.
- Install on the computer you deploy from:
  - Node.js 22 LTS — <https://nodejs.org>
  - Firebase CLI — `npm install -g firebase-tools`
  - Java 21 (only needed for the local emulators/tests) — <https://adoptium.net>

## 1. Set up the Firebase project (one time)

In the [Firebase console](https://console.firebase.google.com):

1. **Create the project** (Google Analytics is not needed), or open the existing one.
2. **Upgrade to Blaze:** bottom-left, click *Spark → Upgrade*. Then in Google Cloud Billing set a
   **budget alert** (e.g. ₹500/month) so you are emailed long before any real spend.
3. **Authentication → Get started → Sign-in method → Email/Password → Enable.**
4. **Firestore Database → Create database → Production mode → Location `asia-south1 (Mumbai)`.**
   The location can't be changed later. If the database is in a different region, change `asia-south1`
   in `functions/src/index.ts` **and** `src/lib/firebase/index.ts` to match.
5. **Storage → Get started** (production mode).
6. **Project settings → General → Your apps → Web (`</>`)** → register an app and copy the six config
   values. You'll need them for `.env` (step 2) and for Netlify (step 4).

## 2. Configure this code

```bash
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Fill `.env` with the six values ([ENV.md](ENV.md) explains each one). Then:

```bash
firebase login                # opens the browser; sign in with the project owner's Google account
firebase use default          # .firebaserc already maps "default" to wabot-66e7c
npm install
npm --prefix functions install
```

## 3. Deploy the backend (Firebase)

```bash
npm run deploy
```

This deploys the Firestore rules, Storage rules and Cloud Functions. On the first Functions deploy the CLI
may:

- ask to enable some Google Cloud APIs — answer **yes**;
- ask about an **Artifact Registry cleanup policy** — answer **yes** (keeps storage costs at ~₹0).

> **Windows tip:** *"Cannot determine backend specification. Timeout after 10000"* means the antivirus is
> slowing the first Functions load. `npm run deploy` already sets `FUNCTIONS_DISCOVERY_TIMEOUT=60`. If you
> run `firebase deploy` directly, set it yourself first (PowerShell: `$env:FUNCTIONS_DISCOVERY_TIMEOUT=60`).

## 4. Deploy the website (Netlify)

**Recommended: connect the GitHub repository** so every push deploys automatically.

1. Sign in at <https://app.netlify.com> → **Add new site → Import an existing project → GitHub** → choose
   the `AVISPOS` repository. (Netlify asks for permission to read the repo the first time.)
2. Netlify reads `netlify.toml`, so the build settings fill themselves in: build command `npm run build`,
   publish directory `dist`, Node 22. Leave them as they are.
3. Expand **Environment variables** (or later: *Site configuration → Environment variables*) and add the six
   values from step 1.6, with exactly these names:

   | Key | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `AIza…` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `wabot-66e7c.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `wabot-66e7c` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `wabot-66e7c.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `567705918379` |
   | `VITE_FIREBASE_APP_ID` | `1:567705918379:web:…` |

4. Click **Deploy**. After about a minute the site is live at an address like `https://random-name.netlify.app`.
5. Optional: *Site configuration → Change site name* to something like `avis-pos`, giving
   `https://avis-pos.netlify.app`.
6. In **Firebase console → Authentication → Settings → Authorized domains**, add your Netlify address
   (e.g. `avis-pos.netlify.app`).

If the site shows **"App is not configured"**, an environment variable is missing or misspelled. Fix it,
then *Deploys → Trigger deploy → Deploy site*.

**Without GitHub (manual upload):** after `npm run build` (which uses your local `.env`):

```bash
npx netlify-cli login
npx netlify-cli deploy --prod --dir dist
```

> Firebase Hosting also still works if you ever prefer a single provider: `npm run deploy:firebase-hosting`.

## 5. Create the owner account and default menu

These one-off scripts need an **Admin service-account key**:

1. Firebase console → *Project settings → Service accounts → Generate new private key*.
2. Save the file **outside this folder** (e.g. `C:\keys\avis-pos-admin.json`). Never commit or share it.
3. Run (PowerShell):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\avis-pos-admin.json"
npm run bootstrap-owner -- owner@yourmail.com "a-strong-password"
npm run seed
```

`seed` adds the five default products and business settings, and only fills an empty database. After this
you can delete the key file. All further staff accounts are created from inside the app (*Settings → PIN &
staff*).

## 6. Set up the tablet

1. On the Android tablet, open **Chrome** at the Netlify address and sign in with the owner account.
2. Chrome menu → **Install app** (or *Add to Home screen*). It now opens full-screen in landscape.
3. Follow [SETUP.md](SETUP.md): set an owner PIN, check products/photos, choose the printer, create a
   cashier account.
4. Day to day, sign the tablet in with the **cashier** account.
5. Optional kiosk lock: Android *Settings → Security → App pinning*, then pin the POS app.

## Updating later

- **App changes:** push to GitHub and Netlify rebuilds and publishes automatically. Installed tablets pick
  up the new version the next time the app is opened while online.
- **Rules or Cloud Functions changes** (`firestore.rules`, `storage.rules`, `functions/`): also run
  `npm run deploy`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "App is not configured" | Netlify environment variables missing (step 4.3), then redeploy |
| "Page not found" when refreshing a page | `netlify.toml` missing from the repo (it provides the single-page-app redirect) |
| "Missing or insufficient permissions" after sign-in | The account has no role. The owner should set one under *Settings → PIN & staff*. The user must then sign out and in again. |
| Staff list says the server can't be reached | Functions not deployed, or the region doesn't match the Firestore location (step 1.4) |
| Orders never show "Verified" in order details | Check *Firebase console → Functions → Logs* for `onOrderCreated` errors |
| Bluetooth printer not found | See [PRINTER.md](PRINTER.md) |
