// Service Worker Manager - Advanced offline support, background sync, and push notifications

export interface ServiceWorkerConfig {
  scope?: string
  updateInterval?: number
  enableBackgroundSync?: boolean
  enablePushNotifications?: boolean
  cacheStrategies?: CacheStrategy[]
  debug?: boolean
}

export type CacheStrategy = 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate'

export interface SyncTask {
  id: string
  tag: string
  data: any
  createdAt: number
  attempts: number
}

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// === SERVICE WORKER MANAGER CLASS ===

export class ServiceWorkerManager {
  private config: Required<ServiceWorkerConfig>
  private registration: ServiceWorkerRegistration | null = null
  private updateTimer: number | null = null
  private syncTasks: Map<string, SyncTask> = new Map()
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map()

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = {
      scope: config.scope ?? '/',
      updateInterval: config.updateInterval ?? 3600000, // 1 hour
      enableBackgroundSync: config.enableBackgroundSync ?? true,
      enablePushNotifications: config.enablePushNotifications ?? false,
      cacheStrategies: config.cacheStrategies ?? ['network-first'],
      debug: config.debug ?? false,
    }
  }

  // === REGISTRATION ===

  async register(scriptURL: string): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workers not supported')
    }

    try {
      this.registration = await navigator.serviceWorker.register(scriptURL, {
        scope: this.config.scope,
      })

      this.log('Service Worker registered:', this.registration.scope)

      // Setup message listener
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event.data)
      })

      // Check for updates periodically
      if (this.config.updateInterval > 0) {
        this.startUpdateChecks()
      }

      // Listen for controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.log('Controller changed, reloading...')
        window.location.reload()
      })

      return this.registration
    } catch (error) {
      this.log('Service Worker registration failed:', error)
      throw error
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) return false

    this.stopUpdateChecks()
    const result = await this.registration.unregister()
    this.log('Service Worker unregistered:', result)
    return result
  }

  // === UPDATES ===

  async checkForUpdates(): Promise<void> {
    if (!this.registration) return

    await this.registration.update()
    this.log('Checked for updates')
  }

  private startUpdateChecks(): void {
    if (this.updateTimer) return

    this.updateTimer = window.setInterval(() => {
      this.checkForUpdates()
    }, this.config.updateInterval)
  }

  private stopUpdateChecks(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  // Skip waiting and activate new service worker
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    this.log('Skip waiting sent')
  }

  // === BACKGROUND SYNC ===

  async registerSync(tag: string, data?: any): Promise<void> {
    if (!this.config.enableBackgroundSync) {
      throw new Error('Background sync not enabled')
    }

    if (!this.registration) {
      throw new Error('Service Worker not registered')
    }

    // Check if sync is supported
    if (!('sync' in this.registration)) {
      this.log('Background Sync API not supported, queueing for later')
      // Fallback: store for manual sync
      const task: SyncTask = {
        id: this.generateId(),
        tag,
        data,
        createdAt: Date.now(),
        attempts: 0,
      }
      this.syncTasks.set(task.id, task)
      return
    }

    const task: SyncTask = {
      id: this.generateId(),
      tag,
      data,
      createdAt: Date.now(),
      attempts: 0,
    }

    this.syncTasks.set(task.id, task)
    await (this.registration as any).sync.register(tag)
    this.log('Sync registered:', tag)
  }

  getSyncTasks(): SyncTask[] {
    return Array.from(this.syncTasks.values())
  }

  // === PUSH NOTIFICATIONS ===

  async subscribePush(vapidPublicKey: string): Promise<PushSubscriptionData> {
    if (!this.config.enablePushNotifications) {
      throw new Error('Push notifications not enabled')
    }

    if (!this.registration) {
      throw new Error('Service Worker not registered')
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      throw new Error('Notification permission denied')
    }

    const subscription = await this.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as any,
    })

    const data = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
      },
    }

    this.log('Push subscription created')
    return data
  }

  async unsubscribePush(): Promise<boolean> {
    if (!this.registration) return false

    const subscription = await this.registration.pushManager.getSubscription()
    if (!subscription) return false

    const result = await subscription.unsubscribe()
    this.log('Push unsubscribed:', result)
    return result
  }

  async getPushSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null
    return await this.registration.pushManager.getSubscription()
  }

  // === CACHE MANAGEMENT ===

  async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      await caches.delete(cacheName)
      this.log('Cache deleted:', cacheName)
    } else {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      this.log('All caches deleted')
    }
  }

  async getCacheNames(): Promise<string[]> {
    return await caches.keys()
  }

  async getCacheSize(cacheName: string): Promise<number> {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    
    let totalSize = 0
    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }

    return totalSize
  }

  // === MESSAGING ===

  postMessage(message: any): void {
    if (!navigator.serviceWorker.controller) return
    navigator.serviceWorker.controller.postMessage(message)
  }

  onMessage(type: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)
    return () => this.offMessage(type, handler)
  }

  offMessage(type: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(type)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  private handleMessage(message: any): void {
    if (!message || !message.type) return

    const handlers = this.messageHandlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => handler(message.data))
    }

    this.log('Message received:', message.type)
  }

  // === STATUS ===

  isSupported(): boolean {
    return 'serviceWorker' in navigator
  }

  isRegistered(): boolean {
    return this.registration !== null
  }

  isControlling(): boolean {
    return navigator.serviceWorker.controller !== null
  }

  getState(): string {
    if (!this.registration) return 'unregistered'
    if (this.registration.installing) return 'installing'
    if (this.registration.waiting) return 'waiting'
    if (this.registration.active) return 'active'
    return 'unknown'
  }

  // === UTILITIES ===

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[ServiceWorkerManager]', ...args)
    }
  }
}

// === HELPER FUNCTIONS ===

export function createServiceWorkerManager(config?: ServiceWorkerConfig): ServiceWorkerManager {
  return new ServiceWorkerManager(config)
}

// Check if service worker is supported
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator
}

// Check if background sync is supported
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as any)
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// === EXAMPLE USAGE ===

/*
// Create manager
const swManager = createServiceWorkerManager({
  scope: '/',
  updateInterval: 3600000, // Check for updates every hour
  enableBackgroundSync: true,
  enablePushNotifications: true,
  debug: true,
})

// Register service worker
await swManager.register('/service-worker.js')

// Check for updates
await swManager.checkForUpdates()

// Skip waiting (activate new version)
await swManager.skipWaiting()

// Background sync
await swManager.registerSync('sync-data', { type: 'transactions' })

// Push notifications
const subscription = await swManager.subscribePush('YOUR_VAPID_PUBLIC_KEY')
console.log('Push subscription:', subscription)

// Send message to service worker
swManager.postMessage({ type: 'CACHE_URLS', urls: ['/api/data'] })

// Listen for messages from service worker
swManager.onMessage('SYNC_COMPLETE', (data) => {
  console.log('Sync completed:', data)
})

// Cache management
const cacheNames = await swManager.getCacheNames()
const size = await swManager.getCacheSize('api-cache')
await swManager.clearCache('old-cache')

// Status
console.log('Supported:', swManager.isSupported())
console.log('Registered:', swManager.isRegistered())
console.log('Controlling:', swManager.isControlling())
console.log('State:', swManager.getState())

// Unregister
await swManager.unregister()
*/
