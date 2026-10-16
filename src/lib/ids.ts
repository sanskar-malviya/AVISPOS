// ID / device / date helpers.

/** Generate a UUID v4. Used as the order's immutable id == Firestore doc id. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old environments.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEVICE_ID_KEY = 'aviz.deviceId';

/** A stable short identifier for this physical device/browser. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = newId().slice(0, 8);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'device';
  }
}

const DAY_START_KEY = 'aviz.dayStartHour';

/**
 * Hour at which the business day rolls over (settings → "Business day starts
 * at"). Kept in localStorage too, so the very first sale after the app opens
 * — before the settings snapshot arrives — already uses the right day.
 */
let dayStartHour = (() => {
  try {
    const n = Number(localStorage.getItem(DAY_START_KEY));
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 0;
  } catch {
    return 0;
  }
})();

export function setDayStartHour(hour: number): void {
  dayStartHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0;
  try {
    localStorage.setItem(DAY_START_KEY, String(dayStartHour));
  } catch {
    /* ignore */
  }
}

export function getDayStartHour(): number {
  return dayStartHour;
}

/**
 * Business-day key as YYYYMMDD (used for order numbers, daily counters and
 * reports). Times before `startHour` (e.g. 1 am with a 3 am start) count as
 * the previous day, so a late-night sale stays on that day's report.
 */
export function dateKey(d: Date = new Date(), startHour: number = dayStartHour): string {
  const shifted = new Date(d.getTime() - startHour * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** "YYYYMMDD" shifted by `days` (negative allowed), calendar arithmetic. */
export function addDays(dk: string, days: number): string {
  const d = new Date(Number(dk.slice(0, 4)), Number(dk.slice(4, 6)) - 1, Number(dk.slice(6, 8)) + days);
  return dateKey(d, 0);
}

/** SHA-256 hex digest (used to hash the owner PIN before storing). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
