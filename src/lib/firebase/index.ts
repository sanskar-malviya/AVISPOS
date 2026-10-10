import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);

/**
 * Firestore configured with persistent (IndexedDB) offline cache + multi-tab
 * support. This is the backbone of the offline-safe billing requirement:
 * reads are served from cache when offline and writes are queued locally and
 * flushed automatically when connectivity returns — so an order is never lost
 * to a temporary internet outage.
 */
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);
// Cloud Functions are deployed to Mumbai (asia-south1) — must match functions/src.
export const FUNCTIONS_REGION = 'asia-south1';
export const functions: Functions = getFunctions(app, FUNCTIONS_REGION);

export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

if (usingEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  // eslint-disable-next-line no-console
  console.info('[Aviz POS] Using Firebase emulators on localhost');
}
