// JSON-safe (de)serialisation of Firestore data for backups. Firestore
// Timestamps become {"__ts": "<ISO date>"} and are turned back into
// Timestamps on restore. Dependency-free so it is easy to unit test.

export interface TimestampLike {
  toDate(): Date;
}

function isTimestamp(v: unknown): v is TimestampLike {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as TimestampLike).toDate === 'function' &&
    '_seconds' in (v as object)
  );
}

export function toPlain(value: unknown): unknown {
  if (isTimestamp(value)) return { __ts: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

export function fromPlain(value: unknown, makeTimestamp: (d: Date) => unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => fromPlain(v, makeTimestamp));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.__ts === 'string' && Object.keys(obj).length === 1) {
      return makeTimestamp(new Date(obj.__ts));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = fromPlain(v, makeTimestamp);
    return out;
  }
  return value;
}

export interface BackupDoc {
  id: string;
  data: unknown;
}

export interface BackupFile {
  format: 'avis-pos-backup';
  version: 1;
  dateKey: string; // the business day covered (YYYYMMDD, India time)
  createdAt: string; // ISO
  orders: BackupDoc[];
  audit: BackupDoc[];
  products: BackupDoc[];
  settings: BackupDoc[]; // business settings only (never the PIN hash)
  counters: BackupDoc[];
}

/** India Standard Time business day for a moment, as YYYYMMDD. */
export function istDateKey(ms: number): string {
  const d = new Date(ms + 5.5 * 60 * 60 * 1000);
  return (
    d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/** Start/end (ms, UTC) of an IST business day. */
export function istDayBounds(dateKey: string): { start: number; end: number } {
  const y = Number(dateKey.slice(0, 4));
  const m = Number(dateKey.slice(4, 6)) - 1;
  const d = Number(dateKey.slice(6, 8));
  const start = Date.UTC(y, m, d) - 5.5 * 60 * 60 * 1000;
  return { start, end: start + 24 * 60 * 60 * 1000 };
}
