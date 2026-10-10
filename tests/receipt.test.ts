import { describe, expect, it } from 'vitest';
import { buildReceiptLines, columnsFor, receiptHtml, wrap } from '../src/printer/receipt';
import { encodeEscPos, toPrinterText } from '../src/printer/escpos';
import { DEFAULT_SETTINGS } from '../src/data/settingsDefaults';
import { sampleOrder } from '../src/lib/sampleOrder';
import type { BusinessSettings } from '../src/lib/types';

const settings58: BusinessSettings = { ...DEFAULT_SETTINGS, paperWidth: '58' };
const settings80: BusinessSettings = { ...DEFAULT_SETTINGS, paperWidth: '80' };
const text = (s: BusinessSettings, reprint = false) =>
  buildReceiptLines(sampleOrder(), s, { currency: '₹', reprint })
    .map((l) => l.text)
    .join('\n');

describe('receipt', () => {
  it('acceptance 10: contains the business, items, quantities, totals and payment method', () => {
    const t = text(settings58);
    expect(t).toContain('AVIZ FOOD POINT');
    expect(t).toContain('100% Vegetarian');
    expect(t).toContain('Order No: TEST-0001');
    expect(t).toMatch(/Chole Bhature\s+2\s+₹180/);
    expect(t).toMatch(/Vada Pav\s+1\s+₹30/);
    expect(t).toMatch(/Subtotal:\s+₹210/);
    expect(t).toMatch(/TOTAL:\s+₹210/);
    expect(t).toContain('Payment: UPI');
    expect(t).toContain('Thank you for visiting!');
  });

  it('acceptance 6: uses the price snapshot stored on the order, not the live menu', () => {
    // The receipt takes no product list at all — only the order's own lines.
    const order = sampleOrder();
    order.items[0] = { ...order.items[0], unitPricePaise: 8000, lineTotalPaise: 16000 };
    const t = buildReceiptLines(order, settings58, { currency: '₹' }).map((l) => l.text).join('\n');
    expect(t).toMatch(/Chole Bhature\s+2\s+₹160/);
  });

  it('never exceeds the paper width (58 mm = 32 cols, 80 mm = 48 cols)', () => {
    for (const s of [settings58, settings80]) {
      const cols = columnsFor(s.paperWidth);
      const order = sampleOrder();
      order.items.push({
        productId: 'z',
        name: 'Extra Long Special Paneer Butter Masala Combo With Two Rotis',
        unitPricePaise: 1234500,
        qty: 12,
        lineTotalPaise: 14814000,
      });
      for (const l of buildReceiptLines(order, s, { currency: 'Rs.' })) {
        expect(l.text.length).toBeLessThanOrEqual(cols);
      }
    }
  });

  it('marks reprints and cancelled orders clearly', () => {
    expect(text(settings58, true)).toContain('*** REPRINT ***');
    const cancelled = { ...sampleOrder(), status: 'cancelled' as const };
    const t = buildReceiptLines(cancelled, settings58, { currency: '₹' }).map((l) => l.text).join('\n');
    expect(t).toContain('*** CANCELLED ***');
  });

  it('wraps long words and text', () => {
    expect(wrap('abc def ghi', 7)).toEqual(['abc def', 'ghi']);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('browser receipt HTML escapes content and sizes the page', () => {
    const lines = buildReceiptLines(sampleOrder(), { ...settings80, receiptFooter: '<b>Hi</b>' }, {
      currency: '₹',
    });
    const html = receiptHtml(lines, '80');
    expect(html).toContain('size: 80mm auto');
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;');
    expect(html).not.toContain('<b>Hi</b>');
  });
});

describe('ESC/POS', () => {
  it('maps ₹ and non-ASCII to printer-safe text', () => {
    expect(toPrinterText('₹90')).toBe('Rs.90');
    expect(toPrinterText('Café')).toBe('Cafe');
    expect(toPrinterText('नमस्ते')).toMatch(/^\?+$/);
  });

  it('starts with printer init and ends with feed + cut', () => {
    const lines = buildReceiptLines(sampleOrder(), settings58, { currency: 'Rs.' });
    const bytes = encodeEscPos(lines, { cut: true });
    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...bytes.slice(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
    for (const b of bytes) expect(b).toBeLessThan(0x80); // pure ASCII + control codes
    expect(new TextDecoder().decode(bytes)).toContain('Rs.180');
  });
});
