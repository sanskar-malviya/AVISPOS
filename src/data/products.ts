import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { callFunction } from './api';
import {
  DEFAULT_PRODUCTS,
  defaultCategoryFor,
  defaultProductId,
  missingDefaultProducts,
} from '../lib/defaultProducts';
import type { Product, ProductCategory } from '../lib/types';

const productsCol = collection(db, 'products');

/** uid of the signed-in user — every product write records who made it. */
function who(): string {
  return auth.currentUser?.uid ?? '';
}

function mapProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    name: String(data.name ?? ''),
    pricePaise: Number(data.pricePaise ?? 0),
    imageUrl: String(data.imageUrl ?? ''),
    imagePath: String(data.imagePath ?? ''),
    active: data.active !== false, // default true
    available: data.available !== false, // default true
    sortOrder: Number(data.sortOrder ?? 0),
    category:
      data.category === 'extra' || data.category === 'main' ? data.category : defaultCategoryFor(id),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/**
 * Subscribe to the product catalogue, ordered for display. Returns an
 * unsubscribe function. `fromCache` tells the UI whether data is served from
 * the offline cache.
 */
export function subscribeProducts(
  onData: (products: Product[], fromCache: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  const q = query(productsCol, orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const items = snap.docs.map((d) => mapProduct(d.id, d.data()));
      onData(items, snap.metadata.fromCache);
    },
    (err) => onError(err as Error),
  );
}

export async function getProductsOnce(): Promise<Product[]> {
  const snap = await getDocs(query(productsCol, orderBy('sortOrder', 'asc')));
  return snap.docs.map((d) => mapProduct(d.id, d.data()));
}

/**
 * Every price change (including a new product's first price) is written in the
 * same batch as an audit entry. The product records the entry's id in
 * `lastPriceAuditId`, and the security rules reject either write without the
 * other — so the price history can't be skipped (spec §11).
 */
function addPriceAudit(
  batch: WriteBatch,
  productId: string,
  productName: string,
  beforePaise: number | null,
  afterPaise: number,
): string {
  const auditId = `price-${productId}-${Date.now()}`;
  batch.set(doc(db, 'audit', auditId), {
    type: 'price_change',
    productId,
    productName,
    beforePaise,
    afterPaise,
    who: who(),
    at: serverTimestamp(),
  });
  return auditId;
}

export interface NewProductInput {
  name: string;
  pricePaise: number;
  sortOrder: number;
  category: ProductCategory;
  imageUrl?: string;
}

function newProductData(input: NewProductInput, lastPriceAuditId: string) {
  const now = Date.now();
  return {
    name: input.name,
    pricePaise: input.pricePaise,
    imageUrl: input.imageUrl ?? '',
    imagePath: '',
    active: true,
    available: true,
    sortOrder: input.sortOrder,
    category: input.category,
    createdAt: now,
    updatedAt: now,
    updatedBy: who(),
    lastPriceAuditId,
  };
}

async function createProductAt(id: string, input: NewProductInput): Promise<void> {
  const batch = writeBatch(db);
  const auditId = addPriceAudit(batch, id, input.name, null, input.pricePaise);
  batch.set(doc(productsCol, id), newProductData(input, auditId));
  await batch.commit();
}

export async function createProduct(input: NewProductInput): Promise<string> {
  const id = doc(productsCol).id;
  await createProductAt(id, input);
  return id;
}

export type ProductPatch = Partial<
  Pick<
    Product,
    'name' | 'pricePaise' | 'imageUrl' | 'active' | 'available' | 'sortOrder' | 'category'
  >
>;

/**
 * Update a product. When the patch changes the price, pass the product as it
 * is now (`current`) so the change can be audited with the old price.
 */
export async function updateProduct(
  id: string,
  patch: ProductPatch,
  current?: Pick<Product, 'name' | 'pricePaise'>,
): Promise<void> {
  const fields = { ...patch, updatedAt: Date.now(), updatedBy: who() };
  const priceChanges = patch.pricePaise !== undefined && patch.pricePaise !== current?.pricePaise;
  if (!priceChanges) {
    await updateDoc(doc(productsCol, id), fields);
    return;
  }
  if (!current) throw new Error('updateProduct: current product is required for a price change');
  const batch = writeBatch(db);
  const auditId = addPriceAudit(
    batch,
    id,
    patch.name ?? current.name,
    current.pricePaise,
    patch.pricePaise!,
  );
  batch.update(doc(productsCol, id), { ...fields, lastPriceAuditId: auditId });
  await batch.commit();
}

export function setAvailability(id: string, available: boolean): Promise<void> {
  return updateProduct(id, { available });
}

export function setActive(id: string, active: boolean): Promise<void> {
  return updateProduct(id, { active });
}

/** Persist a new display order: sortOrder = position in `orderedIds`. */
export async function reorderProducts(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();
  orderedIds.forEach((id, i) =>
    batch.update(doc(productsCol, id), { sortOrder: i, updatedAt: now, updatedBy: who() }),
  );
  await batch.commit();
}

/**
 * Delete a product that has never been sold. The security rules forbid deletes
 * from the app, so this goes through the owner-only `products` server
 * function, which checks every order first and refuses (409) if the product
 * appears in any of them. Needs an internet connection.
 */
export async function deleteProduct(id: string): Promise<void> {
  await callFunction('products', { body: { action: 'delete', id } });
}

/** Slug used as the doc id for the default products (stable, human-readable). */
export const slugify = defaultProductId;

/**
 * Load the default menu items (spec §3). Only intended for a fresh, empty
 * catalogue — the Settings screen offers it when no products exist.
 */
export async function seedDefaultProducts(): Promise<void> {
  for (const [i, p] of DEFAULT_PRODUCTS.entries()) {
    await createProductAt(slugify(p.name), {
      name: p.name,
      pricePaise: p.pricePaise,
      sortOrder: i,
      category: p.category,
      imageUrl: p.image,
    });
  }
}

/**
 * Add default menu items an existing catalogue is missing (e.g. the extra
 * bread add-ons), at the end of the menu. Existing products are untouched.
 */
export async function addMissingDefaultProducts(existing: Product[]): Promise<void> {
  let sortOrder = Math.max(-1, ...existing.map((p) => p.sortOrder)) + 1;
  for (const p of missingDefaultProducts(existing)) {
    await createProductAt(slugify(p.name), {
      name: p.name,
      pricePaise: p.pricePaise,
      sortOrder: sortOrder++,
      category: p.category,
      imageUrl: p.image,
    });
  }
}
