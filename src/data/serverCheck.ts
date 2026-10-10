// Ask the server to check new orders right away (validate totals against the
// menu and give offline orders their final number). Fire-and-forget: if it
// can't be reached, the server's 10-minute schedule picks the orders up anyway.
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callFunction } from './api';

let inFlight: Promise<void> | null = null;

export function requestServerCheck(): void {
  if (inFlight || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  inFlight = callFunction('process-orders')
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      inFlight = null;
    });
}

/**
 * After reconnecting, wait until Firestore has uploaded every order that was
 * queued offline, then ask the server to check them. (The browser's "online"
 * event fires before the queued writes have actually reached the server.)
 */
export function requestServerCheckAfterSync(): void {
  waitForPendingWrites(db)
    .then(requestServerCheck)
    .catch(() => undefined);
}
