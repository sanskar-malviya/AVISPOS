import { describe, expect, it } from 'vitest';
import { dateKey } from '../src/lib/ids';

describe('business-day key', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m); // 15 Oct 2026, local time

  it('defaults to the calendar day', () => {
    expect(dateKey(at(0, 0), 0)).toBe('20261015');
    expect(dateKey(at(23, 59), 0)).toBe('20261015');
  });

  it('with a 3 am start, sales before 3 am belong to the previous day', () => {
    expect(dateKey(at(0, 0), 3)).toBe('20261014');
    expect(dateKey(at(1, 30), 3)).toBe('20261014');
    expect(dateKey(at(2, 59), 3)).toBe('20261014');
    expect(dateKey(at(3, 0), 3)).toBe('20261015');
    expect(dateKey(at(14, 0), 3)).toBe('20261015');
    expect(dateKey(at(23, 59), 3)).toBe('20261015');
  });

  it('rolls over months and years correctly', () => {
    expect(dateKey(new Date(2026, 0, 1, 1, 0), 3)).toBe('20251231');
    expect(dateKey(new Date(2026, 2, 1, 2, 0), 3)).toBe('20260228');
  });
});
