import { describe, expect, it } from 'vitest';
import { buildReceiptLines, columnsFor, receiptHtml, wrap } from '../src/printer/receipt';
import { encodeEscPos, toPrinterText } from '../src/printer/escpos';
import { ditherToBitmap, escPosRaster } from '../src/printer/logo';
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
    expect(t).toContain("AVI'S FOOD CORNER");
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

describe('receipt logo', () => {
  it('dithers greyscale into a 1-bit bitmap (black = 1, leftmost dot = high bit)', () => {
    const w = 16;
    const h = 2;
    const gray = new Float32Array(w * h).fill(255);
    gray[0] = 0; // top-left dot black
    gray[w + 15] = 0; // bottom-right dot black
    const bmp = ditherToBitmap(gray, w, h);
    expect([...bmp.bits]).toEqual([0x80, 0x00, 0x00, 0x01]);
    // Mid-grey comes out as roughly half the dots.
    const mid = ditherToBitmap(new Float32Array(64 * 64).fill(128), 64, 64);
    const black = [...mid.bits].reduce((n, b) => n + b.toString(2).split('1').length - 1, 0);
    expect(black / (64 * 64)).toBeGreaterThan(0.4);
    expect(black / (64 * 64)).toBeLessThan(0.6);
  });

  it('prints the logo as a centred GS v 0 raster right after printer init', () => {
    const bmp = { width: 16, height: 3, bits: new Uint8Array(6).fill(0xff) };
    const raster = escPosRaster(bmp);
    expect([...raster.slice(0, 11)]).toEqual([0x1b, 0x61, 1, 0x1d, 0x76, 0x30, 0, 2, 0, 3, 0]);
    expect(raster.length).toBe(11 + 6 + 1);
    const lines = buildReceiptLines(sampleOrder(), settings58, { currency: 'Rs.' });
    const bytes = encodeEscPos(lines, { logo: raster });
    expect([...bytes.slice(5, 5 + raster.length)]).toEqual([...raster]);
  });

  it('browser receipt shows the logo and a faint watermark only when asked', () => {
    const lines = buildReceiptLines(sampleOrder(), settings58, { currency: '₹' });
    expect(receiptHtml(lines, '58')).not.toContain('<img');
    const html = receiptHtml(lines, '58', { logoUrl: 'https://x.test/brand/logo.jpg' });
    expect(html).toContain('class="lg" src="https://x.test/brand/logo.jpg"');
    expect(html).toContain('class="wm"');
  });
});
