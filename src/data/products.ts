import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_PRODUCTS } from '../lib/defaultProducts';
import type { Product } from '../lib/types';

const productsCol = collection(db, 'products');

/** uid of the signed-in user — every product write records who made it (audit). */
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

export interface NewProductInput {
  name: string;
  pricePaise: number;
  sortOrder: number;
}

export async function createProduct(input: NewProductInput): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(productsCol, {
    name: input.name,
    pricePaise: input.pricePaise,
    imageUrl: '',
    imagePath: '',
    active: true,
    available: true,
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now,
    updatedBy: who(),
  });
  return ref.id;
}

export type ProductPatch = Partial<
  Pick<Product, 'name' | 'pricePaise' | 'imageUrl' | 'imagePath' | 'active' | 'available' | 'sortOrder'>
>;

export async function updateProduct(id: string, patch: ProductPatch): Promise<void> {
  await updateDoc(doc(productsCol, id), {
    ...patch,
    updatedAt: Date.now(),
    updatedBy: who(),
  });
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

/** Slug used as the doc id for the default products (stable, human-readable). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Load the five default menu items (spec §3). Only intended for a fresh,
 * empty catalogue — the Settings screen offers it when no products exist.
 */
export async function seedDefaultProducts(): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();
  DEFAULT_PRODUCTS.forEach((p, i) => {
    batch.set(doc(productsCol, slugify(p.name)), {
      name: p.name,
      pricePaise: p.pricePaise,
      imageUrl: p.image,
      imagePath: '',
      active: true,
      available: true,
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
      updatedBy: who(),
    });
  });
  await batch.commit();
}
