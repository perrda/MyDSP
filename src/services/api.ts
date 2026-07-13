// API service with integrated caching and logging

import { createApiClient } from '../utils/apiClient'
import { createCache } from '../utils/advancedCache'
import { logger } from '../utils/logger'

// Create cache instance
export const apiCache = createCache({
  name: 'api-cache',
  maxMemorySize: 5 * 1024 * 1024, // 5MB
  maxIndexedDBSize: 20 * 1024 * 1024, // 20MB
  defaultTTL: 300000, // 5 minutes
  enableMemory: true,
  enableIndexedDB: true,
  enableLocalStorage: false,
  debug: import.meta.env.DEV,
})

// Create API client
export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.example.com',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  cache: false, // We'll handle caching manually for more control
})

// Add auth interceptor
api.addRequestInterceptor((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
    }
  }
  
  // Log API requests
  logger.debug(`API Request: ${config.method} ${config.url}`, config, 'api')
  
  return config
})

// Add response logging
api.addResponseInterceptor((response) => {
  logger.info(`API Response: ${response.status} ${response.config.url}`, {
    status: response.status,
    duration: Date.now() - (response.config as any).startTime,
  }, 'api')
  
  return response
})

// Add error logging
api.addErrorInterceptor((error) => {
  logger.error(`API Error: ${error.message}`, new Error(error.message), 'api')
  return error
})

// === CACHED API METHODS ===

export async function cachedGet<T>(
  url: string,
  options?: {
    cache?: boolean
    cacheTTL?: number
    tags?: string[]
  }
): Promise<T> {
  const cacheKey = `get:${url}`
  
  // Try cache first if enabled
  if (options?.cache !== false) {
    const stop = logger.startTimer(`cache-check:${url}`)
    const cached = await apiCache.get<T>(cacheKey)
    stop()
    
    if (cached) {
      logger.debug(`Cache hit: ${url}`, undefined, 'api')
      return cached
    }
  }
  
  // Fetch from API
  const stop = logger.startTimer(`api-fetch:${url}`)
  const response = await api.get<T>(url)
  stop()
  
  const data = response.data
  
  // Cache the response
  if (options?.cache !== false) {
    await apiCache.set(cacheKey, data, {
      ttl: options?.cacheTTL,
      tags: options?.tags,
    })
    logger.debug(`Cached: ${url}`, undefined, 'api')
  }
  
  return data
}

export async function invalidateCache(pattern?: string | string[]): Promise<void> {
  if (Array.isArray(pattern)) {
    for (const p of pattern) {
      await apiCache.clearByTag(p)
    }
  } else if (pattern) {
    await apiCache.clearByTag(pattern)
  } else {
    await apiCache.clear()
  }
  
  logger.info('Cache invalidated', { pattern }, 'api')
}

// === EXAMPLE API METHODS ===

export async function fetchPortfolioData() {
  return cachedGet('/portfolio', {
    cache: true,
    cacheTTL: 60000, // 1 minute
    tags: ['portfolio'],
  })
}

export async function fetchTransactions(params?: { from?: string; to?: string }) {
  const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : ''
  return cachedGet(`/transactions${queryString}`, {
    cache: true,
    cacheTTL: 300000, // 5 minutes
    tags: ['transactions'],
  })
}

export async function syncData(data: any) {
  logger.info('Syncing data', { dataType: typeof data }, 'api')
  
  try {
    const response = await api.post('/sync', data)
    
    // Invalidate relevant caches
    await invalidateCache(['portfolio', 'transactions'])
    
    logger.info('Data synced successfully', undefined, 'api')
    return response.data
  } catch (error) {
    logger.error('Failed to sync data', error as Error, 'api')
    throw error
  }
}

// Export cache stats for debugging
export function getApiCacheStats() {
  const stats = apiCache.getStats()
  logger.info('API Cache Stats', stats, 'api')
  return stats
}
