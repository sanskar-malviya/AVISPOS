import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

/** Upload a (pre-resized) product photo. Each upload gets a new path/URL, so
 *  devices never show a stale cached photo after the owner replaces it. */
export async function uploadProductImage(
  productId: string,
  image: Blob,
): Promise<{ url: string; path: string }> {
  const path = `products/${productId}/${Date.now()}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, image, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  });
  return { url: await getDownloadURL(r), path };
}

/** Best-effort removal of a replaced photo (bundled default images have no path). */
export async function deleteProductImage(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* already gone, or offline — harmless */
  }
}
