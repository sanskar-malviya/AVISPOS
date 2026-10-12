import { useState } from 'react';
import type { Product } from '../lib/types';
import { formatINR } from '../lib/money';

interface ProductCardProps {
  product: Product;
  qty: number;
  onTap: () => void;
  /** Smaller card for the Extras section. */
  compact?: boolean;
}

const FALLBACK_IMG = '/products/placeholder.jpg';

/**
 * Large, tappable food card. One tap adds +1 (handled by parent). Shows a live
 * quantity badge once selected. Unavailable products stay visible but are not
 * sellable (spec §3, §4).
 */
export function ProductCard({ product, qty, onTap, compact = false }: ProductCardProps) {
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
      <div
        className={
          'relative bg-stone-100 ' + (compact ? 'aspect-[3/2]' : 'aspect-[3/2] sm:aspect-[4/3]')
        }
      >
        <img
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          onError={() => setImgSrc(FALLBACK_IMG)}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {qty > 0 && (
          <span
            className={
              'absolute rounded-full bg-tandoori-700 text-white font-bold grid place-items-center shadow ' +
              (compact
                ? 'top-1.5 right-1.5 min-w-[1.75rem] h-7 px-1.5 text-base'
                : 'top-2 right-2 min-w-[2rem] h-8 px-2 text-lg')
            }
          >
            {qty}
          </span>
        )}
        {unavailable && (
          <span
            className={
              'absolute inset-x-0 bottom-0 bg-stone-900/70 text-white text-center font-semibold ' +
              (compact ? 'text-xs py-0.5' : 'text-sm py-1')
            }
          >
            Unavailable
          </span>
        )}
      </div>
      <div
        className={
          'flex-1 flex flex-col justify-between ' + (compact ? 'px-2 py-1.5' : 'p-2.5 sm:p-3')
        }
      >
        <div
          className={
            'font-bold text-stone-900 leading-tight ' +
            (compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg')
          }
        >
          {product.name}
        </div>
        <div
          className={
            'text-tandoori-700 font-extrabold ' +
            (compact ? 'text-base sm:text-lg' : 'mt-0.5 sm:mt-1 text-lg sm:text-xl')
          }
        >
          {formatINR(product.pricePaise)}
        </div>
      </div>
    </button>
  );
}
