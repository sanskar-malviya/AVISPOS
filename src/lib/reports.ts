// Daily summary + CSV export (spec §8). Pure functions — unit tested.
import type { Order } from './types';
import { formatDateTime, orderTime, paymentLabel } from './format';

export interface ProductTally {
  name: string;
  qty: number;
  salesPaise: number;
}

export interface SalesSummary {
  /** Orders that brought money in: completed, plus partially refunded ones. */
  completedCount: number;
  /** NET collected = received − refunded. */
  totalPaise: number;
  cashPaise: number; // net: cash received − cash refunds (what should be in the drawer)
  upiPaise: number; // net: UPI received − UPI refunds
  cashCount: number;
  upiCount: number;
  /** Gross money received before refunds, by method. */
  received: { paise: number; cashPaise: number; upiPaise: number };
  cancelled: { count: number; paise: number };
  /** Refunds paid out, by the method they were given back. */
  refunded: { count: number; paise: number; cashPaise: number; upiPaise: number };
  products: ProductTally[]; // from collected orders only, best sellers first
}

/** Amount given back on a refunded order (0 otherwise). */
export function refundOf(o: Order): number {
  if (o.status !== 'refunded') return 0;
  return Math.min(o.refundPaise ?? o.grandTotalPaise, o.grandTotalPaise);
}

/**
 * Orders that count as sales: completed and paid, or refunded only in part.
 * A fully refunded order brought nothing in, so it is excluded like before.
 */
export function isCollected(o: Order): boolean {
  if (o.paymentStatus !== 'paid') return false;
  if (o.status === 'completed') return true;
  return o.status === 'refunded' && refundOf(o) < o.grandTotalPaise;
}

export function summarize(orders: Order[]): SalesSummary {
  const s: SalesSummary = {
    completedCount: 0,
    totalPaise: 0,
    cashPaise: 0,
    upiPaise: 0,
    cashCount: 0,
    upiCount: 0,
    received: { paise: 0, cashPaise: 0, upiPaise: 0 },
    cancelled: { count: 0, paise: 0 },
    refunded: { count: 0, paise: 0, cashPaise: 0, upiPaise: 0 },
    products: [],
  };
  // Tally by name snapshot so historic names stay correct even after renames.
  const tally = new Map<string, ProductTally>();

  for (const o of orders) {
    if (o.status === 'cancelled') {
      s.cancelled.count++;
      s.cancelled.paise += o.grandTotalPaise;
      continue;
    }
    if (o.paymentStatus !== 'paid') continue;

    // Money received (also for refunded orders — the refund is shown separately).
    s.received.paise += o.grandTotalPaise;
    if (o.paymentMethod === 'upi') s.received.upiPaise += o.grandTotalPaise;
    else s.received.cashPaise += o.grandTotalPaise;

    if (o.status === 'refunded') {
      const back = refundOf(o);
      s.refunded.count++;
      s.refunded.paise += back;
      if (o.refundMethod === 'upi') s.refunded.upiPaise += back;
      else s.refunded.cashPaise += back;
    }
    if (!isCollected(o)) continue;

    s.completedCount++;
    if (o.paymentMethod === 'upi') s.upiCount++;
    else s.cashCount++;
    for (const item of o.items) {
      const key = `${item.productId}::${item.name}`;
      const t = tally.get(key) ?? { name: item.name, qty: 0, salesPaise: 0 };
      t.qty += item.qty;
      t.salesPaise += item.lineTotalPaise;
      tally.set(key, t);
    }
  }

  s.totalPaise = s.received.paise - s.refunded.paise;
  s.cashPaise = s.received.cashPaise - s.refunded.cashPaise;
  s.upiPaise = s.received.upiPaise - s.refunded.upiPaise;
  s.products = [...tally.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  return s;
}

function csvCell(v: string | number): string {
  const str = String(v);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function row(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',');
}

const rupees = (paise: number) => (paise / 100).toFixed(2);

/**
 * Build a CSV sales report: one row per order, then a product summary and
 * totals. Amounts are plain rupee numbers (Excel-friendly). Cancelled/refunded
 * orders are listed with their status but excluded from collected totals.
 */
export function ordersToCsv(orders: Order[], title: string): string {
  const lines: string[] = [];
  lines.push(row([title]));
  lines.push('');
  lines.push(
    row([
      'Order No', 'Date & Time', 'Status', 'Payment', 'Items', 'Total (Rs)',
      'Refund (Rs)', 'Refund by', 'Counted in sales',
    ]),
  );
  const sorted = [...orders].sort((a, b) => orderTime(a) - orderTime(b));
  for (const o of sorted) {
    const back = refundOf(o);
    lines.push(
      row([
        o.orderNumber,
        formatDateTime(orderTime(o)),
        o.status,
        paymentLabel(o.paymentMethod),
        o.items.map((i) => `${i.name} x${i.qty}`).join('; '),
        rupees(o.grandTotalPaise),
        back ? rupees(back) : '',
        back ? paymentLabel(o.refundMethod ?? o.paymentMethod) : '',
        isCollected(o) ? 'yes' : 'no',
      ]),
    );
  }

  const s = summarize(orders);
  lines.push('');
  lines.push(row(['Product', 'Qty sold', 'Sales (Rs)']));
  for (const p of s.products) lines.push(row([p.name, p.qty, rupees(p.salesPaise)]));

  lines.push('');
  lines.push(row(['Completed orders', s.completedCount]));
  lines.push(row(['Money received (Rs)', rupees(s.received.paise)]));
  lines.push(row(['Refunds given (Rs)', rupees(s.refunded.paise)]));
  lines.push(row(['Total sales collected (Rs)', rupees(s.totalPaise)]));
  lines.push(row(['Cash (Rs)', rupees(s.cashPaise)]));
  lines.push(row(['  Cash received (Rs)', rupees(s.received.cashPaise)]));
  lines.push(row(['  Cash refunds (Rs)', rupees(s.refunded.cashPaise)]));
  lines.push(row(['UPI (Rs)', rupees(s.upiPaise)]));
  lines.push(row(['  UPI received (Rs)', rupees(s.received.upiPaise)]));
  lines.push(row(['  UPI refunds (Rs)', rupees(s.refunded.upiPaise)]));
  lines.push(row(['Cancelled orders (excluded)', s.cancelled.count, rupees(s.cancelled.paise)]));
  lines.push(row(['Refunded orders', s.refunded.count, rupees(s.refunded.paise)]));

  return lines.join('\r\n');
}

/** Trigger a CSV download in the browser (UTF-8 with BOM so Excel opens it cleanly). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
