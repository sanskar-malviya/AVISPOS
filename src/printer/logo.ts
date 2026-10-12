// Shop logo on receipts.
//
// Thermal printers print black dots only, line by line, so the logo is turned
// into a black-and-white (dithered) bitmap and printed at the top of the
// receipt. Text can't be printed over an image on these printers, so the
// faint watermark behind the items is printed by turning those lines into an
// image as well (see watermark.ts).

export const LOGO_URL = '/brand/logo.jpg';

/** Logo width in printer dots (8 dots per mm): about 24 mm on 58 mm paper, 30 mm on 80 mm. */
export function logoDotsFor(width: '58' | '80'): number {
  return width === '80' ? 240 : 192;
}

export interface MonoBitmap {
  width: number; // multiple of 8
  height: number;
  /** 1 bit per dot, rows top to bottom, most significant bit = leftmost dot, 1 = black. */
  bits: Uint8Array;
}

const cache = new Map<number, Promise<MonoBitmap>>();
const grayCache = new Map<number, Promise<Float32Array>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Logo image could not be loaded'));
    img.src = src;
  });
}

/**
 * Convert greyscale (0 = black … 255 = white) to a 1-bit bitmap with
 * Floyd–Steinberg dithering, so shading shows up as dot patterns.
 */
export function ditherToBitmap(gray: Float32Array, width: number, height: number): MonoBitmap {
  const g = Float32Array.from(gray);
  const bytesPerRow = width / 8;
  const bits = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = g[i];
      const black = old < 128;
      const err = old - (black ? 0 : 255);
      if (black) bits[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      if (x + 1 < width) g[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) g[i + width - 1] += (err * 3) / 16;
        g[i + width] += (err * 5) / 16;
        if (x + 1 < width) g[i + width + 1] += err / 16;
      }
    }
  }
  return { width, height, bits };
}

/**
 * Greyscale pixels of the logo, with the black background around the badge
 * turned white (flood-filled from the corners) so it doesn't waste ink and
 * paper as a solid black square.
 */
function logoGray(img: HTMLImageElement, size: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const gray = new Float32Array(size * size);
  for (let i = 0; i < gray.length; i++) {
    const l = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    // A little extra contrast keeps the lettering readable after dithering.
    gray[i] = Math.max(0, Math.min(255, (l - 128) * 1.25 + 140));
  }

  const isBg = (i: number) => data[i * 4] < 40 && data[i * 4 + 1] < 40 && data[i * 4 + 2] < 40;
  const seen = new Uint8Array(size * size);
  const stack = [0, size - 1, size * (size - 1), size * size - 1];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i] || !isBg(i)) continue;
    seen[i] = 1;
    gray[i] = 255;
    const x = i % size;
    if (x > 0) stack.push(i - 1);
    if (x < size - 1) stack.push(i + 1);
    if (i >= size) stack.push(i - size);
    if (i < size * (size - 1)) stack.push(i + size);
  }
  return gray;
}

/** Greyscale logo pixels (white background), `size` x `size`. Cached per size. */
export function logoGrayPixels(size: number): Promise<Float32Array> {
  let p = grayCache.get(size);
  if (!p) {
    p = loadImage(LOGO_URL).then((img) => logoGray(img, size));
    p.catch(() => grayCache.delete(size)); // try again next time
    grayCache.set(size, p);
  }
  return p;
}

/** The logo as a printer bitmap, `widthDots` wide. Cached per width. */
export function logoBitmap(widthDots: number): Promise<MonoBitmap> {
  const size = Math.round(widthDots / 8) * 8;
  let p = cache.get(size);
  if (!p) {
    p = loadImage(LOGO_URL).then((img) => ditherToBitmap(logoGray(img, size), size, size));
    p.catch(() => cache.delete(size)); // try again next time
    cache.set(size, p);
  }
  return p;
}

/** ESC/POS "print raster bit image" (GS v 0), centred. */
export function escPosRaster(bmp: MonoBitmap): Uint8Array {
  const xBytes = bmp.width / 8;
  const header = [
    0x1b, 0x61, 1, // centre
    0x1d, 0x76, 0x30, 0x00, // GS v 0, normal size
    xBytes & 0xff, xBytes >> 8,
    bmp.height & 0xff, bmp.height >> 8,
  ];
  const out = new Uint8Array(header.length + bmp.bits.length + 1);
  out.set(header, 0);
  out.set(bmp.bits, header.length);
  out[out.length - 1] = 0x0a; // small gap below the logo
  return out;
}
