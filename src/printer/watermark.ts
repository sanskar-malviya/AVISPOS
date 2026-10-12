// Faint logo watermark on thermal paper.
//
// A thermal printer prints either text or an image on a given strip of paper,
// never both on top of each other. So the lines that sit behind the watermark
// are drawn as text onto a canvas, the faint logo is dotted in behind them,
// and that strip is sent as one image. Lines above and below stay ordinary
// printer text, which keeps the extra Bluetooth data (and time) small.
import type { PaperWidth } from '../lib/types';
import type { ReceiptLine } from './receipt';
import { columnsFor } from './receipt';
import { ditherToBitmap, logoGrayPixels, type MonoBitmap } from './logo';

/** Printer dots: Font A is 12 × 24 dots; text lines advance 30 dots by default. */
const CHAR_W = 12;
const CHAR_H = 24;
const LINE_GAP = 6;
/** Darkest the watermark gets, as a share of black dots (the screen uses 10% opacity). */
const WATERMARK_STRENGTH = 0.2;

export function paperDots(width: PaperWidth): number {
  return columnsFor(width) * CHAR_W;
}

/** Height in dots that a line takes when printed as text. */
export function lineDots(line: ReceiptLine): number {
  return CHAR_H * (line.huge ? 3 : line.large ? 2 : 1) + LINE_GAP;
}

/** Watermark size: 80% of the paper width, like the browser receipt. */
export function watermarkDots(width: PaperWidth): number {
  return Math.round((paperDots(width) * 0.8) / 8) * 8;
}

export interface Band {
  from: number; // first line printed as an image
  to: number; // one past the last
  heightDots: number;
  /** Top of the watermark, measured from the top of the band. */
  markTop: number;
}

/**
 * The run of lines the watermark covers when it is centred on the receipt.
 * Returns null when there are no lines.
 */
export function watermarkBand(lines: ReceiptLine[], markSize: number): Band | null {
  if (!lines.length) return null;
  const tops: number[] = [];
  let y = 0;
  for (const l of lines) {
    tops.push(y);
    y += lineDots(l);
  }
  const total = y;
  const markTop = Math.round((total - markSize) / 2);
  const markBottom = markTop + markSize;
  let from = lines.findIndex((l, i) => tops[i] + lineDots(l) > markTop);
  if (from < 0) from = 0;
  let to = lines.length;
  for (let i = from; i < lines.length; i++) {
    if (tops[i] >= markBottom) {
      to = i;
      break;
    }
  }
  const bandTop = tops[from];
  const bandBottom = to < lines.length ? tops[to] : total;
  return { from, to, heightDots: bandBottom - bandTop, markTop: markTop - bandTop };
}

/** Faint greyscale watermark for a band, from the logo pixels. */
export function watermarkGray(
  logo: Float32Array,
  markSize: number,
  width: number,
  height: number,
  markTop: number,
): Float32Array {
  const gray = new Float32Array(width * height).fill(255);
  const left = Math.round((width - markSize) / 2);
  for (let y = 0; y < height; y++) {
    const ly = y - markTop;
    if (ly < 0 || ly >= markSize) continue;
    for (let x = 0; x < markSize; x++) {
      const v = logo[ly * markSize + x];
      gray[y * width + left + x] = 255 - (255 - v) * WATERMARK_STRENGTH;
    }
  }
  return gray;
}

/**
 * Combine the text (1 = black dot) and the dithered watermark. Watermark dots
 * right next to a letter are dropped so the text stays easy to read.
 */
export function composeBand(
  text: Uint8Array,
  mark: MonoBitmap,
  width: number,
  height: number,
): MonoBitmap {
  const bytesPerRow = width / 8;
  const bits = new Uint8Array(bytesPerRow * height);
  const isText = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && text[y * width + x] === 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let black = text[y * width + x] === 1;
      if (!black && mark.bits[y * bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) {
        black = !(isText(x - 1, y) || isText(x + 1, y) || isText(x, y - 1) || isText(x, y + 1));
      }
      if (black) bits[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bits };
}

/**
 * ESC/POS raster commands (GS v 0) for a full-width image, sent in strips so
 * small printer buffers never overflow.
 */
export function escPosRasterStrips(bmp: MonoBitmap, rowsPerStrip = 64): Uint8Array {
  const xBytes = bmp.width / 8;
  const out: number[] = [0x1b, 0x61, 0]; // left aligned: the image is full width
  for (let y = 0; y < bmp.height; y += rowsPerStrip) {
    const rows = Math.min(rowsPerStrip, bmp.height - y);
    out.push(0x1d, 0x76, 0x30, 0x00, xBytes & 0xff, xBytes >> 8, rows & 0xff, rows >> 8);
    for (const b of bmp.bits.subarray(y * xBytes, (y + rows) * xBytes)) out.push(b);
  }
  return new Uint8Array(out);
}

/** Draw the band's text on the printer's character grid; 1 = black dot. */
function drawBandText(lines: ReceiptLine[], width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';

  // Size the monospace font so each character is exactly CHAR_W dots wide.
  ctx.font = '100px monospace';
  const px = (CHAR_W * 100) / ctx.measureText('0').width;

  let y = 0;
  for (const l of lines) {
    const sx = l.huge ? 3 : 1;
    const sy = l.huge ? 3 : l.large ? 2 : 1;
    const textW = l.text.length * CHAR_W * sx;
    const x = l.align === 'center' ? Math.max(0, Math.floor((width - textW) / 2)) : 0;
    ctx.save();
    ctx.font = `${l.bold ? 'bold ' : ''}${px.toFixed(2)}px monospace`;
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.fillText(l.text, 0, CHAR_H * 0.8);
    ctx.restore();
    y += lineDots(l);
  }

  const { data } = ctx.getImageData(0, 0, width, height);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    out[i] = lum < 150 ? 1 : 0;
  }
  return out;
}

export interface WatermarkImage {
  from: number;
  to: number;
  data: Uint8Array;
  /** The composed strip, for previews and tests. */
  bitmap: MonoBitmap;
}

/**
 * The receipt lines behind the watermark as one printer image, ready for
 * `encodeEscPos({ image })`. Rejects if the logo or canvas isn't available.
 */
export async function watermarkImage(
  lines: ReceiptLine[],
  width: PaperWidth,
): Promise<WatermarkImage | undefined> {
  const markSize = watermarkDots(width);
  const band = watermarkBand(lines, markSize);
  if (!band) return undefined;
  const w = paperDots(width);
  const logo = await logoGrayPixels(markSize);
  const text = drawBandText(lines.slice(band.from, band.to), w, band.heightDots);
  const mark = ditherToBitmap(
    watermarkGray(logo, markSize, w, band.heightDots, band.markTop),
    w,
    band.heightDots,
  );
  const bitmap = composeBand(text, mark, w, band.heightDots);
  return { from: band.from, to: band.to, data: escPosRasterStrips(bitmap), bitmap };
}
