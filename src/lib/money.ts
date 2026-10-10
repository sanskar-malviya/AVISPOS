// Money helpers. All amounts are integer PAISE internally.

/**
 * Format paise as a whole-rupee string with Indian digit grouping.
 * e.g. 18000 -> "₹180", 180000 -> "₹1,800"
 * The spec requires whole-rupee display (₹90, ₹50).
 */
export function formatINR(paise: number): string {
  const rupees = Math.round(paise / 100);
  return '₹' + rupees.toLocaleString('en-IN');
}

/** Format paise as a plain number string with Indian grouping (no symbol). */
export function formatRupeesPlain(paise: number): string {
  return Math.round(paise / 100).toLocaleString('en-IN');
}

/** Convert whole/decimal rupees (as entered by the owner) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paise to whole rupees (integer). */
export function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}

/** Sum a list of line totals safely in integer paise. */
export function sumPaise(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
