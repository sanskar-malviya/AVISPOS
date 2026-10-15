import { useState } from 'react';
import { useShopData } from '../../app/data';
import { useToast } from '../../components/Toast';
import {
  addMissingDefaultProducts,
  reorderProducts,
  seedDefaultProducts,
  setActive,
  setAvailability,
} from '../../data/products';
import { DEFAULT_PRODUCTS, missingDefaultProducts } from '../../lib/defaultProducts';
import { formatINR } from '../../lib/money';
import type { Product } from '../../lib/types';
import { ProductEditor } from './ProductEditor';

function Toggle({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex flex-col items-center gap-1 text-xs font-semibold text-stone-600 w-20"
    >
      <span
        className={
          'relative w-12 h-7 rounded-full transition-colors ' + (on ? 'bg-veg-600' : 'bg-stone-300')
        }
      >
        <span
          className={
            'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ' +
            (on ? 'left-[1.375rem]' : 'left-0.5')
          }
        />
      </span>
      {label}
    </button>
  );
}

export function ProductsTab() {
  const { products, loading } = useShopData();
  const toast = useToast();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function run(action: () => Promise<void>, ok: string) {
    try {
      await action();
      toast.success(ok);
    } catch (e) {
      toast.error(`Could not save: ${e instanceof Error ? e.message : e}`);
    }
  }

  function move(index: number, delta: -1 | 1) {
    const ids = products.map((p) => p.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() => reorderProducts(ids), 'Order updated');
  }

  if (loading) return <p className="text-stone-400">Loading…</p>;

  const missing = products.length > 0 ? missingDefaultProducts(products) : [];
  const listItems = (items: typeof DEFAULT_PRODUCTS) =>
    items.map((p) => `${p.name} ${formatINR(p.pricePaise)}`).join(', ');

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-extrabold">Products</h1>
          <p className="text-sm text-stone-500">
            Changes appear on the billing screen immediately.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          + Add product
        </button>
      </div>

      {missing.length > 0 && (
        <div className="card p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold">New on the standard menu:</span> {listItems(missing)}
          </p>
          <button
            className="btn-primary"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              await run(() => addMissingDefaultProducts(products), 'Items added to the menu');
              setSeeding(false);
            }}
          >
            {seeding ? 'Adding…' : 'Add to menu'}
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">No products yet.</p>
          <p className="text-sm text-stone-500 mt-1">
            Load the standard Avi's Food Corner menu ({listItems(DEFAULT_PRODUCTS)}) or add items one
            by one.
          </p>
          <button
            className="btn-primary mt-4"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              await run(seedDefaultProducts, 'Default menu loaded');
              setSeeding(false);
            }}
          >
            {seeding ? 'Loading…' : 'Load default menu'}
          </button>
        </div>
      ) : (
        <ul className="card divide-y divide-stone-100">
          {products.map((p, i) => (
            <li
              key={p.id}
              className={
                'p-3 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 ' +
                (p.active ? '' : 'opacity-60')
              }
            >
              <div className="flex flex-col">
                <button
                  className="w-8 h-7 text-stone-500 disabled:opacity-20"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ▲
                </button>
                <button
                  className="w-8 h-7 text-stone-500 disabled:opacity-20"
                  aria-label="Move down"
                  disabled={i === products.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ▼
                </button>
              </div>
              <div className="w-20 h-16 rounded-lg bg-stone-100 overflow-hidden shrink-0">
                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              {/* On phones the switches move to a second line. */}
              <div className="flex-1 min-w-0 basis-[calc(100%-9.5rem)] sm:basis-0">
                <div className="font-bold truncate">{p.name}</div>
                <div className="text-tandoori-700 font-extrabold">{formatINR(p.pricePaise)}</div>
                <div className="flex gap-1 mt-0.5">
                  {p.category === 'extra' && (
                    <span className="badge bg-red-50 text-tandoori-700">Extra</span>
                  )}
                  {!p.active && <span className="badge bg-stone-200 text-stone-700">Hidden</span>}
                  {p.active && !p.available && (
                    <span className="badge bg-amber-100 text-amber-800">Unavailable</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto shrink-0">
              <Toggle
                on={p.available}
                label="Available"
                onChange={(v) =>
                  void run(() => setAvailability(p.id, v), v ? `${p.name} available` : `${p.name} marked unavailable`)
                }
              />
              <Toggle
                on={p.active}
                label="On menu"
                onChange={(v) =>
                  void run(() => setActive(p.id, v), v ? `${p.name} shown on menu` : `${p.name} hidden from menu`)
                }
              />
              <button className="btn-secondary min-h-0 py-2" onClick={() => setEditing(p)}>
                Edit
              </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-stone-500">
        <strong>Available</strong> off = shown greyed out for today (e.g. sold out).{' '}
        <strong>On menu</strong> off = hidden from billing entirely. A product that has never been
        sold can be deleted from <strong>Edit</strong>; one that has been sold can only be hidden, so
        past orders and reports stay intact.
      </p>

      {editing && (
        <ProductEditor
          product={editing === 'new' ? undefined : editing}
          nextSortOrder={Math.max(-1, ...products.map((p) => p.sortOrder)) + 1}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
