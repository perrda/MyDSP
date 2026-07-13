// Background calculations and intelligent caching system

import type { PortfolioData } from '../domain/types'

export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number // time to live in ms
}

export class Cache<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map()
  
  set(key: string, value: T, ttl: number = 5 * 60 * 1000): void {
    this.store.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    })
    
    // Clean up expired entries periodically
    if (this.store.size > 100) {
      this.cleanup()
    }
  }
  
  get(key: string): T | null {
    const entry = this.store.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      return null
    }
    
    return entry.value
  }
  
  has(key: string): boolean {
    return this.get(key) !== null
  }
  
  delete(key: string): void {
    this.store.delete(key)
  }
  
  clear(): void {
    this.store.clear()
  }
  
  invalidatePattern(pattern: RegExp): void {
    const keys = Array.from(this.store.keys())
    keys.forEach(key => {
      if (pattern.test(key)) {
        this.store.delete(key)
      }
    })
  }
  
  private cleanup(): void {
    const now = Date.now()
    const keys = Array.from(this.store.keys())
    
    keys.forEach(key => {
      const entry = this.store.get(key)!
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key)
      }
    })
  }
  
  size(): number {
    this.cleanup()
    return this.store.size
  }
}

// Global cache instances
export const calculationCache = new Cache<any>()
export const dataCache = new Cache<any>()

// === MEMOIZATION ===

export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    keyFn?: (...args: Parameters<T>) => string
    ttl?: number
  } = {}
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>()
  const { keyFn = (...args) => JSON.stringify(args), ttl = 5 * 60 * 1000 } = options
  
  return ((...args: Parameters<T>) => {
    const key = keyFn(...args)
    const cached = cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value
    }
    
    const result = fn(...args)
    cache.set(key, { value: result, timestamp: Date.now() })
    
    // Limit cache size
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value
      if (firstKey) {
        cache.delete(firstKey)
      }
    }
    
    return result
  }) as T
}

// === DEBOUNCED CALCULATIONS ===

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  
  return (...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// === BACKGROUND CALCULATIONS ===

export class BackgroundCalculator {
  async calculate<T>(
    taskId: string,
    fn: () => T | Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = calculationCache.get(taskId)
    if (cached !== null) {
      return cached as T
    }
    
    // Run calculation
    const result = await Promise.resolve(fn())
    
    // Cache result
    calculationCache.set(taskId, result, 10 * 60 * 1000) // 10 min TTL
    
    return result
  }
  
  invalidate(taskId: string): void {
    calculationCache.delete(taskId)
  }
  
  invalidateAll(): void {
    calculationCache.clear()
  }
}

export const calculator = new BackgroundCalculator()

// === PRECOMPUTED METRICS ===

export interface PrecomputedMetrics {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  cryptoValue: number
  equityValue: number
  monthlySpending: number
  yearlySpending: number
  topCategories: Array<{ category: string; amount: number }>
  recentTransactions: number
  activeGoals: number
  computedAt: number
}

export function computePortfolioMetrics(data: PortfolioData): PrecomputedMetrics {
  const cacheKey = `metrics:${data.version}:${data.spending.length}:${data.crypto.length}`
  const cached = dataCache.get(cacheKey)
  if (cached) return cached as PrecomputedMetrics
  
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  
  // Calculate assets
  const cryptoValue = data.crypto.reduce((sum, c) => sum + c.qty * c.cost, 0)
  const equityValue = data.equities.reduce((sum, e) => sum + e.shares * e.avgCost, 0)
  const totalAssets = cryptoValue + equityValue
  
  // Calculate liabilities
  const totalLiabilities = 
    data.creditCards.reduce((sum, c) => sum + c.balance, 0) +
    data.loans.reduce((sum, l) => sum + l.balance, 0)
  
  const netWorth = totalAssets - totalLiabilities
  
  // Monthly spending
  const monthlySpending = data.spending
    .filter(s => s.date.startsWith(currentMonth))
    .reduce((sum, s) => sum + Math.abs(s.amount), 0)
  
  // Yearly spending
  const yearlySpending = data.spending
    .filter(s => new Date(s.date) >= oneYearAgo)
    .reduce((sum, s) => sum + Math.abs(s.amount), 0)
  
  // Top categories
  const categoryMap = new Map<string, number>()
  data.spending.forEach(s => {
    const amount = Math.abs(s.amount)
    categoryMap.set(s.category, (categoryMap.get(s.category) || 0) + amount)
  })
  
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
  
  // Recent transactions (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentTransactions = data.spending.filter(
    s => new Date(s.date) >= thirtyDaysAgo
  ).length
  
  // Active goals
  const activeGoals = data.goals.filter(g => new Date(g.deadline) >= now).length
  
  const metrics: PrecomputedMetrics = {
    totalAssets,
    totalLiabilities,
    netWorth,
    cryptoValue,
    equityValue,
    monthlySpending,
    yearlySpending,
    topCategories,
    recentTransactions,
    activeGoals,
    computedAt: Date.now(),
  }
  
  dataCache.set(cacheKey, metrics, 2 * 60 * 1000) // 2 min TTL
  
  return metrics
}

// === INCREMENTAL CALCULATIONS ===

export class IncrementalCalculator<T> {
  private accumulator: T | null = null
  private version: number = 0
  private computeFn: (data: any[], previous: T | null) => T
  
  constructor(computeFn: (data: any[], previous: T | null) => T) {
    this.computeFn = computeFn
  }
  
  compute(data: any[], forceRecalc: boolean = false): T {
    if (forceRecalc || this.accumulator === null) {
      this.accumulator = this.computeFn(data, null)
      this.version++
      return this.accumulator
    }
    
    // Incremental update logic would go here
    // For now, just recompute
    this.accumulator = this.computeFn(data, this.accumulator)
    this.version++
    
    return this.accumulator
  }
  
  invalidate(): void {
    this.accumulator = null
    this.version = 0
  }
  
  getVersion(): number {
    return this.version
  }
}

// === LAZY LOADING HELPERS ===

export function lazyCompute<T>(
  computeFn: () => T,
  deps: any[] = []
): () => T {
  let computed: T | null = null
  let lastDeps: any[] = []
  
  return () => {
    const depsChanged = deps.some((dep, i) => dep !== lastDeps[i])
    
    if (computed === null || depsChanged) {
      computed = computeFn()
      lastDeps = [...deps]
    }
    
    return computed
  }
}

// === INDEXED DB CACHE (for large data) ===

export class IndexedDBCache {
  private dbName: string = 'mydsp-cache'
  private storeName: string = 'calculations'
  private db: IDBDatabase | null = null
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' })
        }
      }
    })
  }
  
  async set(key: string, value: any, ttl: number = 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      const request = store.put({
        key,
        value,
        timestamp: Date.now(),
        ttl,
      })
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
  
  async get(key: string): Promise<any | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        
        if (!result) {
          resolve(null)
          return
        }
        
        // Check expiry
        if (Date.now() - result.timestamp > result.ttl) {
          this.delete(key)
          resolve(null)
          return
        }
        
        resolve(result.value)
      }
    })
  }
  
  async delete(key: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
  
  async clear(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

export const idbCache = new IndexedDBCache()
