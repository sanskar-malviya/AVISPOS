import { describe, expect, it } from 'vitest';
import { formatOrderNumber, validateOrder } from '../shared/validate';

const menu = new Map([
  ['chole-bhature', 9000],
  ['vada-pav', 3000],
]);

const good = () => ({
  items: [
    { productId: 'chole-bhature', name: 'Chole Bhature', unitPricePaise: 9000, qty: 2, lineTotalPaise: 18000 },
    { productId: 'vada-pav', name: 'Vada Pav', unitPricePaise: 3000, qty: 1, lineTotalPaise: 3000 },
  ],
  subtotalPaise: 21000,
  grandTotalPaise: 21000,
});

describe('server-side order validation', () => {
  it('accepts a correct order', () => {
    expect(validateOrder(good(), menu)).toEqual([]);
  });

  it('rejects a tampered line total', () => {
    const o = good();
    o.items[0].lineTotalPaise = 100;
    o.subtotalPaise = 3100;
    o.grandTotalPaise = 3100;
    expect(validateOrder(o, menu).join(' ')).toMatch(/line total does not equal/);
  });

  it('rejects a tampered grand total', () => {
    const o = { ...good(), grandTotalPaise: 100 };
    expect(validateOrder(o, menu)).toContain('Total does not equal the subtotal');
  });

  it('rejects a subtotal that does not match the lines', () => {
    const o = { ...good(), subtotalPaise: 20000, grandTotalPaise: 20000 };
    expect(validateOrder(o, menu)).toContain('Subtotal does not equal the sum of the items');
  });

  it('flags a price that differs from the menu', () => {
    const o = good();
    o.items[1] = { ...o.items[1], unitPricePaise: 100, lineTotalPaise: 100 };
    o.subtotalPaise = 18100;
    o.grandTotalPaise = 18100;
    expect(validateOrder(o, menu).join(' ')).toMatch(/Vada Pav: sold at Rs\.1 but the menu price is Rs\.30/);
  });

  it('flags unknown products and bad quantities', () => {
    const o = good();
    o.items[0] = { ...o.items[0], productId: 'nope', qty: 0, lineTotalPaise: 0 };
    o.subtotalPaise = 3000;
    o.grandTotalPaise = 3000;
    const errs = validateOrder(o, menu).join(' ');
    expect(errs).toMatch(/invalid quantity/);
    expect(errs).toMatch(/product not found/);
  });

  it('rejects an empty order', () => {
    expect(validateOrder({ items: [] }, menu)).toEqual(['Order has no items']);
  });

  it('formats canonical order numbers', () => {
    expect(formatOrderNumber('20261010', 7)).toBe('20261010-0007');
    expect(formatOrderNumber('20261010', 12345)).toBe('20261010-12345');
  });
});
