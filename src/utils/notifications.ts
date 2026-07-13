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

// === NOTIFICATION STORE ===

class NotificationManager {
  private notifications: Notification[] = []
  private listeners: Array<(notifications: Notification[]) => void> = []
  private settings: NotificationSettings = {
    enabled: true,
    soundEnabled: true,
    desktopEnabled: false,
    categories: {},
    priorityThreshold: 'low'
  }
  
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
  
  private getIconForType(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      info: '🔵',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      reminder: '⏰',
      achievement: '🏆'
    }
    return icons[type]
  }
  
  private playNotificationSound(priority: NotificationPriority): void {
    // Placeholder for sound playing logic
    // In a real app, you'd play different sounds for different priorities
    console.log(`🔊 Playing ${priority} priority notification sound`)
  }
  
  updateSettings(settings: Partial<NotificationSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
      categories: settings.categories
        ? { ...this.settings.categories, ...settings.categories }
        : this.settings.categories,
    }
  }
  
  getSettings(): NotificationSettings {
    return { ...this.settings }
  }
  
  async requestDesktopPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    
    if (Notification.permission === 'granted') return true
    
    const permission = await Notification.requestPermission()
    return permission === 'granted'
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

// === SMART NOTIFICATIONS ===

export interface SmartNotificationRule {
  id: string
  name: string
  condition: () => boolean
  notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  cooldown?: number // milliseconds
  enabled: boolean
}

class SmartNotificationEngine {
  private rules: Map<string, SmartNotificationRule> = new Map()
  private lastTriggered: Map<string, number> = new Map()
  private checkInterval?: number
  
  addRule(rule: SmartNotificationRule): void {
    this.rules.set(rule.id, rule)
  }
  
  removeRule(id: string): void {
    this.rules.delete(id)
  }
  
  startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval)
    }
    
    this.checkInterval = window.setInterval(() => {
      this.checkRules()
    }, intervalMs)
  }
  
  stopMonitoring(): void {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }
  }
  
  private checkRules(): void {
    const now = Date.now()
    
    this.rules.forEach(rule => {
      if (!rule.enabled) return
      
      // Check cooldown
      const lastTrigger = this.lastTriggered.get(rule.id) || 0
      if (rule.cooldown && now - lastTrigger < rule.cooldown) return
      
      // Check condition
      try {
        if (rule.condition()) {
          notificationManager.add(rule.notification)
          this.lastTriggered.set(rule.id, now)
        }
      } catch (error) {
        console.error(`Error checking rule ${rule.id}:`, error)
      }
    })
  }
}

export const smartNotificationEngine = new SmartNotificationEngine()

// === PRESET NOTIFICATION RULES ===

export function setupFinancialNotifications(data: {
  getBudgetUsage: (category: string) => number
  getCreditCardUtilization: () => number
  getUpcomingGoals: () => number
}): void {
  smartNotificationEngine.addRule({
    id: 'budget-warning',
    name: 'Budget Warning',
    condition: () => {
      const usage = data.getBudgetUsage('total')
      return usage > 0.8 && usage < 1.0
    },
    notification: {
      type: 'warning',
      priority: 'medium',
      title: 'Budget Alert',
      message: 'You have used 80% of your monthly budget',
      category: 'budget'
    },
    cooldown: 86400000, // 24 hours
    enabled: true
  })
  
  smartNotificationEngine.addRule({
    id: 'credit-utilization',
    name: 'High Credit Utilization',
    condition: () => {
      return data.getCreditCardUtilization() > 0.7
    },
    notification: {
      type: 'warning',
      priority: 'high',
      title: 'Credit Card Alert',
      message: 'Credit card utilization is above 70%',
      category: 'debt'
    },
    cooldown: 86400000,
    enabled: true
  })
  
  smartNotificationEngine.addRule({
    id: 'upcoming-goals',
    name: 'Goal Deadline Reminder',
    condition: () => {
      return data.getUpcomingGoals() > 0
    },
    notification: {
      type: 'reminder',
      priority: 'medium',
      title: 'Goal Deadline Approaching',
      message: 'You have goals with deadlines in the next 30 days',
      category: 'goals',
      actionUrl: '/goals'
    },
    cooldown: 604800000, // 7 days
    enabled: true
  })
}
