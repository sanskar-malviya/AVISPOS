// Firebase Admin SDK for Netlify Functions.
//
// Production: credentials come from three Netlify environment variables
// (generate them with `npm run netlify-admin-env -- <key.json>`):
//   FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
// Local development: when FIRESTORE_EMULATOR_HOST is set, the emulators are used.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpError } from './http';

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-aviz-pos' });
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Netlify stores the key on one line with literal "\n" — restore real newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new HttpError(
      500,
      'The server is not configured. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and ' +
        'FIREBASE_ADMIN_PRIVATE_KEY in Netlify → Site configuration → Environment variables.',
    );
  }
  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
