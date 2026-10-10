// Shared Admin SDK setup for the one-off scripts.
//
//   --emulator   talk to the local Emulator Suite (project demo-aviz-pos)
//   otherwise    use the real project via a service-account key file whose path
//                is in GOOGLE_APPLICATION_CREDENTIALS (never commit that file!)
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';

export const usingEmulator = process.argv.includes('--emulator');

export function initAdmin(): void {
  if (usingEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    initializeApp({ projectId: 'demo-aviz-pos' });
    console.log('→ Using the local Firebase emulators (demo-aviz-pos)');
    return;
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        'Download a service-account key (Firebase console → Project settings → Service accounts →\n' +
        'Generate new private key), save it OUTSIDE this folder, then e.g. in PowerShell:\n' +
        '  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\keys\\avis-pos-admin.json"\n' +
        'Or add --emulator to run against the local emulators.',
    );
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  initializeApp({ credential: cert(key) });
  console.log(`→ Using Firebase project: ${key.project_id}`);
}

/** Positional (non-flag) command-line arguments. */
export function args(): string[] {
  return process.argv.slice(2).filter((a) => !a.startsWith('--'));
}
