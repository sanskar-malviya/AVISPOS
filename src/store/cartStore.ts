import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderItem, Product } from '../lib/types';

/**
 * The cart stores only productId -> quantity. All prices/names for display and
 * line totals are derived from the LIVE product list (see buildCartLines), so
 * the order always reflects the current product price (spec §4), and an owner
 * price change is reflected instantly in an in-progress cart.
 *
 * Persisted to localStorage so a page refresh, crash, or navigation never loses
 * an in-progress order (spec §9).
 */
interface CartState {
  qtyByProduct: Record<string, number>;
  add: (productId: string) => void; // +1 (used by product-card tap)
  increment: (productId: string) => void;
  decrement: (productId: string) => void; // removes line when it reaches 0
  remove: (productId: string) => void;
  clear: () => void;
  isEmpty: () => boolean;
  totalQty: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      qtyByProduct: {},

      add: (productId) =>
        set((s) => ({
          qtyByProduct: {
            ...s.qtyByProduct,
            [productId]: (s.qtyByProduct[productId] ?? 0) + 1,
          },
        })),

      increment: (productId) =>
        set((s) => ({
          qtyByProduct: {
            ...s.qtyByProduct,
            [productId]: (s.qtyByProduct[productId] ?? 0) + 1,
          },
        })),

      decrement: (productId) =>
        set((s) => {
          const next = (s.qtyByProduct[productId] ?? 0) - 1;
          const copy = { ...s.qtyByProduct };
          if (next <= 0) {
            delete copy[productId];
          } else {
            copy[productId] = next;
          }
          return { qtyByProduct: copy };
        }),

      remove: (productId) =>
        set((s) => {
          const copy = { ...s.qtyByProduct };
          delete copy[productId];
          return { qtyByProduct: copy };
        }),

      clear: () => set({ qtyByProduct: {} }),

      isEmpty: () => Object.keys(get().qtyByProduct).length === 0,

      totalQty: () =>
        Object.values(get().qtyByProduct).reduce((a, b) => a + b, 0),
    }),
    {
      name: 'aviz.cart',
      version: 1,
    },
  ),
);

/** Join the cart quantities with live products to produce display/order lines. */
export function buildCartLines(
  products: Product[],
  qtyByProduct: Record<string, number>,
): OrderItem[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: OrderItem[] = [];
  for (const [productId, qty] of Object.entries(qtyByProduct)) {
    const p = byId.get(productId);
    if (!p || qty <= 0) continue;
    lines.push({
      productId,
      name: p.name,
      unitPricePaise: p.pricePaise,
      qty,
      lineTotalPaise: p.pricePaise * qty,
    });
  }
  return lines;
}
