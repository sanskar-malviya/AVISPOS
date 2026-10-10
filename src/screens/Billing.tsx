import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopData } from '../app/data';
import { useCart, buildCartLines } from '../store/cartStore';
import { ProductCard } from '../components/ProductCard';
import { OrderPanel } from '../components/OrderPanel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatINR, sumPaise } from '../lib/money';

export function Billing() {
  const navigate = useNavigate();
  const { products, loading, error } = useShopData();
  const { qtyByProduct, add, increment, decrement, remove, clear } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);
  // Phones: the order list opens as a sheet from the bottom bar.
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const empty = lines.length === 0;

  useEffect(() => {
    if (empty) setSheetOpen(false);
  }, [empty]);

  const panelProps = {
    lines,
    grandTotalPaise,
    onIncrement: increment,
    onDecrement: decrement,
    onRemove: remove,
    onClear: () => setConfirmClear(true),
    onContinue: () => navigate('/payment'),
  };

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* LEFT: menu grid */}
      <section className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
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

      {/* RIGHT (tablet / desktop): current order */}
      <section className="hidden md:block shrink-0 md:h-full md:w-[20rem] lg:w-[24rem]">
        <OrderPanel {...panelProps} />
      </section>

      {/* BOTTOM (phone): total + pay, tap to see the order */}
      <div className="md:hidden shrink-0 bg-white border-t border-stone-200 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex gap-2">
        <button
          type="button"
          disabled={empty}
          onClick={() => setSheetOpen(true)}
          className="flex-1 min-w-0 h-14 px-3 rounded-xl bg-stone-100 text-left disabled:opacity-100"
        >
          <div className="text-xs font-semibold text-stone-500 truncate">
            {empty
              ? 'Tap a dish to start'
              : `${itemCount} item${itemCount === 1 ? '' : 's'} · tap to view ▴`}
          </div>
          <div className="text-xl font-extrabold tabular-nums text-stone-900">
            {formatINR(grandTotalPaise)}
          </div>
        </button>
        <button
          type="button"
          className="btn-primary h-14 px-6 text-lg shrink-0"
          disabled={empty}
          onClick={() => navigate('/payment')}
        >
          Pay →
        </button>
      </div>

      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 flex flex-col justify-end"
          onClick={() => setSheetOpen(false)}
          role="presentation"
        >
          <div
            className="h-[80dvh] rounded-t-2xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Current order"
          >
            <OrderPanel {...panelProps} onClose={() => setSheetOpen(false)} />
          </div>
        </div>
      )}

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
