// Daily summary + CSV export (spec §8). Pure functions — unit tested.
import type { Order } from './types';
import { formatDateTime, orderTime, paymentLabel } from './format';

export interface ProductTally {
  name: string;
  qty: number;
  salesPaise: number;
}

export interface SalesSummary {
  completedCount: number;
  totalPaise: number; // collected = completed + paid orders ONLY
  cashPaise: number;
  upiPaise: number;
  cashCount: number;
  upiCount: number;
  cancelled: { count: number; paise: number };
  refunded: { count: number; paise: number };
  products: ProductTally[]; // from collected orders only, best sellers first
}

/** Only completed AND paid orders count as collected revenue. */
export function isCollected(o: Order): boolean {
  return o.status === 'completed' && o.paymentStatus === 'paid';
}

export function summarize(orders: Order[]): SalesSummary {
  const s: SalesSummary = {
    completedCount: 0,
    totalPaise: 0,
    cashPaise: 0,
    upiPaise: 0,
    cashCount: 0,
    upiCount: 0,
    cancelled: { count: 0, paise: 0 },
    refunded: { count: 0, paise: 0 },
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
    if (o.status === 'refunded') {
      s.refunded.count++;
      s.refunded.paise += o.grandTotalPaise;
      continue;
    }
    if (!isCollected(o)) continue;

    s.completedCount++;
    s.totalPaise += o.grandTotalPaise;
    if (o.paymentMethod === 'upi') {
      s.upiPaise += o.grandTotalPaise;
      s.upiCount++;
    } else {
      s.cashPaise += o.grandTotalPaise;
      s.cashCount++;
    }
    for (const item of o.items) {
      const key = `${item.productId}::${item.name}`;
      const t = tally.get(key) ?? { name: item.name, qty: 0, salesPaise: 0 };
      t.qty += item.qty;
      t.salesPaise += item.lineTotalPaise;
      tally.set(key, t);
    }
  }

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
    row(['Order No', 'Date & Time', 'Status', 'Payment', 'Items', 'Total (Rs)', 'Counted in sales']),
  );
  const sorted = [...orders].sort((a, b) => orderTime(a) - orderTime(b));
  for (const o of sorted) {
    lines.push(
      row([
        o.orderNumber,
        formatDateTime(orderTime(o)),
        o.status,
        paymentLabel(o.paymentMethod),
        o.items.map((i) => `${i.name} x${i.qty}`).join('; '),
        rupees(o.grandTotalPaise),
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
  lines.push(row(['Total sales collected (Rs)', rupees(s.totalPaise)]));
  lines.push(row(['Cash (Rs)', rupees(s.cashPaise)]));
  lines.push(row(['UPI (Rs)', rupees(s.upiPaise)]));
  lines.push(row(['Cancelled orders (excluded)', s.cancelled.count, rupees(s.cancelled.paise)]));
  lines.push(row(['Refunded orders (excluded)', s.refunded.count, rupees(s.refunded.paise)]));

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
