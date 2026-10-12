// Default menu for Avi's Food Corner (spec §3). Dependency-free so it can be
// imported by both the browser app and the Node seed script.
//
// Prices are in integer PAISE: ₹90 = 9000 paise, etc.

export interface DefaultProduct {
  name: string;
  pricePaise: number;
  image: string; // bundled placeholder under /products/
  category: 'main' | 'extra';
}

export const DEFAULT_PRODUCTS: DefaultProduct[] = [
  { name: 'Chole Bhature', pricePaise: 9000, image: '/products/chole-bhature.jpg', category: 'main' },
  { name: 'Pav Bhaji', pricePaise: 7000, image: '/products/pav-bhaji.jpg', category: 'main' },
  { name: 'Veg Biryani', pricePaise: 5000, image: '/products/veg-biryani.jpg', category: 'main' },
  { name: 'Chole Kulche', pricePaise: 6000, image: '/products/chole-kulche.jpg', category: 'main' },
  { name: 'Vada Pav', pricePaise: 3000, image: '/products/vada-pav.jpg', category: 'main' },
  // Add-ons, sold per piece — shown in the smaller Extras section.
  { name: 'Extra Bhatura', pricePaise: 2000, image: '/products/extra-bhatura.jpg', category: 'extra' },
  { name: 'Extra Pav', pricePaise: 1000, image: '/products/extra-pav.jpg', category: 'extra' },
  { name: 'Extra Kulcha', pricePaise: 1500, image: '/products/extra-kulcha.jpg', category: 'extra' },
];

/** Doc id used for a default product (stable, human-readable). */
export function defaultProductId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Section for a product saved before products had a `category`: the default
 * add-ons (matched by their fixed doc id) are extras, everything else is main.
 */
export function defaultCategoryFor(id: string): 'main' | 'extra' {
  return DEFAULT_PRODUCTS.find((p) => defaultProductId(p.name) === id)?.category ?? 'main';
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
