import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { subscribeProducts } from '../data/products';
import { subscribeSettings, DEFAULT_SETTINGS } from '../data/settings';
import { requestServerCheckAfterSync } from '../data/serverCheck';
import type { BusinessSettings, Product } from '../lib/types';

interface ShopDataValue {
  products: Product[];
  settings: BusinessSettings;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}

const ShopDataContext = createContext<ShopDataValue | null>(null);

/**
 * Subscribes once to the live product catalogue and business settings and
 * shares them with every authenticated screen, so an owner's price/photo change
 * is reflected on the billing screen immediately (spec §7).
 */
export function ShopDataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const unsubProducts = subscribeProducts(
      (items, cache) => {
        setProducts(items);
        setFromCache(cache);
        setLoading(false);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    const unsubSettings = subscribeSettings(
      (s) => setSettings(s),
      (e) => setError(e.message),
    );
    // Orders sold offline are checked (and get their final number) by the
    // server as soon as the tablet is back online — and on every app start.
    requestServerCheckAfterSync();
    window.addEventListener('online', requestServerCheckAfterSync);
    return () => {
      unsubProducts();
      unsubSettings();
      window.removeEventListener('online', requestServerCheckAfterSync);
    };
  }, []);

  return (
    <ShopDataContext.Provider
      value={{ products, settings, loading, error, fromCache }}
    >
      {children}
    </ShopDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShopData(): ShopDataValue {
  const ctx = useContext(ShopDataContext);
  if (!ctx) throw new Error('useShopData must be used within ShopDataProvider');
  return ctx;
}
