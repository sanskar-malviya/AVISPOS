import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { sha256Hex } from '../lib/ids';
import { DEFAULT_SETTINGS } from './settingsDefaults';
import type { BusinessSettings } from '../lib/types';

// Readable by all staff (needed for receipts and the header).
const settingsRef = doc(db, 'settings', 'business');
// Readable/writable by OWNERS ONLY (holds the owner PIN hash).
const securityRef = doc(db, 'settings', 'security');

export { DEFAULT_SETTINGS };

function mapSettings(data: Record<string, unknown> | undefined): BusinessSettings {
  if (!data) return { ...DEFAULT_SETTINGS };
  const printer = (data.printer as Partial<BusinessSettings['printer']>) ?? {};
  const type = printer.type;
  return {
    businessName: String(data.businessName ?? DEFAULT_SETTINGS.businessName),
    tagline: String(data.tagline ?? DEFAULT_SETTINGS.tagline),
    contact: String(data.contact ?? ''),
    receiptHeader: String(data.receiptHeader ?? ''),
    receiptFooter: String(data.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter),
    paperWidth: data.paperWidth === '80' ? '80' : '58',
    printer: {
      type: type === 'bluetooth' || type === 'browser' ? type : 'none',
      ...(printer.deviceName ? { deviceName: String(printer.deviceName) } : {}),
    },
    vegLabel: String(data.vegLabel ?? DEFAULT_SETTINGS.vegLabel),
    receiptLogo: data.receiptLogo !== false,
  };
}

export function subscribeSettings(
  onData: (settings: BusinessSettings) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    settingsRef,
    (snap) => onData(mapSettings(snap.data())),
    (err) => onError(err as Error),
  );
}

export async function getSettingsOnce(): Promise<BusinessSettings> {
  const snap = await getDoc(settingsRef);
  return mapSettings(snap.data());
}

export async function saveSettings(patch: Partial<BusinessSettings>): Promise<void> {
  await setDoc(
    settingsRef,
    { ...patch, updatedBy: auth.currentUser?.uid ?? '', updatedAt: Date.now() },
    { merge: true },
  );
}

// ── Owner PIN (owner-only document) ──────────────────────────────────────────

/** Hash a PIN for storage/comparison. The PIN itself is never stored. */
export function hashPin(pin: string): Promise<string> {
  return sha256Hex(`aviz-pos-pin:${pin}`);
}

export async function getOwnerPinHash(): Promise<string> {
  const snap = await getDoc(securityRef);
  return String(snap.data()?.ownerPinHash ?? '');
}

export async function setOwnerPinHash(hash: string): Promise<void> {
  await setDoc(
    securityRef,
    { ownerPinHash: hash, updatedBy: auth.currentUser?.uid ?? '', updatedAt: Date.now() },
    { merge: true },
  );
}
