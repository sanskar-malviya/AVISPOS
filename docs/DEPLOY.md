# Deploying (no payment card needed)

The POS runs entirely on **free plans**:

| Part | Service (free plan) | Contains | How it updates |
|---|---|---|---|
| **Website + server functions** | **Netlify** | the app the tablet opens, plus small server functions for staff accounts, order checking and nightly backups (`netlify/functions`) | Automatically on every push to GitHub |
| **Database + logins** | **Firebase Spark** | Firestore database, security rules, Authentication | Rules: re-publish only when `firestore.rules` changes |

First-time setup takes about 45 minutes. You need a Google account and a Netlify account, and the
`sanskar-malviya` GitHub login to connect the repository.

## 1. Firebase (database and logins)

Open the [Firebase console](https://console.firebase.google.com) and select project **wabot-66e7c**. Stay
on the free **Spark** plan; nothing here needs a card.

1. **Email login:** *Build → Authentication → Get started → Sign-in method → Email/Password →* switch on
   the first toggle *→ Save*.
2. **Database:** *Build → Firestore Database → Create database →* location **`asia-south1 (Mumbai)`** *→
   Next → Start in production mode → Create.* The location can't be changed later.
3. **Security rules:** *Firestore Database → **Rules** tab*. Delete everything there, paste the full contents
   of [`firestore.rules`](../firestore.rules) from this project, and click **Publish**.
   (Developers can run `firebase login` then `npm run deploy:rules` instead.)
4. **Admin key** for the server functions and setup scripts: *⚙ Project settings → Service accounts →
   Generate new private key → Generate key.* A `.json` file downloads. Move it to a folder **outside** the
   POS folder, e.g. `C:\keys\avis-pos-admin.json`. **It is a master key: never share it, email it, or put
   it in the project or on GitHub.**
5. **Web config:** *⚙ Project settings → General → Your apps.* If no web app (`</>`) exists, add one. Keep
   the six config values handy for Netlify (step 2.3).

## 2. Netlify (website and server functions)

### 2.1 Connect the repository
1. Go to <https://app.netlify.com/signup> → **Sign up with GitHub**, using the **sanskar-malviya**
   account. The repository owner must grant Netlify access.
2. **Add new site → Import an existing project → GitHub →** authorise →
   (if the repo isn't listed: *Configure the Netlify app on GitHub → Only select repositories →
   AVISPOS → Save*) → choose **AVISPOS**.
3. The build settings fill themselves in from `netlify.toml`: branch `main`, build command
   `npm run build`, publish directory `dist`, functions `netlify/functions`. Leave them as they are.

### 2.2 Generate the three server settings from the admin key
In VS Code's terminal (inside the POS folder):

```powershell
npm run netlify-admin-env -- "C:\keys\avis-pos-admin.json"
```

It prints three lines: `FIREBASE_ADMIN_PROJECT_ID=…`, `FIREBASE_ADMIN_CLIENT_EMAIL=…` and
`FIREBASE_ADMIN_PRIVATE_KEY="…"`.

### 2.3 Add the environment variables
On the import page click **Add environment variables** (later: *Site configuration → Environment
variables*), then **Import from a .env file**:

1. Paste the **six public app values**:
   ```
   VITE_FIREBASE_API_KEY=AIzaSyCIDS_hHmxhrsy_I0BDeT8MSQ_xxz-2T70
   VITE_FIREBASE_AUTH_DOMAIN=wabot-66e7c.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=wabot-66e7c
   VITE_FIREBASE_STORAGE_BUCKET=wabot-66e7c.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=567705918379
   VITE_FIREBASE_APP_ID=1:567705918379:web:a26a71bfb44ab62c7310ee
   ```
2. Import again, this time pasting the **three server lines** from step 2.2, and tick
   **"Contains secret values"**. Netlify then hides them and only gives them to the server functions.

### 2.4 Deploy
Click **Deploy**. After 1–3 minutes the status shows **Published**. If it shows **Failed**, open the deploy
and copy the last lines of the log.

### 2.5 Name and login domain
1. *Site configuration → Site details → Change site name →* `avis-food-corner` → the app is at
   **https://avis-food-corner.netlify.app**.
2. Firebase console → *Authentication → Settings → Authorized domains → Add domain →*
   `avis-food-corner.netlify.app`.

The two scheduled jobs start automatically: order checking every 10 minutes and the nightly backup at
00:15 IST. You can see them under *Netlify → Logs & metrics → Functions*.

## 3. Owner account and default menu

In VS Code's terminal (PowerShell), with your own email and a strong password:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\avis-pos-admin.json"
npm run bootstrap-owner -- you@gmail.com "YourStrongPassword"
npm run seed
```

You should see `✔ … is now an OWNER` and the eight products listed. On an existing database `seed` only adds
default menu items that are missing (e.g. the extra bread add-ons); nothing else is changed.
Staff accounts are then created inside the app (*Settings → PIN, staff & backups*).

## 4. The tablet

1. Open **Chrome** on the Android tablet at the Netlify address and sign in as the owner.
2. Chrome menu → **Install app** (or *Add to Home screen*). It now opens full-screen in landscape.
3. Follow [SETUP.md](SETUP.md): owner PIN, products and photos, printer, cashier account.
4. Day to day, sign the tablet in with the **cashier** account.
5. Optional kiosk lock: Android *Settings → Security → App pinning*.

## Updating later

- **Any change pushed to GitHub** is rebuilt and published by Netlify automatically, including the server
  functions. Tablets pick it up the next time the app opens while online.
- **If `firestore.rules` changed**, publish it again (step 1.3, or `npm run deploy:rules`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| "App is not configured" | One of the six `VITE_FIREBASE_*` variables is missing → add it → *Deploys → Trigger deploy* |
| Staff list / Backups say "The server is not configured" | The three `FIREBASE_ADMIN_*` variables are missing or mistyped (step 2.2–2.3) → redeploy |
| "Missing or insufficient permissions" after sign-in | Rules not published (step 1.3), or the account has no role (owner sets one under *Settings → PIN, staff & backups*; the person then signs out and in) |
| Orders stay "Pending" under *Server check* | Check *Netlify → Logs & metrics → Functions → process-orders* for errors |
| "Page not found" when refreshing a page | `netlify.toml` is missing from the repository |
| Bluetooth printer not found | See [PRINTER.md](PRINTER.md) |
