// Pure order-validation logic (no Firebase imports) — unit tested.

export function formatOrderNumber(dateKey: string, seq: number): string {
  return `${dateKey}-${String(seq).padStart(4, '0')}`;
}

const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNonNegInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const rs = (paise: number) => `Rs.${Math.round(paise / 100)}`;

/**
 * Re-check an order's money server-side (spec §11).
 *  - every line total must equal qty × unit price,
 *  - subtotal must equal the sum of line totals, and total must equal subtotal,
 *  - every product must exist, and the unit price must match the menu price.
 *
 * Returns a list of human-readable problems (empty = valid). A price mismatch
 * can be legitimate (an offline sale that synced after a price change), so it
 * is flagged for the owner to review rather than silently "corrected".
 */
export function validateOrder(
  order: Record<string, unknown>,
  menuPrices: Map<string, number>,
): string[] {
  const errors: string[] = [];
  const items = order.items;
  if (!Array.isArray(items) || items.length === 0) return ['Order has no items'];

  let sum = 0;
  items.forEach((raw, i) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const label = typeof it.name === 'string' && it.name ? it.name : `Item ${i + 1}`;
    const qtyOk = isPosInt(it.qty);
    const priceOk = isNonNegInt(it.unitPricePaise);

    if (!qtyOk) errors.push(`${label}: invalid quantity`);
    if (!priceOk) errors.push(`${label}: invalid unit price`);
    if (qtyOk && priceOk && it.lineTotalPaise !== (it.qty as number) * (it.unitPricePaise as number)) {
      errors.push(`${label}: line total does not equal quantity × price`);
    }
    if (isNonNegInt(it.lineTotalPaise)) sum += it.lineTotalPaise;
    else errors.push(`${label}: invalid line total`);

    const menuPrice = menuPrices.get(String(it.productId ?? ''));
    if (menuPrice === undefined) {
      errors.push(`${label}: product not found in the menu`);
    } else if (priceOk && menuPrice !== it.unitPricePaise) {
      errors.push(
        `${label}: sold at ${rs(it.unitPricePaise as number)} but the menu price is ${rs(menuPrice)}`,
      );
    }
  });

  if (order.subtotalPaise !== sum) errors.push('Subtotal does not equal the sum of the items');
  if (order.grandTotalPaise !== order.subtotalPaise) errors.push('Total does not equal the subtotal');
  return errors;
}
