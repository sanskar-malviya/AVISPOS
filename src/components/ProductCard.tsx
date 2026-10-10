import { useState } from 'react';
import type { Product } from '../lib/types';
import { formatINR } from '../lib/money';

interface ProductCardProps {
  product: Product;
  qty: number;
  onTap: () => void;
}

const FALLBACK_IMG = '/products/placeholder.jpg';

/**
 * Large, tappable food card. One tap adds +1 (handled by parent). Shows a live
 * quantity badge once selected. Unavailable products stay visible but are not
 * sellable (spec §3, §4).
 */
export function ProductCard({ product, qty, onTap }: ProductCardProps) {
  const [imgSrc, setImgSrc] = useState(product.imageUrl || FALLBACK_IMG);
  const unavailable = !product.available;

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={onTap}
      className={
        'relative card overflow-hidden text-left flex flex-col ' +
        'focus:outline-none focus:ring-4 focus:ring-tandoori-700/30 ' +
        (unavailable
          ? 'opacity-60 grayscale cursor-not-allowed'
          : 'active:scale-[0.98] hover:shadow-md transition')
      }
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        <img
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          onError={() => setImgSrc(FALLBACK_IMG)}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {qty > 0 && (
          <span className="absolute top-2 right-2 min-w-[2rem] h-8 px-2 rounded-full bg-tandoori-700 text-white text-lg font-bold grid place-items-center shadow">
            {qty}
          </span>
        )}
        {unavailable && (
          <span className="absolute inset-x-0 bottom-0 bg-stone-900/70 text-white text-center text-sm font-semibold py-1">
            Unavailable
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div className="font-bold text-stone-900 leading-tight text-base sm:text-lg">
          {product.name}
        </div>
        <div className="mt-1 text-tandoori-700 font-extrabold text-xl">
          {formatINR(product.pricePaise)}
        </div>
      </div>
    </button>
  );
}
