// Smart Notifications Hook - Integrates notification system with MyDSP data

import { useEffect, useCallback, useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { notificationManager, type Notification } from '../utils/notifications'
import { logger } from '../utils/logger'
import { Bell as BellIcon, Info as InfoIcon, CheckCircle as CheckCircleIcon, AlertTriangle as AlertTriangleIcon, XCircle as XCircleIcon, Trophy as TrophyIcon, X as XIcon } from 'lucide-react'

// === SMART NOTIFICATIONS HOOK ===

export function useSmartNotifications() {
  const { data } = usePortfolio()
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Update local state when notifications change
  useEffect(() => {
    const updateNotifications = () => {
      setNotifications(notificationManager.getAll())
    }

    updateNotifications()
    const unsubscribe = notificationManager.subscribe(updateNotifications)

    return unsubscribe
  }, [])

  // Process smart notifications based on data
  const processNotifications = useCallback(() => {
    if (!data) return

    try {
      // Example: Budget alerts
      // Note: This is a simplified version - the full SmartNotificationEngine
      // would have more sophisticated rules
      
      logger.info('Processing smart notifications', undefined, 'analytics')
      
      setNotifications(notificationManager.getAll())
    } catch (error) {
      logger.error('Failed to process smart notifications', error as Error, 'app')
    }
  }, [data])

  // Run on mount and periodically
  useEffect(() => {
    processNotifications()
    
    // Check every 5 minutes
    const interval = setInterval(processNotifications, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [processNotifications])

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    markAsRead: (id: string) => {
      notificationManager.markAsRead(id)
      setNotifications(notificationManager.getAll())
    },
    markAllAsRead: () => {
      notificationManager.markAllAsRead()
      setNotifications(notificationManager.getAll())
    },
    remove: (id: string) => {
      notificationManager.remove(id)
      setNotifications(notificationManager.getAll())
    },
    clear: () => {
      notificationManager.clear()
      setNotifications(notificationManager.getAll())
    },
  }
}

// === NOTIFICATION COMPONENT ===

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useSmartNotifications()

  const [isOpen, setIsOpen] = useState(false)

  const priorityColors = {
    low: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
    medium: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
    high: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  }

  const typeIcons = {
    info: <InfoIcon className="w-5 h-5" />,
    success: <CheckCircleIcon className="w-5 h-5" />,
    warning: <AlertTriangleIcon className="w-5 h-5" />,
    error: <XCircleIcon className="w-5 h-5" />,
    reminder: <BellIcon className="w-5 h-5" />,
    achievement: <TrophyIcon className="w-5 h-5" />,
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <BellIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {typeIcons[notification.type as keyof typeof typeIcons]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <button
                            onClick={() => remove(notification.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`px-2 py-0.5 rounded ${priorityColors[notification.priority as keyof typeof priorityColors]}`}>
                            {notification.priority}
                          </span>
                          <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
