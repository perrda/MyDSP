// Comprehensive logging and monitoring system with structured logging, performance tracking, and analytics

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogCategory = 'app' | 'api' | 'ui' | 'data' | 'performance' | 'security' | 'analytics' | 'search' | 'other'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  category: LogCategory
  message: string
  data?: any
  error?: Error
  userId?: string
  sessionId?: string
  tags?: string[]
  context?: Record<string, any>
}

export interface LoggerConfig {
  level?: LogLevel
  categories?: LogCategory[]
  console?: boolean
  persist?: boolean
  maxLogs?: number
  sendToServer?: boolean
  serverUrl?: string
  batchSize?: number
  batchInterval?: number
}

export interface PerformanceMetric {
  id: string
  name: string
  timestamp: number
  duration: number
  category: string
  metadata?: Record<string, any>
}

export interface AnalyticsEvent {
  id: string
  name: string
  timestamp: number
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
}

// Log level hierarchy for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

// === LOGGER CLASS ===

export class Logger {
  private config: Required<LoggerConfig>
  private logs: LogEntry[] = []
  private metrics: PerformanceMetric[] = []
  private events: AnalyticsEvent[] = []
  private batchTimer: number | null = null
  private sessionId: string
  private userId: string | null = null

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level ?? 'info',
      categories: config.categories ?? ['app', 'api', 'ui', 'data', 'performance', 'security', 'analytics', 'other'],
      console: config.console ?? true,
      persist: config.persist ?? true,
      maxLogs: config.maxLogs ?? 1000,
      sendToServer: config.sendToServer ?? false,
      serverUrl: config.serverUrl ?? '',
      batchSize: config.batchSize ?? 10,
      batchInterval: config.batchInterval ?? 5000,
    }

    this.sessionId = this.generateId()

    if (this.config.persist) {
      this.loadFromStorage()
    }

    if (this.config.sendToServer) {
      this.startBatching()
    }
  }

  // Set user ID for logging
  setUserId(userId: string): void {
    this.userId = userId
  }

  // === LOGGING METHODS ===

  debug(message: string, data?: any, category: LogCategory = 'app'): void {
    this.log('debug', category, message, data)
  }

  info(message: string, data?: any, category: LogCategory = 'app'): void {
    this.log('info', category, message, data)
  }

  warn(message: string, data?: any, category: LogCategory = 'app'): void {
    this.log('warn', category, message, data)
  }

  error(message: string, error?: Error | any, category: LogCategory = 'app'): void {
    this.log('error', category, message, undefined, error instanceof Error ? error : undefined)
  }

  fatal(message: string, error?: Error | any, category: LogCategory = 'app'): void {
    this.log('fatal', category, message, undefined, error instanceof Error ? error : undefined)
  }

  // Core logging function
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    error?: Error,
  ): void {
    // Check if level is enabled
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return
    }

    // Check if category is enabled
    if (!this.config.categories.includes(category)) {
      return
    }

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      error,
      userId: this.userId || undefined,
      sessionId: this.sessionId,
    }

    this.logs.push(entry)

    // Trim logs if exceeds max
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs)
    }

    // Console output
    if (this.config.console) {
      this.logToConsole(entry)
    }

    // Persist to storage
    if (this.config.persist) {
      this.saveToStorage()
    }
  }

  // === PERFORMANCE TRACKING ===

  startTimer(name: string, category: string = 'performance'): () => void {
    const startTime = performance.now()
    const id = this.generateId()

    return () => {
      const duration = performance.now() - startTime
      const metric: PerformanceMetric = {
        id,
        name,
        timestamp: Date.now(),
        duration,
        category,
      }

      this.metrics.push(metric)
      this.info(`Performance: ${name} took ${duration.toFixed(2)}ms`, metric, 'performance')

      return duration
    }
  }

  // Measure async function
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const stop = this.startTimer(name)
    try {
      const result = await fn()
      stop()
      return result
    } catch (error) {
      stop()
      throw error
    }
  }

  // Log performance metric
  metric(name: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      name,
      timestamp: Date.now(),
      duration,
      category: 'performance',
      metadata,
    }

    this.metrics.push(metric)
    this.info(`Metric: ${name} = ${duration}`, metric, 'performance')
  }

  // === ANALYTICS EVENTS ===

  track(eventName: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      id: this.generateId(),
      name: eventName,
      timestamp: Date.now(),
      properties,
      userId: this.userId || undefined,
      sessionId: this.sessionId,
    }

    this.events.push(event)
    this.info(`Event: ${eventName}`, properties, 'analytics')
  }

  // Page view tracking
  pageView(path: string, title?: string): void {
    this.track('page_view', { path, title })
  }

  // User action tracking
  action(action: string, target: string, data?: any): void {
    this.track('user_action', { action, target, ...data })
  }

  // === QUERY & RETRIEVAL ===

  // Get all logs
  getLogs(options?: {
    level?: LogLevel
    category?: LogCategory
    since?: number
    limit?: number
  }): LogEntry[] {
    let filtered = this.logs

    if (options?.level) {
      const minLevel = LOG_LEVELS[options.level]
      filtered = filtered.filter(log => LOG_LEVELS[log.level] >= minLevel)
    }

    if (options?.category) {
      filtered = filtered.filter(log => log.category === options.category)
    }

    if (options?.since) {
      filtered = filtered.filter(log => log.timestamp >= options.since!)
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit)
    }

    return filtered
  }

  // Get performance metrics
  getMetrics(options?: {
    name?: string
    category?: string
    since?: number
    limit?: number
  }): PerformanceMetric[] {
    let filtered = this.metrics

    if (options?.name) {
      filtered = filtered.filter(m => m.name === options.name)
    }

    if (options?.category) {
      filtered = filtered.filter(m => m.category === options.category)
    }

    if (options?.since) {
      filtered = filtered.filter(m => m.timestamp >= options.since!)
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit)
    }

    return filtered
  }

  // Get analytics events
  getEvents(options?: {
    name?: string
    since?: number
    limit?: number
  }): AnalyticsEvent[] {
    let filtered = this.events

    if (options?.name) {
      filtered = filtered.filter(e => e.name === options.name)
    }

    if (options?.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!)
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit)
    }

    return filtered
  }

  // === REPORTING ===

  // Generate summary report
  getSummary(): {
    logs: { total: number; byLevel: Record<LogLevel, number>; byCategory: Record<LogCategory, number> }
    metrics: { total: number; avgDuration: number; slowest: PerformanceMetric | null }
    events: { total: number; byName: Record<string, number> }
  } {
    const logsByLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1
      return acc
    }, {} as Record<LogLevel, number>)

    const logsByCategory = this.logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1
      return acc
    }, {} as Record<LogCategory, number>)

    const avgDuration = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
      : 0

    const slowest = this.metrics.length > 0
      ? this.metrics.reduce((max, m) => m.duration > max.duration ? m : max)
      : null

    const eventsByName = this.events.reduce((acc, event) => {
      acc[event.name] = (acc[event.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      logs: { total: this.logs.length, byLevel: logsByLevel, byCategory: logsByCategory },
      metrics: { total: this.metrics.length, avgDuration, slowest },
      events: { total: this.events.length, byName: eventsByName },
    }
  }

  // === PERSISTENCE ===

  private saveToStorage(): void {
    try {
      localStorage.setItem('app-logger-logs', JSON.stringify(this.logs.slice(-this.config.maxLogs)))
    } catch (error) {
      console.error('[Logger] Failed to save to storage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('app-logger-logs')
      if (saved) {
        this.logs = JSON.parse(saved)
      }
    } catch (error) {
      console.error('[Logger] Failed to load from storage:', error)
    }
  }

  // === SERVER SYNC ===

  private startBatching(): void {
    if (this.batchTimer) return

    this.batchTimer = window.setInterval(() => {
      this.sendBatch()
    }, this.config.batchInterval)
  }

  private async sendBatch(): Promise<void> {
    if (!this.config.sendToServer || !this.config.serverUrl) return

    const batch = this.logs.slice(-this.config.batchSize)
    if (batch.length === 0) return

    try {
      await fetch(this.config.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: batch, metrics: this.metrics, events: this.events }),
      })
    } catch (error) {
      console.error('[Logger] Failed to send batch:', error)
    }
  }

  // === UTILITIES ===

  private logToConsole(entry: LogEntry): void {
    const color = {
      debug: 'color: gray',
      info: 'color: blue',
      warn: 'color: orange',
      error: 'color: red',
      fatal: 'color: red; font-weight: bold',
    }[entry.level]

    const prefix = `[${entry.category.toUpperCase()}]`
    console.log(`%c${prefix} ${entry.message}`, color, entry.data || '')

    if (entry.error) {
      console.error(entry.error)
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Clear all logs
  clear(): void {
    this.logs = []
    this.metrics = []
    this.events = []
    if (this.config.persist) {
      localStorage.removeItem('app-logger-logs')
    }
  }

  // Export logs as JSON
  export(): string {
    return JSON.stringify({
      logs: this.logs,
      metrics: this.metrics,
      events: this.events,
      summary: this.getSummary(),
    }, null, 2)
  }
}

// === GLOBAL LOGGER INSTANCE ===

export const logger = new Logger({
  level: import.meta.env.DEV ? 'debug' : 'info',
  console: true,
  persist: true,
  maxLogs: 1000,
})

// === HELPER FUNCTIONS ===

export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config)
}

// === EXAMPLE USAGE ===

/*
// Use global logger
logger.info('Application started')
logger.debug('Debug information', { userId: 123 })
logger.error('Something went wrong', new Error('Failed'))

// Performance tracking
const stop = logger.startTimer('fetchData')
await fetchData()
stop()

// Or with measure
await logger.measure('fetchData', async () => {
  return await fetchData()
})

// Custom metrics
logger.metric('bundle-size', 1235.55, { unit: 'kB' })

// Analytics events
logger.track('button_clicked', { button: 'submit', page: 'login' })
logger.pageView('/dashboard', 'Dashboard')
logger.action('click', 'submit-button', { form: 'login' })

// Query logs
const errors = logger.getLogs({ level: 'error', limit: 10 })
const recent = logger.getLogs({ since: Date.now() - 3600000 })

// Get metrics
const metrics = logger.getMetrics({ name: 'fetchData' })

// Generate report
const summary = logger.getSummary()
console.log('Logs:', summary.logs.total)
console.log('Errors:', summary.logs.byLevel.error || 0)
console.log('Avg duration:', summary.metrics.avgDuration)

// Export logs
const exported = logger.export()
console.log(exported)

// Set user ID
logger.setUserId('user-123')

// Clear logs
logger.clear()
*/
