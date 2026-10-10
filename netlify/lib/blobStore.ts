// Backup storage. On Netlify: Netlify Blobs (store "backups"). Locally (when
// LOCAL_BLOBS_DIR is set by scripts/dev-functions.ts): plain files on disk.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SimpleStore {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  list(): Promise<string[]>;
}

const SAFE_KEY = /^[a-z0-9.-]+$/;

export async function backupStore(): Promise<SimpleStore> {
  const dir = process.env.LOCAL_BLOBS_DIR;
  if (dir) {
    await mkdir(dir, { recursive: true });
    return {
      async set(key, value) {
        if (!SAFE_KEY.test(key)) throw new Error('bad key');
        await writeFile(join(dir, key), value, 'utf8');
      },
      async get(key) {
        if (!SAFE_KEY.test(key)) return null;
        try {
          return await readFile(join(dir, key), 'utf8');
        } catch {
          return null;
        }
      },
      async list() {
        return (await readdir(dir)).filter((k) => SAFE_KEY.test(k));
      },
    };
  }

  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'backups', consistency: 'strong' });
  return {
    async set(key, value) {
      await store.set(key, value);
    },
    async get(key) {
      return (await store.get(key, { type: 'text' })) ?? null;
    },
    async list() {
      const { blobs } = await store.list();
      return blobs.map((b) => b.key);
    },
  };
}
