// Default menu for Avi's Food Corner (spec §3). Dependency-free so it can be
// imported by both the browser app and the Node seed script.
//
// Prices are in integer PAISE: ₹90 = 9000 paise, etc.

export interface DefaultProduct {
  name: string;
  pricePaise: number;
  image: string; // bundled placeholder under /products/
}

export const DEFAULT_PRODUCTS: DefaultProduct[] = [
  { name: 'Chole Bhature', pricePaise: 9000, image: '/products/chole-bhature.jpg' },
  { name: 'Pav Bhaji', pricePaise: 7000, image: '/products/pav-bhaji.jpg' },
  { name: 'Veg Biryani', pricePaise: 5000, image: '/products/veg-biryani.jpg' },
  { name: 'Chole Kulche', pricePaise: 6000, image: '/products/chole-kulche.jpg' },
  { name: 'Vada Pav', pricePaise: 3000, image: '/products/vada-pav.jpg' },
  // Add-ons, sold per piece.
  { name: 'Extra Bhatura', pricePaise: 2000, image: '/products/extra-bhatura.jpg' },
  { name: 'Extra Pav', pricePaise: 1000, image: '/products/extra-pav.jpg' },
  { name: 'Extra Kulcha', pricePaise: 1500, image: '/products/extra-kulcha.jpg' },
];

/** Doc id used for a default product (stable, human-readable). */
export function defaultProductId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Default products a catalogue doesn't have yet — matched by doc id or by name,
 * so items the owner already added by hand (or renamed) are not duplicated.
 */
export function missingDefaultProducts(
  existing: { id: string; name: string }[],
): DefaultProduct[] {
  const ids = new Set(existing.map((p) => p.id));
  const names = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  return DEFAULT_PRODUCTS.filter(
    (p) => !ids.has(defaultProductId(p.name)) && !names.has(p.name.toLowerCase()),
  );
}
