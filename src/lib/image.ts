/**
 * Downscale a photo before upload so menu images load fast on the tablet and
 * stay tiny in Cloud Storage (a phone photo can be 5+ MB; this makes ~100 KB).
 */
export async function resizeImage(file: File, maxSize = 800, quality = 0.82): Promise<Blob> {
  const { source, width, height, cleanup } = await decode(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not available on this device.');
    ctx.fillStyle = '#ffffff'; // flatten transparency for JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not process this image.'))),
        'image/jpeg',
        quality,
      ),
    );
  } finally {
    cleanup();
  }
}

async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('This file is not a supported image.'));
    img.src = url;
  });
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}
