import type { DataFs } from '../../../../shared/data-fs'
import { joinDataPath } from '../../../../shared/data-fs'

const DB_NAME = 'handbook-helper'
const DB_VERSION = 1
const FILES_STORE = 'files'
const META_STORE = 'meta'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE)
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
    }
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = fn(store)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T)
  })
}

export class IndexedDbDataFs implements DataFs {
  async exists(path: string): Promise<boolean> {
    const normalized = joinDataPath(path)
    const value = await withStore<string | undefined>(FILES_STORE, 'readonly', (store) =>
      store.get(normalized)
    )
    if (value !== undefined) return true
    const keys = await this.allKeys()
    return keys.some((key) => key.startsWith(`${normalized}/`))
  }

  async readText(path: string): Promise<string | null> {
    const value = await withStore<string | undefined>(FILES_STORE, 'readonly', (store) =>
      store.get(joinDataPath(path))
    )
    return value ?? null
  }

  async writeText(path: string, content: string): Promise<void> {
    await withStore(FILES_STORE, 'readwrite', (store) => store.put(content, joinDataPath(path)))
  }

  async delete(path: string): Promise<void> {
    const normalized = joinDataPath(path)
    const keys = await this.allKeys()
    const toDelete = keys.filter((key) => key === normalized || key.startsWith(`${normalized}/`))
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, 'readwrite')
      const store = tx.objectStore(FILES_STORE)
      for (const key of toDelete) store.delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async listFiles(dir: string): Promise<string[]> {
    const prefix = joinDataPath(dir)
    const keys = await this.allKeys()
    const names = new Set<string>()
    for (const key of keys) {
      if (!key.startsWith(`${prefix}/`)) continue
      const rest = key.slice(prefix.length + 1)
      const name = rest.split('/')[0]
      if (name?.endsWith('.json')) names.add(name)
    }
    return [...names].filter(
      (f) =>
        !f.startsWith('fluff-') &&
        f !== 'index.json' &&
        f !== 'foundry.json' &&
        f !== 'sources.json'
    )
  }

  private async allKeys(): Promise<string[]> {
    return withStore(FILES_STORE, 'readonly', (store) => store.getAllKeys() as IDBRequest<string[]>)
  }
}

export async function readMeta<T>(key: string): Promise<T | null> {
  const value = await withStore<T | undefined>(META_STORE, 'readonly', (store) => store.get(key))
  return value ?? null
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await withStore(META_STORE, 'readwrite', (store) => store.put(value, key))
}

export async function deleteMeta(key: string): Promise<void> {
  await withStore(META_STORE, 'readwrite', (store) => store.delete(key))
}
