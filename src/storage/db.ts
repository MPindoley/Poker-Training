/**
 * Tiny IndexedDB key-value wrapper. All progress lives on-device.
 * Falls back to an in-memory map when IndexedDB is unavailable (e.g. tests, private mode).
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'felt-academy';
const STORE = 'kv';

let dbPromise: Promise<IDBPDatabase> | null = null;
const memory = new Map<string, unknown>();

function db(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const d = db();
  if (!d) return memory.get(key) as T | undefined;
  return (await d).get(STORE, key) as Promise<T | undefined>;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const d = db();
  if (!d) {
    memory.set(key, value);
    return;
  }
  await (await d).put(STORE, value, key);
}

export async function kvDel(key: string): Promise<void> {
  const d = db();
  if (!d) {
    memory.delete(key);
    return;
  }
  await (await d).delete(STORE, key);
}

/** Adapter so Zustand's `persist` middleware can save to IndexedDB. */
export const idbStateStorage: StateStorage = {
  getItem: async (name) => (await kvGet<string>(name)) ?? null,
  setItem: (name, value) => kvSet(name, value),
  removeItem: (name) => kvDel(name),
};
