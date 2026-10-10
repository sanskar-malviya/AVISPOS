import { describe, expect, it } from 'vitest';
import { fromPlain, istDateKey, istDayBounds, toPlain } from '../shared/backupFormat';

class FakeTimestamp {
  _seconds: number;
  constructor(private d: Date) {
    this._seconds = Math.floor(d.getTime() / 1000);
  }
  toDate() {
    return this.d;
  }
}

describe('backup format', () => {
  it('round-trips timestamps, nested objects and arrays', () => {
    const when = new Date('2026-10-10T07:30:00.000Z');
    const doc = {
      createdAt: new FakeTimestamp(when),
      items: [{ name: 'Vada Pav', qty: 2 }],
      nested: { at: new FakeTimestamp(when), n: null },
    };
    const plain = toPlain(doc);
    expect(JSON.parse(JSON.stringify(plain))).toEqual({
      createdAt: { __ts: '2026-10-10T07:30:00.000Z' },
      items: [{ name: 'Vada Pav', qty: 2 }],
      nested: { at: { __ts: '2026-10-10T07:30:00.000Z' }, n: null },
    });
    const back = fromPlain(JSON.parse(JSON.stringify(plain)), (d) => ({ restored: d.toISOString() }));
    expect(back).toEqual({
      createdAt: { restored: '2026-10-10T07:30:00.000Z' },
      items: [{ name: 'Vada Pav', qty: 2 }],
      nested: { at: { restored: '2026-10-10T07:30:00.000Z' }, n: null },
    });
  });

  it('uses India time for the business day', () => {
    // 20:00 UTC on 10 Oct = 01:30 IST on 11 Oct
    expect(istDateKey(Date.UTC(2026, 9, 10, 20, 0))).toBe('20261011');
    expect(istDateKey(Date.UTC(2026, 9, 10, 18, 0))).toBe('20261010');
    const { start, end } = istDayBounds('20261011');
    expect(new Date(start).toISOString()).toBe('2026-10-10T18:30:00.000Z');
    expect(end - start).toBe(24 * 60 * 60 * 1000);
  });
});
