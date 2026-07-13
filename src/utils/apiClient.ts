// Advanced API client library with retry, caching, interceptors

export interface ApiConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
  cache?: boolean
  cacheTTL?: number
}

export interface ApiRequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: any
  params?: Record<string, string | number | boolean>
  headers?: Record<string, string>
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  cache?: boolean
  cacheTTL?: number
  onUploadProgress?: (progress: number) => void
  onDownloadProgress?: (progress: number) => void
}

export interface ApiResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: ApiRequestConfig
}

export interface ApiError {
  message: string
  status?: number
  statusText?: string
  data?: any
  config?: ApiRequestConfig
}

// === REQUEST/RESPONSE INTERCEPTORS ===

type RequestInterceptor = (config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>
type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>
type ErrorInterceptor = (error: ApiError) => ApiError | Promise<ApiError>

// === API CLIENT CLASS ===

export class ApiClient {
  private config: ApiConfig
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []
  private errorInterceptors: ErrorInterceptor[] = []
  private cache: Map<string, { data: any; expires: number }> = new Map()

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      cache: false,
      cacheTTL: 300000, // 5 minutes
      ...config,
    }
  }

  // Interceptor registration
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor)
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter(i => i !== interceptor)
    }
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor)
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter(i => i !== interceptor)
    }
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor)
    return () => {
      this.errorInterceptors = this.errorInterceptors.filter(i => i !== interceptor)
    }
  }

  // HTTP methods
  async get<T = any>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'GET', ...config })
  }

  async post<T = any>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'POST', data, ...config })
  }

  async put<T = any>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'PUT', data, ...config })
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'PATCH', data, ...config })
  }

  async delete<T = any>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', ...config })
  }

  // Main request method
  async request<T = any>(requestConfig: ApiRequestConfig): Promise<ApiResponse<T>> {
    let config = { ...requestConfig }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config)
    }

    // Check cache
    const cacheKey = this.getCacheKey(config)
    if (config.cache !== false && this.config.cache) {
      const cached = this.cache.get(cacheKey)
      if (cached && cached.expires > Date.now()) {
        return cached.data
      }
    }

    // Build request
    const url = this.buildURL(config.url, config.params)
    const headers = this.buildHeaders(config.headers)
    const timeout = config.timeout ?? this.config.timeout!
    const retryAttempts = config.retryAttempts ?? this.config.retryAttempts!

    try {
      const response = await this.fetchWithRetry<T>(url, {
        method: config.method || 'GET',
        headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
      }, timeout, retryAttempts, config.retryDelay || this.config.retryDelay!)

      // Apply response interceptors
      let finalResponse = response
      for (const interceptor of this.responseInterceptors) {
        finalResponse = await interceptor(finalResponse)
      }

      // Cache if enabled
      if (config.cache !== false && this.config.cache && config.method === 'GET') {
        const cacheTTL = config.cacheTTL ?? this.config.cacheTTL!
        this.cache.set(cacheKey, {
          data: finalResponse,
          expires: Date.now() + cacheTTL,
        })
      }

      return finalResponse
    } catch (error) {
      let apiError: ApiError = {
        message: error instanceof Error ? error.message : String(error),
        config,
      }

      // Apply error interceptors
      for (const interceptor of this.errorInterceptors) {
        apiError = await interceptor(apiError)
      }

      throw apiError
    }
  }

  // Fetch with retry logic
  private async fetchWithRetry<T>(
    url: string,
    init: RequestInit,
    timeout: number,
    retries: number,
    retryDelay: number
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null

    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data = response.headers.get('content-type')?.includes('application/json')
          ? await response.json()
          : await response.text()

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: this.parseHeaders(response.headers),
          config: { url, method: init.method as any },
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on 4xx errors (client errors)
        if (lastError.message.includes('HTTP 4')) {
          break
        }

        // Wait before retrying
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, i)))
        }
      }
    }

    throw lastError || new Error('Request failed')
  }

  // Helper methods
  private buildURL(path: string, params?: Record<string, string | number | boolean>): string {
    const base = this.config.baseURL.endsWith('/') ? this.config.baseURL.slice(0, -1) : this.config.baseURL
    const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`

    if (!params || Object.keys(params).length === 0) {
      return url
    }

    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')

    return `${url}?${queryString}`
  }

  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...customHeaders,
    }
  }

  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  private getCacheKey(config: ApiRequestConfig): string {
    const url = this.buildURL(config.url, config.params)
    return `${config.method || 'GET'}:${url}`
  }

  // Cache management
  clearCache(): void {
    this.cache.clear()
  }

  invalidateCache(pattern: string | RegExp): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach(key => {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      } else {
        if (pattern.test(key)) {
          this.cache.delete(key)
        }
      }
    })
  }
}

// === HELPER FUNCTIONS ===

export function createApiClient(config: ApiConfig): ApiClient {
  return new ApiClient(config)
}

// Authentication interceptor
export function createAuthInterceptor(getToken: () => string | null): RequestInterceptor {
  return (config) => {
    const token = getToken()
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      }
    }
    return config
  }
}

// Logging interceptor
export function createLoggingInterceptor(): RequestInterceptor {
  return (config) => {
    console.log(`[API] ${config.method} ${config.url}`, config)
    return config
  }
}

// Error logging interceptor
export function createErrorLoggingInterceptor(): ErrorInterceptor {
  return (error) => {
    console.error('[API Error]', error)
    return error
  }
}

// Retry on specific errors
export function createRetryInterceptor(shouldRetry: (error: ApiError) => boolean): ErrorInterceptor {
  return (error) => {
    if (shouldRetry(error)) {
      // Retry logic handled by fetchWithRetry
    }
    return error
  }
}

// === EXAMPLE USAGE ===

// Create client
export const api = createApiClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  retryAttempts: 3,
  cache: true,
  cacheTTL: 300000,
})

// Add auth interceptor
api.addRequestInterceptor(createAuthInterceptor(() => localStorage.getItem('token')))

// Add logging in development
if (import.meta.env.DEV) {
  api.addRequestInterceptor(createLoggingInterceptor())
  api.addErrorInterceptor(createErrorLoggingInterceptor())
}

// Make requests
// const response = await api.get('/users')
// const created = await api.post('/users', { name: 'John' })
// const updated = await api.put('/users/1', { name: 'Jane' })
// const deleted = await api.delete('/users/1')
