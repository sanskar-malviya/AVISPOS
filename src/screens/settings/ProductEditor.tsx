import { useEffect, useState, type FormEvent } from 'react';
import { createProduct, updateProduct } from '../../data/products';
import { deleteProductImage, uploadProductImage } from '../../data/images';
import { resizeImage } from '../../lib/image';
import { formatINR, paiseToRupees } from '../../lib/money';
import { useToast } from '../../components/Toast';
import { useOnline } from '../../app/useOnline';
import type { Product } from '../../lib/types';

const MAX_PRICE_RUPEES = 99999;

interface Props {
  product?: Product; // undefined = adding a new product
  nextSortOrder: number;
  onClose: () => void;
}

export function ProductEditor({ product, nextSortOrder, onClose }: Props) {
  const toast = useToast();
  const online = useOnline();
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? String(paiseToRupees(product.pricePaise)) : '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.imageUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const rupees = Number(price);
  const priceChanged = product && price !== '' && rupees * 100 !== product.pricePaise;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) {
      setError('Enter a product name (up to 40 characters).');
      return;
    }
    if (!Number.isInteger(rupees) || rupees < 1 || rupees > MAX_PRICE_RUPEES) {
      setError(`Enter a whole-rupee price between ₹1 and ₹${MAX_PRICE_RUPEES.toLocaleString('en-IN')}.`);
      return;
    }
    if (!online) {
      setError('You are offline. Product changes need an internet connection.');
      return;
    }
    setSaving(true);
    try {
      const pricePaise = rupees * 100;
      let id = product?.id;
      if (!id) {
        id = await createProduct({ name: trimmed, pricePaise, sortOrder: nextSortOrder });
      } else if (trimmed !== product!.name || pricePaise !== product!.pricePaise) {
        await updateProduct(id, { name: trimmed, pricePaise });
      }
      if (file) {
        const blob = await resizeImage(file);
        const { url, path } = await uploadProductImage(id, blob);
        await updateProduct(id, { imageUrl: url, imagePath: path });
        if (product?.imagePath) await deleteProductImage(product.imagePath);
      }
      toast.success(product ? 'Product updated' : 'Product added');
      onClose();
    } catch (err) {
      setError(`Could not save: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="card w-[min(94vw,32rem)] max-h-[92vh] overflow-y-auto p-6"
      >
        <h2 className="text-xl font-extrabold mb-4">{product ? 'Edit product' : 'Add product'}</h2>

        <div className="flex gap-4 items-start">
          <div className="w-32 shrink-0">
            <div className="aspect-[4/3] rounded-xl bg-stone-100 overflow-hidden grid place-items-center text-stone-400 text-xs">
              {preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                'No photo'
              )}
            </div>
            <label className="btn-secondary w-full mt-2 text-sm cursor-pointer min-h-0 py-2">
              {preview ? 'Replace photo' : 'Add photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Name</label>
              <input
                className="input w-full"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Price (₹)</label>
              <input
                className="input w-full"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_PRICE_RUPEES}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              {priceChanged && Number.isInteger(rupees) && rupees > 0 && (
                <p className="text-xs text-stone-600 mt-1">
                  {formatINR(product!.pricePaise)} → <strong>{formatINR(rupees * 100)}</strong>.
                  Applies to new orders only — past orders keep their original price. The change is
                  recorded in the audit log.
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm font-semibold text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
