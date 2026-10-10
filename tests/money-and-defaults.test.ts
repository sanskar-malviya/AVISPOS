import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCTS } from '../src/lib/defaultProducts';
import { formatINR, paiseToRupees, rupeesToPaise, sumPaise } from '../src/lib/money';

describe('default menu', () => {
  it('acceptance 4: the five default prices are correct', () => {
    const prices = Object.fromEntries(DEFAULT_PRODUCTS.map((p) => [p.name, p.pricePaise / 100]));
    expect(prices).toEqual({
      'Chole Bhature': 90,
      'Pav Bhaji': 70,
      'Veg Biryani': 50,
      'Chole Kulche': 60,
      'Vada Pav': 30,
    });
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
