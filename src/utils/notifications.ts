// Notification system logic and alert management

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
export type NotificationType = 
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'reminder'
  | 'achievement'

export interface Notification {
  id: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  timestamp: number
  read: boolean
  actionUrl?: string
  actionLabel?: string
  category?: string
  dismissible?: boolean
  persistent?: boolean
  expiresAt?: number
  metadata?: Record<string, any>
}

export interface NotificationSettings {
  enabled: boolean
  soundEnabled: boolean
  desktopEnabled: boolean
  categories: Record<string, boolean>
  priorityThreshold: NotificationPriority
  quietHoursStart?: string // HH:MM
  quietHoursEnd?: string // HH:MM
}

const SETTINGS_KEY = 'mydsp_notification_settings'

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: false,
  desktopEnabled: false,
  categories: {},
  priorityThreshold: 'critical',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

function loadPersistedSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      categories: { ...DEFAULT_SETTINGS.categories, ...(parsed.categories ?? {}) },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function persistSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore quota */
  }
}

// === NOTIFICATION STORE ===

class NotificationManager {
  private notifications: Notification[] = []
  private listeners: Array<(notifications: Notification[]) => void> = []
  private settings: NotificationSettings = loadPersistedSettings()
  private settingsListeners: Array<(settings: NotificationSettings) => void> = []
  
  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false
    }
    
    this.notifications.unshift(newNotification)
    
    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100)
    }
    
    this.notifyListeners()
    this.showNotification(newNotification)
    
    return newNotification
  }
  
  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id)
    if (notification) {
      notification.read = true
      this.notifyListeners()
    }
  }
  
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true)
    this.notifyListeners()
  }
  
  remove(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id)
    this.notifyListeners()
  }
  
  clear(): void {
    this.notifications = []
    this.notifyListeners()
  }

  /**
   * Replace all notifications in a category while preserving read state
   * for matching ids (used to sync portfolio alerts into the bell).
   */
  syncCategory(
    category: string,
    items: Array<Omit<Notification, 'timestamp' | 'read' | 'category'> & { id: string }>,
  ): void {
    const previous = this.notifications.filter((n) => n.category === category)
    const previousIds = new Set(previous.map((p) => p.id))
    const kept = this.notifications.filter((n) => n.category !== category)
    const next: Notification[] = items.map((item) => {
      const prev = previous.find((p) => p.id === item.id)
      return {
        ...item,
        category,
        timestamp: prev?.timestamp ?? Date.now(),
        read: prev?.read ?? false,
      }
    })
    this.notifications = [...next, ...kept].slice(0, 100)
    this.notifyListeners()

    // Desktop/OS alert only for newly appeared *critical* items
    // (budget overrun, RAG red, high utilisation — mapped from AppAlert severity red).
    for (const n of next) {
      if (previousIds.has(n.id)) continue
      if (n.priority === 'critical') {
        void this.showNotification(n)
      }
    }
  }
  
  get(id: string): Notification | undefined {
    return this.notifications.find(n => n.id === id)
  }
  
  getAll(): Notification[] {
    this.cleanupExpired()
    return [...this.notifications]
  }
  
  getUnread(): Notification[] {
    this.cleanupExpired()
    return this.notifications.filter(n => !n.read)
  }
  
  getByCategory(category: string): Notification[] {
    return this.notifications.filter(n => n.category === category)
  }
  
  getByPriority(priority: NotificationPriority): Notification[] {
    return this.notifications.filter(n => n.priority === priority)
  }
  
  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.notifications))
  }
  
  private cleanupExpired(): void {
    const now = Date.now()
    this.notifications = this.notifications.filter(n => {
      if (!n.expiresAt) return true
      return n.expiresAt > now
    })
  }
  
  private async showNotification(notification: Notification): Promise<void> {
    if (!this.settings.enabled) return
    
    // Check quiet hours
    if (this.isQuietHours()) return
    
    // Check priority threshold
    if (!this.meetsThreshold(notification.priority)) return
    
    // Category opt-out: missing key = allowed; only block when explicitly false
    if (notification.category && this.settings.categories[notification.category] === false) return
    
    // Show desktop notification
    if (this.settings.desktopEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: this.getIconForType(notification.type),
          tag: notification.id
        })
      }
    }
    
    // Play sound
    if (this.settings.soundEnabled) {
      this.playNotificationSound(notification.priority)
    }
  }
  
  private isQuietHours(): boolean {
    if (!this.settings.quietHoursStart || !this.settings.quietHoursEnd) return false

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const start = this.settings.quietHoursStart
    const end = this.settings.quietHoursEnd

    // Overnight range e.g. 22:00–07:00
    if (start > end) {
      return currentTime >= start || currentTime <= end
    }
    return currentTime >= start && currentTime <= end
  }
  
  private meetsThreshold(priority: NotificationPriority): boolean {
    const priorities: NotificationPriority[] = ['low', 'medium', 'high', 'critical']
    const priorityIndex = priorities.indexOf(priority)
    const thresholdIndex = priorities.indexOf(this.settings.priorityThreshold)
    
    return priorityIndex >= thresholdIndex
  }
  
  private getIconForType(_type: NotificationType): string {
    // Prefer app icon when available; browsers ignore data URLs inconsistently
    return '/favicon.svg'
  }
  
  private playNotificationSound(_priority: NotificationPriority): void {
    // Intentionally silent — OS notification + in-app bell are enough
  }
  
  updateSettings(settings: Partial<NotificationSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
      categories: settings.categories
        ? { ...this.settings.categories, ...settings.categories }
        : this.settings.categories,
    }
    persistSettings(this.settings)
    this.settingsListeners.forEach((l) => l(this.getSettings()))
  }
  
  getSettings(): NotificationSettings {
    return { ...this.settings, categories: { ...this.settings.categories } }
  }

  subscribeSettings(listener: (settings: NotificationSettings) => void): () => void {
    this.settingsListeners.push(listener)
    return () => {
      this.settingsListeners = this.settingsListeners.filter((l) => l !== listener)
    }
  }
  
  async requestDesktopPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    
    if (Notification.permission === 'granted') {
      this.updateSettings({ desktopEnabled: true })
      return true
    }
    
    const permission = await Notification.requestPermission()
    const granted = permission === 'granted'
    this.updateSettings({ desktopEnabled: granted })
    return granted
  }
}

export const notificationManager = new NotificationManager()

// === HELPER FUNCTIONS ===

export function notify(
  type: NotificationType,
  title: string,
  message: string,
  options?: Partial<Notification>
): Notification {
  return notificationManager.add({
    type,
    title,
    message,
    priority: options?.priority || 'medium',
    dismissible: options?.dismissible ?? true,
    ...options
  })
}

export function notifySuccess(title: string, message: string): Notification {
  return notify('success', title, message, { priority: 'low' })
}

export function notifyError(title: string, message: string): Notification {
  return notify('error', title, message, { priority: 'high' })
}

export function notifyWarning(title: string, message: string): Notification {
  return notify('warning', title, message, { priority: 'medium' })
}

export function notifyInfo(title: string, message: string): Notification {
  return notify('info', title, message, { priority: 'low' })
}

export function notifyReminder(title: string, message: string, actionUrl?: string): Notification {
  return notify('reminder', title, message, {
    priority: 'medium',
    actionUrl,
    actionLabel: 'View'
  })
}

