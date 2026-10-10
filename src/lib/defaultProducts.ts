// Default menu for Aviz Food Point (spec §3). Dependency-free so it can be
// imported by both the browser app and the Node seed script.
//
// Prices are in integer PAISE: ₹90 = 9000 paise, etc.

export interface DefaultProduct {
  name: string;
  pricePaise: number;
  image: string; // bundled placeholder under /products/
}

export const DEFAULT_PRODUCTS: DefaultProduct[] = [
  { name: 'Chole Bhature', pricePaise: 9000, image: '/products/chole-bhature.svg' },
  { name: 'Pav Bhaji', pricePaise: 7000, image: '/products/pav-bhaji.svg' },
  { name: 'Veg Biryani', pricePaise: 5000, image: '/products/veg-biryani.svg' },
  { name: 'Chole Kulche', pricePaise: 6000, image: '/products/chole-kulche.svg' },
  { name: 'Vada Pav', pricePaise: 3000, image: '/products/vada-pav.svg' },
];
