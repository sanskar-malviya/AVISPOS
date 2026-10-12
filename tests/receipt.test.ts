import { describe, expect, it } from 'vitest';
import {
  buildReceiptLines,
  buildTokenLines,
  columnsFor,
  receiptHtml,
  tokenFor,
  wrap,
} from '../src/printer/receipt';
import { concatBytes, encodeEscPos, toPrinterText } from '../src/printer/escpos';
import {
  composeBand,
  escPosRasterStrips,
  lineDots,
  watermarkBand,
  watermarkDots,
  watermarkGray,
} from '../src/printer/watermark';
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

  it('browser print shows the logo and the watermark independently', () => {
    const lines = buildReceiptLines(sampleOrder(), settings58, { currency: '₹' });
    const logoUrl = 'https://x.test/brand/logo.jpg';
    const logoOnly = receiptHtml(lines, '58', { logoUrl, logo: true, watermark: false });
    expect(logoOnly).toContain('class="lg"');
    expect(logoOnly).not.toContain('class="wm"');
    const markOnly = receiptHtml(lines, '58', { logoUrl, logo: false, watermark: true });
    expect(markOnly).not.toContain('class="lg"');
    expect(markOnly).toContain('class="wm"');
    expect(receiptHtml(lines, '58', { logoUrl, logo: false, watermark: false })).not.toContain('<img');
  });
});

describe('token number', () => {
  it('is the day’s order sequence without leading zeros', () => {
    expect(tokenFor({ orderNumber: '20261012-0007', orderNumberProvisional: false })).toBe('7');
    expect(tokenFor({ orderNumber: '20261012-0120', orderNumberProvisional: false })).toBe('120');
  });

  it('marks offline (provisional) tokens so they never clash with online ones', () => {
    const offline = { orderNumber: 'OFF-ab12cd34-20261012-004', orderNumberProvisional: true };
    expect(tokenFor(offline)).toBe('OFF 4');
  });

  it('is printed on the receipt, bold and double height', () => {
    const lines = buildReceiptLines(sampleOrder(), settings58, { currency: '₹' });
    const token = lines.find((l) => l.text.startsWith('TOKEN NO.'));
    expect(token).toMatchObject({ text: 'TOKEN NO. 1', bold: true, large: true, align: 'center' });
  });

  it('token slip has the number in big type and fits the paper', () => {
    for (const s of [settings58, settings80]) {
      const lines = buildTokenLines(sampleOrder(), s);
      expect(lines.filter((l) => l.huge).map((l) => l.text)).toEqual(['1']);
      const all = lines.map((l) => l.text);
      expect(all).toContain('TOKEN NO.');
      expect(all).toContain('Order No: TEST-0001');
      const cols = columnsFor(s.paperWidth);
      for (const l of lines) expect(l.text.length * (l.huge ? 3 : 1)).toBeLessThanOrEqual(cols);
    }
  });

  it('token slip lists the food and quantities, unless switched off', () => {
    const order = sampleOrder();
    const withItems = buildTokenLines(order, settings58).map((l) => l.text);
    expect(withItems).toContain('2 x Chole Bhature');
    expect(withItems).toContain('1 x Vada Pav');
    // Items come after the big token number.
    expect(withItems.indexOf('2 x Chole Bhature')).toBeGreaterThan(withItems.indexOf('1'));
    const without = buildTokenLines(order, { ...settings58, tokenItems: false }).map((l) => l.text);
    expect(without.join('\n')).not.toContain('Chole Bhature');
    expect(without).toContain('1'); // token still there
  });

  it('long item names on the token slip wrap under the name, not the quantity', () => {
    const order = sampleOrder();
    order.items = [
      { productId: 'z', name: 'Special Paneer Butter Masala Combo Thali', unitPricePaise: 100, qty: 12, lineTotalPaise: 1200 },
    ];
    const lines = buildTokenLines(order, settings58).filter((l) => /Paneer|Combo|Thali/.test(l.text));
    expect(lines[0].text.startsWith('12 x ')).toBe(true);
    expect(lines.slice(1).every((l) => l.text.startsWith('     '))).toBe(true);
    for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(32);
  });

  it('token slip marks reprints', () => {
    const lines = buildTokenLines(sampleOrder(), settings58, { reprint: true });
    expect(lines.map((l) => l.text)).toContain('*** REPRINT ***');
  });

  it('thermal printer prints the token number at triple width and height', () => {
    const bytes = [...encodeEscPos(buildTokenLines(sampleOrder(), settings58))];
    const at = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x22);
    expect(at).toBeGreaterThan(0);
    expect(bytes[at + 3]).toBe('1'.charCodeAt(0));
  });

  it('browser print puts the token slip on its own page', () => {
    const lines = buildReceiptLines(sampleOrder(), settings58, { currency: '₹' });
    const html = receiptHtml(lines, '58', { tokenLines: buildTokenLines(sampleOrder(), settings58) });
    expect(html).toContain('<div class="r t">');
    expect(html).toContain('<div class="c b h">1</div>');
    expect(receiptHtml(lines, '58')).not.toContain('class="r t"');
  });
});

describe('thermal watermark', () => {
  const lines = buildReceiptLines(sampleOrder(), settings58, { currency: 'Rs.' });

  it('covers the lines in the middle of the receipt, centred', () => {
    const size = watermarkDots('58');
    expect(size).toBe(304); // 80% of 384 dots, a multiple of 8
    const band = watermarkBand(lines, size)!;
    expect(band.from).toBeGreaterThan(0);
    expect(band.to).toBeLessThanOrEqual(lines.length);
    const total = lines.reduce((n, l) => n + lineDots(l), 0);
    const above = lines.slice(0, band.from).reduce((n, l) => n + lineDots(l), 0);
    // The watermark sits where it would on the whole receipt: centred.
    expect(above + band.markTop).toBe(Math.round((total - size) / 2));
    const inBand = lines.slice(band.from, band.to).reduce((n, l) => n + lineDots(l), 0);
    expect(band.heightDots).toBe(inBand);
  });

  it('a short receipt is printed as an image in full', () => {
    const band = watermarkBand(lines.slice(0, 3), 304)!;
    expect(band).toMatchObject({ from: 0, to: 3 });
    expect(band.markTop).toBeLessThan(0);
  });

  it('keeps text black and drops watermark dots right next to letters', () => {
    const w = 8;
    const h = 3;
    const text = new Uint8Array(w * h);
    text[1 * w + 3] = 1; // one text dot in the middle row
    const mark = { width: w, height: h, bits: new Uint8Array([0xff, 0xff, 0xff]) }; // all black
    const out = composeBand(text, mark, w, h);
    // Dots above/below and left/right of the letter dot are cleared; the dot stays.
    expect([...out.bits]).toEqual([0b11101111, 0b11010111, 0b11101111]);
  });

  it('a faint watermark uses few dots', () => {
    const size = 64;
    const logo = new Float32Array(size * size).fill(0); // solid black logo
    const bmp = ditherToBitmap(watermarkGray(logo, size, 64, 64, 0), 64, 64);
    const black = [...bmp.bits].reduce((n, b) => n + b.toString(2).split('1').length - 1, 0);
    expect(black / (64 * 64)).toBeGreaterThan(0.1);
    expect(black / (64 * 64)).toBeLessThan(0.3);
  });

  it('sends the image in strips, printed in place of the covered lines', () => {
    const bmp = { width: 16, height: 130, bits: new Uint8Array(2 * 130) };
    const strips = escPosRasterStrips(bmp, 64);
    // 3 strips (64 + 64 + 2 rows), each with an 8-byte GS v 0 header.
    expect(strips.length).toBe(3 + 3 * 8 + bmp.bits.length);
    const decoded = new TextDecoder().decode(
      encodeEscPos(lines, { image: { from: 3, to: 5, data: strips } }),
    );
    expect(lines[3].text).toBe('TOKEN NO. 1');
    expect(decoded).not.toContain('TOKEN NO. 1');
    expect(decoded).not.toContain('Order No:');
    expect(decoded).toContain(lines[5].text); // first line after the image
  });

  it('joins the receipt and token slip into one print job', () => {
    expect([...concatBytes(new Uint8Array([1, 2]), new Uint8Array([3]))]).toEqual([1, 2, 3]);
  });
});
