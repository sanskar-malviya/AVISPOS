import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopData } from '../app/data';
import { useCart, buildCartLines } from '../store/cartStore';
import { ProductCard } from '../components/ProductCard';
import { OrderPanel } from '../components/OrderPanel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { sumPaise } from '../lib/money';

export function Billing() {
  const navigate = useNavigate();
  const { products, loading, error } = useShopData();
  const { qtyByProduct, add, increment, decrement, remove, clear } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);

  // Only active products appear on the billing screen. Unavailable ones remain
  // visible (greyed) via the ProductCard, but inactive ones are hidden entirely.
  const visibleProducts = useMemo(
    () => products.filter((p) => p.active),
    [products],
  );

  const lines = useMemo(
    () => buildCartLines(products, qtyByProduct),
    [products, qtyByProduct],
  );
  const grandTotalPaise = useMemo(
    () => sumPaise(lines.map((l) => l.lineTotalPaise)),
    [lines],
  );

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* LEFT: menu grid */}
      <section className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div className="h-full grid place-items-center text-stone-400 font-semibold">
            Loading menu…
          </div>
        ) : error ? (
          <div className="h-full grid place-items-center text-center px-6">
            <div className="text-red-700">
              <p className="font-bold text-lg">Could not load the menu</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="h-full grid place-items-center text-center px-6 text-stone-500">
            <div>
              <p className="font-bold text-lg">No products yet</p>
              <p className="text-sm mt-1">
                Ask the owner to add items in Settings → Products.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {visibleProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                qty={qtyByProduct[p.id] ?? 0}
                onTap={() => add(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* RIGHT: current order */}
      <section className="shrink-0 h-2/5 lg:h-full lg:w-[24rem]">
        <OrderPanel
          lines={lines}
          grandTotalPaise={grandTotalPaise}
          onIncrement={increment}
          onDecrement={decrement}
          onRemove={remove}
          onClear={() => setConfirmClear(true)}
          onContinue={() => navigate('/payment')}
        />
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this order?"
        message="All selected items will be removed. This cannot be undone."
        confirmLabel="Clear Order"
        danger
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
