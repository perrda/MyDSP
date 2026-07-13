// Service Worker registration and management

import { createServiceWorkerManager } from '../utils/serviceWorkerManager'
import { logger } from '../utils/logger'

let swManager: ReturnType<typeof createServiceWorkerManager> | null = null

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service Workers not supported', undefined, 'app')
    return
  }

  try {
    swManager = createServiceWorkerManager({
      scope: '/',
      updateInterval: 3600000, // Check for updates every hour
      enableBackgroundSync: true,
      enablePushNotifications: false, // Enable when VAPID keys are configured
      debug: import.meta.env.DEV,
    })

    const registration = await swManager.register('/sw.js')
    logger.info('Service Worker registered', { scope: registration.scope }, 'app')

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      logger.info('Service Worker update found', undefined, 'app')
    })

    // Check for updates periodically
    setInterval(() => {
      swManager?.checkForUpdates()
    }, 3600000) // Every hour

  } catch (error) {
    logger.error('Service Worker registration failed', error as Error, 'app')
  }
}

export function getServiceWorkerManager() {
  return swManager
}

// Background sync for offline data
export async function syncOfflineData(data: any): Promise<void> {
  if (!swManager) {
    logger.warn('Service Worker not initialized', undefined, 'app')
    return
  }

  try {
    await swManager.registerSync('sync-data', data)
    logger.info('Background sync registered', { dataSize: JSON.stringify(data).length }, 'app')
  } catch (error) {
    logger.error('Failed to register background sync', error as Error, 'app')
  }
}

// Clear all caches
export async function clearAllCaches(): Promise<void> {
  if (!swManager) return

  try {
    await swManager.clearCache()
    logger.info('All caches cleared', undefined, 'app')
  } catch (error) {
    logger.error('Failed to clear caches', error as Error, 'app')
  }
}
