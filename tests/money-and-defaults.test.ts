import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCTS, missingDefaultProducts } from '../src/lib/defaultProducts';
import { formatINR, paiseToRupees, rupeesToPaise, sumPaise } from '../src/lib/money';

describe('default menu', () => {
  it('acceptance 4: the default prices are correct', () => {
    const prices = Object.fromEntries(DEFAULT_PRODUCTS.map((p) => [p.name, p.pricePaise / 100]));
    expect(prices).toEqual({
      'Chole Bhature': 90,
      'Pav Bhaji': 70,
      'Veg Biryani': 50,
      'Chole Kulche': 60,
      'Vada Pav': 30,
      'Extra Bhatura': 20,
      'Extra Pav': 10,
      'Extra Kulcha': 15,
    });
  });

  it('every default item has a bundled photo', () => {
    for (const p of DEFAULT_PRODUCTS) expect(p.image).toMatch(/^\/products\/[a-z-]+\.jpg$/);
  });

  it('offers only the default items an existing menu is missing', () => {
    const existing = [
      { id: 'chole-bhature', name: 'Chole Bhature' },
      { id: 'pav-bhaji', name: 'Pav Bhaji' },
      { id: 'veg-biryani', name: 'Veg Biryani' },
      { id: 'chole-kulche', name: 'Chole Kulche' },
      { id: 'vada-pav', name: 'Vada Pav' },
      { id: 'x1y2z3', name: 'extra pav' }, // added by hand
    ];
    expect(missingDefaultProducts(existing).map((p) => p.name)).toEqual([
      'Extra Bhatura',
      'Extra Kulcha',
    ]);
    // A renamed default keeps its id, so it is not offered again.
    expect(
      missingDefaultProducts([...existing, { id: 'extra-bhatura', name: 'Bhatura (1 pc)' }, { id: 'extra-kulcha', name: 'Extra Kulcha' }]),
    ).toEqual([]);
  });

  it('stores prices as integer paise', () => {
    for (const p of DEFAULT_PRODUCTS) expect(Number.isInteger(p.pricePaise)).toBe(true);
  });
});

describe('money', () => {
  it('formats whole rupees with Indian grouping', () => {
    expect(formatINR(9000)).toBe('₹90');
    expect(formatINR(18000)).toBe('₹180');
    expect(formatINR(150000)).toBe('₹1,500');
    expect(formatINR(12345600)).toBe('₹1,23,456');
  });

  it('converts without floating-point drift', () => {
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(9000)).toBe(90);
    expect(sumPaise([9000, 9000, 3000])).toBe(21000);
  });
});
