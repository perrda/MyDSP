// Advanced multi-tier caching system with memory, IndexedDB, and localStorage

export interface CacheConfig {
  name: string
  version?: number
  maxMemorySize?: number
  maxIndexedDBSize?: number
  maxLocalStorageSize?: number
  defaultTTL?: number
  enableMemory?: boolean
  enableIndexedDB?: boolean
  enableLocalStorage?: boolean
  debug?: boolean
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  ttl: number
  expires: number
  hits: number
  size: number
  tags?: string[]
}

export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  memory: {
    size: number
    maxSize: number
    entries: number
  }
  indexedDB: {
    size: number
    maxSize: number
    entries: number
  }
  localStorage: {
    size: number
    maxSize: number
    entries: number
  }
}

// === ADVANCED CACHE CLASS ===

export class AdvancedCache {
  private config: Required<CacheConfig>
  private memoryCache: Map<string, CacheEntry> = new Map()
  private db: IDBDatabase | null = null
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memory: { size: 0, maxSize: 0, entries: 0 },
    indexedDB: { size: 0, maxSize: 0, entries: 0 },
    localStorage: { size: 0, maxSize: 0, entries: 0 },
  }

  constructor(config: CacheConfig) {
    this.config = {
      name: config.name,
      version: config.version ?? 1,
      maxMemorySize: config.maxMemorySize ?? 10 * 1024 * 1024, // 10MB
      maxIndexedDBSize: config.maxIndexedDBSize ?? 50 * 1024 * 1024, // 50MB
      maxLocalStorageSize: config.maxLocalStorageSize ?? 5 * 1024 * 1024, // 5MB
      defaultTTL: config.defaultTTL ?? 3600000, // 1 hour
      enableMemory: config.enableMemory ?? true,
      enableIndexedDB: config.enableIndexedDB ?? true,
      enableLocalStorage: config.enableLocalStorage ?? true,
      debug: config.debug ?? false,
    }

    this.stats.memory.maxSize = this.config.maxMemorySize
    this.stats.indexedDB.maxSize = this.config.maxIndexedDBSize
    this.stats.localStorage.maxSize = this.config.maxLocalStorageSize

    if (this.config.enableIndexedDB) {
      this.initIndexedDB()
    }
  }

  // Initialize IndexedDB
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' })
          store.createIndex('expires', 'expires', { unique: false })
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true })
        }
      }
    })
  }

  // Get value from cache
  async get<T = any>(key: string): Promise<T | null> {
    // Try memory cache first
    if (this.config.enableMemory) {
      const memEntry = this.memoryCache.get(key)
      if (memEntry) {
        if (this.isExpired(memEntry)) {
          this.memoryCache.delete(key)
        } else {
          memEntry.hits++
          this.stats.hits++
          this.log('Memory cache hit:', key)
          return memEntry.value as T
        }
      }
    }

    // Try IndexedDB
    if (this.config.enableIndexedDB && this.db) {
      const idbEntry = await this.getFromIndexedDB<T>(key)
      if (idbEntry) {
        if (this.isExpired(idbEntry)) {
          await this.deleteFromIndexedDB(key)
        } else {
          // Promote to memory cache
          if (this.config.enableMemory) {
            this.memoryCache.set(key, idbEntry)
          }
          this.stats.hits++
          this.log('IndexedDB cache hit:', key)
          return idbEntry.value as T
        }
      }
    }

    // Try localStorage
    if (this.config.enableLocalStorage) {
      const lsEntry = this.getFromLocalStorage<T>(key)
      if (lsEntry) {
        if (this.isExpired(lsEntry)) {
          this.deleteFromLocalStorage(key)
        } else {
          // Promote to memory cache
          if (this.config.enableMemory) {
            this.memoryCache.set(key, lsEntry)
          }
          this.stats.hits++
          this.log('LocalStorage cache hit:', key)
          return lsEntry.value as T
        }
      }
    }

    this.stats.misses++
    this.log('Cache miss:', key)
    return null
  }

  // Set value in cache
  async set<T = any>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): Promise<void> {
    const ttl = options?.ttl ?? this.config.defaultTTL
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      expires: Date.now() + ttl,
      hits: 0,
      size: this.estimateSize(value),
      tags: options?.tags,
    }

    this.stats.sets++

    // Set in memory cache
    if (this.config.enableMemory) {
      await this.setInMemory(entry)
    }

    // Set in IndexedDB for larger items
    if (this.config.enableIndexedDB && entry.size > 1024 && this.db) {
      await this.setInIndexedDB(entry)
    }

    // Set in localStorage as fallback
    if (this.config.enableLocalStorage && entry.size < 100 * 1024) {
      this.setInLocalStorage(entry)
    }

    this.log('Set:', key, entry)
  }

  // Delete value from cache
  async delete(key: string): Promise<void> {
    this.stats.deletes++

    if (this.config.enableMemory) {
      this.memoryCache.delete(key)
    }

    if (this.config.enableIndexedDB && this.db) {
      await this.deleteFromIndexedDB(key)
    }

    if (this.config.enableLocalStorage) {
      this.deleteFromLocalStorage(key)
    }

    this.log('Deleted:', key)
  }

  // Clear all cache
  async clear(): Promise<void> {
    if (this.config.enableMemory) {
      this.memoryCache.clear()
    }

    if (this.config.enableIndexedDB && this.db) {
      await this.clearIndexedDB()
    }

    if (this.config.enableLocalStorage) {
      this.clearLocalStorage()
    }

    this.log('Cache cleared')
  }

  // Clear by tags
  async clearByTag(tag: string): Promise<void> {
    // Clear from memory
    if (this.config.enableMemory) {
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags?.includes(tag)) {
          this.memoryCache.delete(key)
        }
      }
    }

    // Clear from IndexedDB
    if (this.config.enableIndexedDB && this.db) {
      const keys = await this.getKeysByTag(tag)
      for (const key of keys) {
        await this.deleteFromIndexedDB(key)
      }
    }

    this.log('Cleared by tag:', tag)
  }

  // Check if key exists
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  // Get all keys
  async keys(): Promise<string[]> {
    const keys = new Set<string>()

    if (this.config.enableMemory) {
      this.memoryCache.forEach((_, key) => keys.add(key))
    }

    if (this.config.enableIndexedDB && this.db) {
      const idbKeys = await this.getIndexedDBKeys()
      idbKeys.forEach(key => keys.add(key))
    }

    return Array.from(keys)
  }

  // Get cache stats
  getStats(): CacheStats {
    this.stats.memory.entries = this.memoryCache.size
    this.stats.memory.size = Array.from(this.memoryCache.values()).reduce((sum, e) => sum + e.size, 0)
    return { ...this.stats }
  }

  // Prune expired entries
  async prune(): Promise<number> {
    let pruned = 0

    // Prune memory cache
    if (this.config.enableMemory) {
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.isExpired(entry)) {
          this.memoryCache.delete(key)
          pruned++
        }
      }
    }

    // Prune IndexedDB
    if (this.config.enableIndexedDB && this.db) {
      pruned += await this.pruneIndexedDB()
    }

    this.log('Pruned', pruned, 'entries')
    return pruned
  }

  // === MEMORY CACHE METHODS ===

  private async setInMemory<T>(entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict
    while (this.stats.memory.size + entry.size > this.config.maxMemorySize && this.memoryCache.size > 0) {
      const evictKey = this.selectEvictionCandidate()
      if (evictKey) {
        this.memoryCache.delete(evictKey)
        this.stats.evictions++
      } else {
        break
      }
    }

    this.memoryCache.set(entry.key, entry)
    this.stats.memory.size += entry.size
    this.stats.memory.entries = this.memoryCache.size
  }

  // Select LRU candidate for eviction
  private selectEvictionCandidate(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.memoryCache.entries()) {
      const score = entry.timestamp / (entry.hits + 1) // LRU with hit count
      if (score < oldestTime) {
        oldestTime = score
        oldestKey = key
      }
    }

    return oldestKey
  }

  // === INDEXEDDB METHODS ===

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readonly')
      const store = tx.objectStore('cache')
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  private async setInIndexedDB<T>(entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async getIndexedDBKeys(): Promise<string[]> {
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readonly')
      const store = tx.objectStore('cache')
      const request = store.getAllKeys()

      request.onsuccess = () => resolve(request.result as string[])
      request.onerror = () => reject(request.error)
    })
  }

  private async getKeysByTag(tag: string): Promise<string[]> {
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readonly')
      const store = tx.objectStore('cache')
      const index = store.index('tags')
      const request = index.getAllKeys(IDBKeyRange.only(tag))

      request.onsuccess = () => resolve(request.result as string[])
      request.onerror = () => reject(request.error)
    })
  }

  private async pruneIndexedDB(): Promise<number> {
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const index = store.index('expires')
      const now = Date.now()
      let pruned = 0

      const request = index.openCursor()
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          if (cursor.value.expires < now) {
            cursor.delete()
            pruned++
          }
          cursor.continue()
        } else {
          resolve(pruned)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // === LOCALSTORAGE METHODS ===

  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const item = localStorage.getItem(this.getStorageKey(key))
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  }

  private setInLocalStorage<T>(entry: CacheEntry<T>): void {
    try {
      localStorage.setItem(this.getStorageKey(entry.key), JSON.stringify(entry))
    } catch (error) {
      this.log('LocalStorage error:', error)
    }
  }

  private deleteFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(key))
    } catch (error) {
      this.log('LocalStorage error:', error)
    }
  }

  private clearLocalStorage(): void {
    try {
      const prefix = this.getStorageKey('')
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      this.log('LocalStorage error:', error)
    }
  }

  private getStorageKey(key: string): string {
    return `${this.config.name}:${key}`
  }

  // === UTILITY METHODS ===

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expires
  }

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2 // Rough estimate (UTF-16)
    } catch {
      return 0
    }
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[AdvancedCache]', ...args)
    }
  }
}

// === HELPER FUNCTIONS ===

export function createCache(config: CacheConfig): AdvancedCache {
  return new AdvancedCache(config)
}

// === EXAMPLE USAGE ===

/*
// Create cache
const cache = createCache({
  name: 'my-app-cache',
  maxMemorySize: 10 * 1024 * 1024, // 10MB
  defaultTTL: 3600000, // 1 hour
  debug: true,
})

// Set values
await cache.set('user:123', { id: 123, name: 'John' }, { ttl: 600000, tags: ['users'] })
await cache.set('posts', [{ id: 1, title: 'Hello' }], { tags: ['posts'] })

// Get values
const user = await cache.get('user:123')
const posts = await cache.get('posts')

// Delete
await cache.delete('user:123')

// Clear by tag
await cache.clearByTag('users')

// Get stats
const stats = cache.getStats()
console.log('Cache stats:', stats)

// Prune expired entries
const pruned = await cache.prune()
console.log('Pruned', pruned, 'entries')
*/
