# Configuration and secrets

## Files

| File | Committed to git? | Purpose |
|---|---|---|
| `.env.example` | yes | Template listing every variable |
| `.env` | **no** (git-ignored) | Real Firebase web config for `npm run dev` / `npm run build` |
| `.env.emulator` | yes | Fake "demo" config used by `npm run dev:emu` (local emulators only) |
| `.firebaserc` | yes | CLI projects: `default` = the live project (`wabot-66e7c`); `demo` = local emulator sandbox. Change with `firebase use --add` |

## Variables (`.env`)

All are copied from *Firebase console → Project settings → General → Your apps → Web app → Config*.

| Variable | Example |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza…` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `my-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `my-project` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `my-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` |
| `VITE_FIREBASE_APP_ID` | `1:1234567890:web:abc…` |
| `VITE_USE_EMULATORS` | `false` (set `true` only to point a build at local emulators) |

## What is and isn't secret

- **The `VITE_*` web config is not a secret.** It is compiled into the app that every browser downloads,
  in every Firebase web app. Data is protected by Firebase Authentication plus the security rules in
  `firestore.rules` and `storage.rules`, never by hiding these values. `.env` is still git-ignored, so
  each deployment keeps its own settings.
- **The service-account key IS a secret.** It is the JSON file used by `npm run seed` and
  `npm run bootstrap-owner`, and it grants full admin access to the project.
  - Store it outside the project folder, and point to it with `GOOGLE_APPLICATION_CREDENTIALS`.
  - Never commit, email or upload it. `.gitignore` blocks common key file names as a safety net.
  - Delete it after the one-off setup. If it ever leaks, revoke it in *Google Cloud console → IAM →
    Service accounts → Keys*.
- **Cloud Functions need no secrets.** They run with Firebase's built-in server identity.
- **No API keys are needed for payments in version 1.** UPI is confirmed manually. If a payment gateway is
  added later, its secret key must be stored with `firebase functions:secrets:set` and used only inside
  Cloud Functions, never in the frontend.

## Owner PIN

The PIN is never stored. Only a SHA-256 hash is kept, in `settings/security`, which only owner accounts can
read. The PIN is a convenience lock for a shared tablet; the real protection is the owner role enforced by
the security rules.

## Optional hardening

- **App Check** (Firebase console → App Check) with Play Integrity / reCAPTCHA Enterprise stops scripts that
  aren't the real app from calling your backend. Recommended once the setup is stable.
- **Authorized domains** (*Authentication → Settings*): remove domains you don't use.
