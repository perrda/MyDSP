// Smart Notifications — bell menu wired into the app toolbar

import { useEffect, useCallback, useState, useRef, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { buildAlerts } from '../domain/alerts'
import { buildPriceAlertNotifications } from '../domain/priceAlerts'
import { notificationManager, type Notification } from '../utils/notifications'
import { logger } from '../utils/logger'
import {
  Bell as BellIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  XCircle as XCircleIcon,
  Trophy as TrophyIcon,
  X as XIcon,
} from 'lucide-react'

function severityToPriority(severity: string): Notification['priority'] {
  if (severity === 'red') return 'critical'
  if (severity === 'amber') return 'high'
  if (severity === 'green') return 'low'
  return 'medium'
}

function severityToType(severity: string): Notification['type'] {
  if (severity === 'red') return 'error'
  if (severity === 'amber') return 'warning'
  if (severity === 'green') return 'success'
  return 'info'
}

export function useSmartNotifications() {
  const { data } = usePortfolio()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const updateNotifications = () => {
      setNotifications(notificationManager.getAll())
    }

    updateNotifications()
    return notificationManager.subscribe(updateNotifications)
  }, [])

  const processNotifications = useCallback(() => {
    if (!data) return

    try {
      const alerts = buildAlerts(data)
      notificationManager.syncCategory(
        'portfolio-alerts',
        alerts.map((a) => ({
          id: a.id,
          type: severityToType(a.severity),
          priority: severityToPriority(a.severity),
          title: a.title,
          message: a.detail,
          actionUrl: a.to,
          actionLabel: 'Open',
          dismissible: true,
        })),
      )
      const priceAlerts = buildPriceAlertNotifications()
      notificationManager.syncCategory('price-alerts', priceAlerts)
      setNotifications(notificationManager.getAll())
    } catch (error) {
      logger.error('Failed to process smart notifications', error as Error, 'app')
    }
  }, [data])

  useEffect(() => {
    processNotifications()
    const interval = setInterval(processNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [processNotifications])

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
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

export function NotificationCenter() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useSmartNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setIsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const priorityColors = {
    low: 'bg-surface-hover text-text-muted border border-border',
    medium: 'bg-accent/10 text-accent border border-accent/30',
    high: 'bg-amber-500/10 text-amber-500 border border-amber-500/30',
    critical: 'bg-red-500/10 text-red-500 border border-red-500/30',
  }

  const typeIcons = {
    info: <InfoIcon className="w-5 h-5 text-accent" />,
    success: <CheckCircleIcon className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangleIcon className="w-5 h-5 text-amber-500" />,
    error: <XCircleIcon className="w-5 h-5 text-red-500" />,
    reminder: <BellIcon className="w-5 h-5 text-accent" />,
    achievement: <TrophyIcon className="w-5 h-5 text-accent" />,
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="toolbar-icon relative"
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <BellIcon size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="toolbar-icon-badge" aria-hidden>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-bg-elevated border border-border z-50 max-h-[min(28rem,70vh)] overflow-hidden flex flex-col shadow-lg"
        >
          <div className="p-4 border-b border-border flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold tracking-tight">Notifications</h3>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-semibold text-accent hover:underline min-h-11 px-1"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-text-muted">
                <BellIcon className="w-10 h-10 mx-auto mb-2 opacity-40 text-text-subtle" />
                <p className="text-sm">All clear</p>
                <p className="text-xs text-text-subtle mt-1">
                  Budget, debt, and goal alerts appear here when something needs attention.
                </p>
                <a
                  href="/settings#alerts"
                  className="inline-block mt-3 text-xs font-semibold text-accent hover:underline min-h-11 leading-[2.75rem]"
                  onClick={() => setIsOpen(false)}
                >
                  Alert settings
                </a>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 ${!notification.read ? 'bg-accent/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {typeIcons[notification.type as keyof typeof typeIcons]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <button
                            type="button"
                            onClick={() => remove(notification.id)}
                            className="flex-shrink-0 text-text-subtle hover:text-text min-h-11 min-w-11 inline-flex items-center justify-center"
                            aria-label="Dismiss notification"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-text-muted mt-1">{notification.message}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-text-subtle">
                          <span
                            className={`px-2 py-0.5 ${priorityColors[notification.priority as keyof typeof priorityColors]}`}
                          >
                            {notification.priority}
                          </span>
                          <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {notification.actionUrl ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-accent hover:underline min-h-11"
                              onClick={() => {
                                markAsRead(notification.id)
                                setIsOpen(false)
                                navigate(notification.actionUrl!)
                              }}
                            >
                              {notification.actionLabel ?? 'Open'}
                            </button>
                          ) : null}
                          {!notification.read && (
                            <button
                              type="button"
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs font-semibold text-text-muted hover:underline min-h-11"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
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
