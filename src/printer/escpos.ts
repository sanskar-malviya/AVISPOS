// Minimal ESC/POS encoder for 58/80 mm thermal printers.
import type { ReceiptLine } from './receipt';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Thermal printers use single-byte code pages (usually PC437) that lack ₹ and
 * most non-Latin glyphs. Map ₹ to "Rs.", strip accents, and replace anything
 * else outside printable ASCII so the printer never prints garbage.
 */
export function toPrinterText(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

export function encodeEscPos(
  lines: ReceiptLine[],
  opts: {
    feedLines?: number;
    cut?: boolean;
    logo?: Uint8Array;
    /** Raster image printed in place of lines `from`…`to - 1` (see watermark.ts). */
    image?: { from: number; to: number; data: Uint8Array };
  } = {},
): Uint8Array {
  const out: number[] = [
    ESC, 0x40, // initialise printer
    ESC, 0x74, 0x00, // code page PC437 (ASCII-safe)
  ];
  if (opts.logo) for (const b of opts.logo) out.push(b); // raster logo, see logo.ts
  const image = opts.image;
  for (const [i, line] of lines.entries()) {
    if (image && i === image.from) for (const b of image.data) out.push(b);
    if (image && i >= image.from && i < image.to) continue;
    out.push(ESC, 0x61, line.align === 'center' ? 1 : 0); // alignment
    out.push(ESC, 0x45, line.bold ? 1 : 0); // emphasis
    // Character size: triple width+height, double height, or normal.
    out.push(GS, 0x21, line.huge ? 0x22 : line.large ? 0x01 : 0x00);
    for (const ch of toPrinterText(line.text)) out.push(ch.charCodeAt(0));
    out.push(LF);
  }
  out.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0); // reset styles
  out.push(ESC, 0x64, opts.feedLines ?? 4); // feed paper past the tear bar
  if (opts.cut) out.push(GS, 0x56, 0x42, 0x00); // partial cut (ignored if no cutter)
  return new Uint8Array(out);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
