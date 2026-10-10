import { describe, expect, it } from 'vitest';
import { ordersToCsv, summarize } from '../src/lib/reports';
import type { Order, OrderItem, OrderStatus, PaymentMethod } from '../src/lib/types';

let n = 0;
function order(
  items: OrderItem[],
  paymentMethod: PaymentMethod,
  status: OrderStatus = 'completed',
): Order {
  const total = items.reduce((a, i) => a + i.lineTotalPaise, 0);
  n++;
  return {
    id: `id-${n}`,
    orderNumber: `20261010-${String(n).padStart(4, '0')}`,
    orderNumberProvisional: false,
    createdAt: 1_760_000_000_000 + n * 60_000,
    clientCreatedAt: 1_760_000_000_000 + n * 60_000,
    dateKey: '20261010',
    items,
    subtotalPaise: total,
    grandTotalPaise: total,
    paymentMethod,
    paymentStatus: 'paid',
    status,
    cashierUid: 'c',
    deviceId: 'd',
    reprintCount: 0,
    checked: true,
    validated: true,
    validationErrors: [],
    provisionalNumber: '',
    source: 'online',
    statusReason: '',
  };
}
const item = (productId: string, name: string, rupees: number, qty: number): OrderItem => ({
  productId,
  name,
  unitPricePaise: rupees * 100,
  qty,
  lineTotalPaise: rupees * 100 * qty,
});

const orders = [
  order([item('cb', 'Chole Bhature', 90, 2), item('vp', 'Vada Pav', 30, 1)], 'upi'), // 210
  order([item('pb', 'Pav Bhaji', 70, 1)], 'cash'), // 70
  order([item('vp', 'Vada Pav', 30, 3)], 'cash'), // 90
  order([item('cb', 'Chole Bhature', 90, 1)], 'upi', 'cancelled'), // 90 — excluded
  order([item('vb', 'Veg Biryani', 50, 2)], 'cash', 'refunded'), // 100 — excluded
];

describe('daily summary', () => {
  const s = summarize(orders);

  it('acceptance 12: separates Cash and UPI totals', () => {
    expect(s.completedCount).toBe(3);
    expect(s.totalPaise).toBe(37000);
    expect(s.cashPaise).toBe(16000);
    expect(s.upiPaise).toBe(21000);
    expect(s.cashCount).toBe(2);
    expect(s.upiCount).toBe(1);
  });

  it('never counts cancelled or refunded orders as collected sales', () => {
    expect(s.cancelled).toEqual({ count: 1, paise: 9000 });
    expect(s.refunded).toEqual({ count: 1, paise: 10000 });
    expect(s.totalPaise).toBe(s.cashPaise + s.upiPaise);
  });

  it('tallies quantity sold per product (collected orders only)', () => {
    const byName = Object.fromEntries(s.products.map((p) => [p.name, p.qty]));
    expect(byName).toEqual({ 'Vada Pav': 4, 'Chole Bhature': 2, 'Pav Bhaji': 1 });
    expect(s.products[0].name).toBe('Vada Pav'); // best seller first
  });
});

describe('CSV export', () => {
  const csv = ordersToCsv(orders, 'Report');

  it('includes every order with its status and whether it counts', () => {
    expect(csv).toContain('20261010-0001');
    expect(csv).toMatch(/cancelled,UPI,.*,90\.00,no/);
    expect(csv).toContain('Total sales collected (Rs),370.00');
    expect(csv).toContain('Cash (Rs),160.00');
    expect(csv).toContain('UPI (Rs),210.00');
  });

  it('escapes commas and quotes in cells', () => {
    const tricky = [order([item('x', 'Thali, "special"', 100, 1)], 'cash')];
    expect(ordersToCsv(tricky, 'R')).toContain('"Thali, ""special"" x1"');
  });
});
