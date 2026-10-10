// Receipt layout (spec §6). One fixed-width text layout is the single source of
// truth for the Bluetooth ESC/POS output, the browser-print HTML and the
// on-screen preview, so all three always show identical content.
import type { BusinessSettings, Order, PaperWidth } from '../lib/types';
import { formatDateTime, orderTime, paymentLabel } from '../lib/format';

export interface ReceiptLine {
  text: string;
  align: 'left' | 'center';
  bold?: boolean;
  large?: boolean; // double-height title
}

export interface ReceiptOptions {
  /** '₹' for screen/browser print; 'Rs.' for thermal printers (most code pages lack ₹). */
  currency: string;
  reprint?: boolean;
}

/** Characters per line in the standard thermal font (Font A). */
export function columnsFor(width: PaperWidth): number {
  return width === '80' ? 48 : 32;
}

export function formatAmount(paise: number, currency: string): string {
  return currency + Math.round(paise / 100).toLocaleString('en-IN');
}

/** Word-wrap to `width` columns; words longer than a line are hard-split. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > width) {
      if (line) {
        out.push(line);
        line = '';
      }
      out.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= width) line += ' ' + w;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function twoCol(left: string, right: string, cols: number): string {
  const space = cols - left.length - right.length;
  if (space >= 1) return left + ' '.repeat(space) + right;
  return left.slice(0, Math.max(0, cols - right.length - 1)) + ' ' + right;
}

export function buildReceiptLines(
  order: Order,
  settings: BusinessSettings,
  opts: ReceiptOptions,
): ReceiptLine[] {
  const cols = columnsFor(settings.paperWidth);
  const cur = opts.currency;
  const out: ReceiptLine[] = [];

  const center = (text: string, style: Partial<ReceiptLine> = {}) =>
    wrap(text, cols).forEach((t) => out.push({ text: t, align: 'center', ...style }));
  const left = (text: string, style: Partial<ReceiptLine> = {}) =>
    wrap(text, cols).forEach((t) => out.push({ text: t, align: 'left', ...style }));
  const raw = (text: string, style: Partial<ReceiptLine> = {}) =>
    out.push({ text, align: 'left', ...style });
  const sep = () => raw('-'.repeat(cols));

  // Header
  center(settings.businessName.toUpperCase(), { bold: true, large: true });
  if (settings.tagline.trim()) center(settings.tagline.trim());
  for (const l of settings.receiptHeader.split('\n')) if (l.trim()) center(l.trim());
  if (settings.contact.trim()) center(settings.contact.trim());
  if (order.status !== 'completed') center(`*** ${order.status.toUpperCase()} ***`, { bold: true });
  if (opts.reprint) center('*** REPRINT ***', { bold: true });
  sep();

  left(`Order No: ${order.orderNumber}`);
  left(`Date: ${formatDateTime(orderTime(order))}`);
  sep();

  // Items table: name | qty | amount
  const qtyW = 4;
  const amtW = 10;
  const nameW = cols - qtyW - amtW;
  raw('Item'.padEnd(nameW) + 'Qty'.padStart(qtyW) + 'Amount'.padStart(amtW), { bold: true });
  for (const item of order.items) {
    const qty = String(item.qty);
    const amt = formatAmount(item.lineTotalPaise, cur);
    if (qty.length < qtyW && amt.length < amtW) {
      const names = wrap(item.name, nameW - 1);
      raw(names[0].padEnd(nameW) + qty.padStart(qtyW) + amt.padStart(amtW));
      for (const extra of names.slice(1)) raw(extra);
    } else {
      // Unusually large qty/amount: name on its own line(s), figures below.
      for (const n of wrap(item.name, cols)) raw(n);
      raw(twoCol(`  x ${qty}`, amt, cols));
    }
  }
  sep();

  raw(twoCol('Subtotal:', formatAmount(order.subtotalPaise, cur), cols));
  raw(twoCol('TOTAL:', formatAmount(order.grandTotalPaise, cur), cols), { bold: true });
  sep();
  left(`Payment: ${paymentLabel(order.paymentMethod)}`);
  raw('');
  for (const l of settings.receiptFooter.split('\n')) if (l.trim()) center(l.trim());

  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Standalone HTML document for the browser-print fallback, sized to the roll. */
export function receiptHtml(
  lines: ReceiptLine[],
  width: PaperWidth,
  opts: { logoUrl?: string } = {},
): string {
  const pageW = width === '80' ? '80mm' : '58mm';
  const contentW = width === '80' ? '72mm' : '48mm';
  // Logo at the top plus a faint copy behind the items. Plain <img> elements,
  // because browsers leave CSS backgrounds out of prints by default.
  const logo = opts.logoUrl
    ? `<img class="lg" src="${escapeHtml(opts.logoUrl)}" alt=""><img class="wm" src="${escapeHtml(opts.logoUrl)}" alt="">`
    : '';
  const body = lines
    .map((l) => {
      const cls = [l.align === 'center' ? 'c' : 'l', l.bold ? 'b' : '', l.large ? 'g' : '']
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}">${escapeHtml(l.text) || '&nbsp;'}</div>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>
@page { size: ${pageW} auto; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
.r { width: ${contentW}; margin: 0 auto; padding: 3mm 0 8mm;
     font-family: 'Courier New', Courier, monospace; font-size: 2.5mm; line-height: 1.3; }
.l { white-space: pre; overflow: hidden; }
.c { text-align: center; white-space: pre-wrap; }
.b { font-weight: 700; }
.g { font-size: 3.6mm; }
.r { position: relative; }
.r > div { position: relative; z-index: 1; }
.lg { display: block; width: 22mm; height: 22mm; margin: 0 auto 2mm; border-radius: 50%; }
.wm { position: absolute; z-index: 0; left: 50%; top: 50%; width: 80%; aspect-ratio: 1;
      transform: translate(-50%, -50%); border-radius: 50%; opacity: 0.1; filter: grayscale(1); }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body><div class="r">${logo}${body}</div></body></html>`;
}
