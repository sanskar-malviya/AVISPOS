import { beforeEach, describe, expect, it } from 'vitest';
import { buildCartLines, useCart } from '../src/store/cartStore';
import { sumPaise } from '../src/lib/money';
import type { Product } from '../src/lib/types';

const product = (id: string, name: string, rupees: number): Product => ({
  id,
  name,
  pricePaise: rupees * 100,
  imageUrl: '',
  imagePath: '',
  active: true,
  available: true,
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
});

const menu = [
  product('chole-bhature', 'Chole Bhature', 90),
  product('pav-bhaji', 'Pav Bhaji', 70),
  product('vada-pav', 'Vada Pav', 30),
];

const cart = () => useCart.getState();
const total = (products = menu) =>
  sumPaise(buildCartLines(products, cart().qtyByProduct).map((l) => l.lineTotalPaise));

describe('billing cart', () => {
  beforeEach(() => cart().clear());

  it('acceptance 1: tapping Chole Bhature twice gives quantity 2 on ONE line', () => {
    cart().add('chole-bhature');
    cart().add('chole-bhature');
    const lines = buildCartLines(menu, cart().qtyByProduct);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
    expect(lines[0].lineTotalPaise).toBe(18000);
  });

  it('acceptance 2: multiple products give the correct grand total', () => {
    cart().add('chole-bhature');
    cart().add('chole-bhature');
    cart().add('vada-pav');
    cart().add('pav-bhaji');
    // 2×90 + 30 + 70 = 280
    expect(total()).toBe(28000);
  });

  it('acceptance 3: decrease and remove update the total; qty 0 removes the line', () => {
    cart().add('chole-bhature');
    cart().add('chole-bhature');
    cart().add('vada-pav');
    cart().decrement('chole-bhature');
    expect(total()).toBe(12000);
    cart().decrement('chole-bhature');
    expect(cart().qtyByProduct['chole-bhature']).toBeUndefined();
    expect(total()).toBe(3000);
    cart().remove('vada-pav');
    expect(cart().isEmpty()).toBe(true);
    expect(total()).toBe(0);
  });

  it('plus button increments the existing line', () => {
    cart().add('pav-bhaji');
    cart().increment('pav-bhaji');
    cart().increment('pav-bhaji');
    expect(cart().qtyByProduct['pav-bhaji']).toBe(3);
    expect(cart().totalQty()).toBe(3);
  });

  it('line totals always use the CURRENT product price', () => {
    cart().add('vada-pav');
    cart().add('vada-pav');
    const repriced = menu.map((p) => (p.id === 'vada-pav' ? { ...p, pricePaise: 3500 } : p));
    expect(total(repriced)).toBe(7000);
  });

  it('ignores cart entries for products that no longer exist', () => {
    cart().add('deleted-item');
    cart().add('vada-pav');
    expect(buildCartLines(menu, cart().qtyByProduct)).toHaveLength(1);
  });
});
