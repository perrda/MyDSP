// Background Job Queue - Priority-based job processing with retry and scheduling

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type JobPriority = 'low' | 'normal' | 'high' | 'critical'

export interface Job<T = any> {
  id: string
  name: string
  priority: JobPriority
  status: JobStatus
  data: T
  result?: any
  error?: Error
  attempts: number
  maxAttempts: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  nextRunAt?: number
  delay?: number
  tags?: string[]
}

export interface JobQueueConfig {
  name?: string
  concurrency?: number
  maxRetries?: number
  retryDelay?: number
  retryBackoff?: number
  persistence?: boolean
  debug?: boolean
}

export type JobHandler<T = any, R = any> = (data: T, job: Job<T>) => Promise<R> | R
export type JobProgressCallback = (progress: number, message?: string) => void

const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

// === JOB QUEUE CLASS ===

export class JobQueue {
  private config: Required<JobQueueConfig>
  private jobs: Map<string, Job> = new Map()
  private handlers: Map<string, JobHandler> = new Map()
  private running: Set<string> = new Set()
  private processTimer: number | null = null
  private listeners: Map<string, Set<(job: Job) => void>> = new Map()

  constructor(config: JobQueueConfig = {}) {
    this.config = {
      name: config.name ?? 'default',
      concurrency: config.concurrency ?? 3,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryBackoff: config.retryBackoff ?? 2,
      persistence: config.persistence ?? true,
      debug: config.debug ?? false,
    }

    // Initialize event listeners
    this.listeners.set('job:created', new Set())
    this.listeners.set('job:started', new Set())
    this.listeners.set('job:completed', new Set())
    this.listeners.set('job:failed', new Set())
    this.listeners.set('job:cancelled', new Set())

    if (this.config.persistence) {
      this.loadFromStorage()
    }

    this.startProcessing()
  }

  // === JOB MANAGEMENT ===

  // Add job to queue
  add<T = any>(
    name: string,
    data: T,
    options?: {
      priority?: JobPriority
      maxAttempts?: number
      delay?: number
      tags?: string[]
    }
  ): Job<T> {
    const job: Job<T> = {
      id: this.generateId(),
      name,
      priority: options?.priority ?? 'normal',
      status: 'pending',
      data,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? this.config.maxRetries,
      createdAt: Date.now(),
      delay: options?.delay,
      nextRunAt: options?.delay ? Date.now() + options.delay : Date.now(),
      tags: options?.tags,
    }

    this.jobs.set(job.id, job)
    this.emit('job:created', job)
    this.log('Job added:', job.id, job.name)

    if (this.config.persistence) {
      this.saveToStorage()
    }

    return job
  }

  // Register job handler
  process<T = any, R = any>(name: string, handler: JobHandler<T, R>): void {
    this.handlers.set(name, handler as JobHandler)
    this.log('Handler registered:', name)
  }

  // Cancel job
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'running') {
      this.log('Cannot cancel running job:', jobId)
      return false
    }

    job.status = 'cancelled'
    job.completedAt = Date.now()
    this.emit('job:cancelled', job)

    if (this.config.persistence) {
      this.saveToStorage()
    }

    return true
  }

  // Retry failed job
  retry(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'failed') return false

    job.status = 'pending'
    job.attempts = 0
    job.error = undefined
    job.nextRunAt = Date.now()

    this.log('Job retried:', jobId)

    if (this.config.persistence) {
      this.saveToStorage()
    }

    return true
  }

  // Remove job
  remove(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'running') {
      this.log('Cannot remove running job:', jobId)
      return false
    }

    this.jobs.delete(jobId)

    if (this.config.persistence) {
      this.saveToStorage()
    }

    return true
  }

  // Clear completed jobs
  clearCompleted(): number {
    let cleared = 0
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'cancelled') {
        this.jobs.delete(id)
        cleared++
      }
    }

    if (cleared > 0 && this.config.persistence) {
      this.saveToStorage()
    }

    return cleared
  }

  // === PROCESSING ===

  private startProcessing(): void {
    if (this.processTimer) return

    this.processTimer = window.setInterval(() => {
      this.processNextJobs()
    }, 100)
  }

  private stopProcessing(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer)
      this.processTimer = null
    }
  }

  private async processNextJobs(): Promise<void> {
    // Check if we can process more jobs
    if (this.running.size >= this.config.concurrency) {
      return
    }

    // Get next jobs to process
    const availableSlots = this.config.concurrency - this.running.size
    const nextJobs = this.getNextJobs(availableSlots)

    // Process jobs
    for (const job of nextJobs) {
      this.processJob(job)
    }
  }

  private getNextJobs(count: number): Job[] {
    const now = Date.now()
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => 
        job.status === 'pending' && 
        (!job.nextRunAt || job.nextRunAt <= now)
      )
      .sort((a, b) => {
        // Sort by priority first
        const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
        if (priorityDiff !== 0) return priorityDiff

        // Then by creation time (FIFO)
        return a.createdAt - b.createdAt
      })

    return pendingJobs.slice(0, count)
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.name)
    if (!handler) {
      this.log('No handler for job:', job.name)
      job.status = 'failed'
      job.error = new Error(`No handler registered for job: ${job.name}`)
      this.emit('job:failed', job)
      return
    }

    this.running.add(job.id)
    job.status = 'running'
    job.startedAt = Date.now()
    job.attempts++
    this.emit('job:started', job)
    this.log('Processing job:', job.id, job.name)

    try {
      const result = await handler(job.data, job)
      job.result = result
      job.status = 'completed'
      job.completedAt = Date.now()
      this.emit('job:completed', job)
      this.log('Job completed:', job.id)
    } catch (error) {
      job.error = error instanceof Error ? error : new Error(String(error))
      this.log('Job failed:', job.id, job.error.message)

      // Retry if attempts remaining
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending'
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoff, job.attempts - 1)
        job.nextRunAt = Date.now() + delay
        this.log('Retrying job:', job.id, 'in', delay, 'ms')
      } else {
        job.status = 'failed'
        job.completedAt = Date.now()
        this.emit('job:failed', job)
      }
    } finally {
      this.running.delete(job.id)

      if (this.config.persistence) {
        this.saveToStorage()
      }
    }
  }

  // === QUERY & STATS ===

  // Get job by ID
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId)
  }

  // Get all jobs
  getJobs(filter?: {
    status?: JobStatus
    name?: string
    priority?: JobPriority
    tags?: string[]
  }): Job[] {
    let jobs = Array.from(this.jobs.values())

    if (filter?.status) {
      jobs = jobs.filter(j => j.status === filter.status)
    }

    if (filter?.name) {
      jobs = jobs.filter(j => j.name === filter.name)
    }

    if (filter?.priority) {
      jobs = jobs.filter(j => j.priority === filter.priority)
    }

    if (filter?.tags) {
      jobs = jobs.filter(j => 
        filter.tags!.some(tag => j.tags?.includes(tag))
      )
    }

    return jobs
  }

  // Get queue stats
  getStats(): {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
    byPriority: Record<JobPriority, number>
    byName: Record<string, number>
  } {
    const jobs = Array.from(this.jobs.values())

    const byStatus = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<JobStatus, number>)

    const byPriority = jobs.reduce((acc, job) => {
      acc[job.priority] = (acc[job.priority] || 0) + 1
      return acc
    }, {} as Record<JobPriority, number>)

    const byName = jobs.reduce((acc, job) => {
      acc[job.name] = (acc[job.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total: jobs.length,
      pending: byStatus.pending || 0,
      running: byStatus.running || 0,
      completed: byStatus.completed || 0,
      failed: byStatus.failed || 0,
      cancelled: byStatus.cancelled || 0,
      byPriority,
      byName,
    }
  }

  // === EVENTS ===

  on(event: string, listener: (job: Job) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => this.off(event, listener)
  }

  off(event: string, listener: (job: Job) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  private emit(event: string, job: Job): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(job))
    }
  }

  // === PERSISTENCE ===

  private saveToStorage(): void {
    try {
      const serialized = Array.from(this.jobs.entries()).map(([_id, job]) => ({
        ...job,
        error: job.error ? { message: job.error.message, stack: job.error.stack } : undefined,
      }))
      localStorage.setItem(`job-queue-${this.config.name}`, JSON.stringify(serialized))
    } catch (error) {
      this.log('Failed to save to storage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(`job-queue-${this.config.name}`)
      if (!saved) return

      const jobs = JSON.parse(saved) as Array<Job>
      jobs.forEach(job => {
        // Reset running jobs to pending
        if (job.status === 'running') {
          job.status = 'pending'
        }

        // Restore error
        if (job.error) {
          const err = new Error((job.error as any).message)
          err.stack = (job.error as any).stack
          job.error = err
        }

        this.jobs.set(job.id, job)
      })

      this.log('Loaded', this.jobs.size, 'jobs from storage')
    } catch (error) {
      this.log('Failed to load from storage:', error)
    }
  }

  // === UTILITIES ===

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[JobQueue]', ...args)
    }
  }

  // Pause processing
  pause(): void {
    this.stopProcessing()
    this.log('Queue paused')
  }

  // Resume processing
  resume(): void {
    this.startProcessing()
    this.log('Queue resumed')
  }

  // Shutdown queue
  async shutdown(): Promise<void> {
    this.stopProcessing()

    // Wait for running jobs to complete
    while (this.running.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (this.config.persistence) {
      this.saveToStorage()
    }

    this.log('Queue shutdown')
  }
}

// === HELPER FUNCTIONS ===

export function createJobQueue(config?: JobQueueConfig): JobQueue {
  return new JobQueue(config)
}

// === SCHEDULING HELPERS ===

// Schedule recurring job (cron-like)
export function scheduleRecurring(
  queue: JobQueue,
  name: string,
  data: any,
  intervalMs: number,
  options?: { priority?: JobPriority }
): () => void {
  const schedule = () => {
    queue.add(name, data, {
      priority: options?.priority,
      delay: intervalMs,
    })
  }

  schedule() // Schedule first run
  const timer = setInterval(schedule, intervalMs)

  return () => clearInterval(timer)
}

// === EXAMPLE USAGE ===

/*
// Create queue
const queue = createJobQueue({
  name: 'main',
  concurrency: 5,
  maxRetries: 3,
  debug: true,
})

// Register handlers
queue.process('send-email', async (data: { to: string; subject: string; body: string }) => {
  console.log('Sending email to:', data.to)
  await sendEmail(data)
  return { sent: true }
})

queue.process('generate-report', async (data: { userId: string }, job) => {
  console.log('Generating report for user:', data.userId)
  // Simulate long-running task
  await new Promise(resolve => setTimeout(resolve, 5000))
  return { reportId: '123' }
})

// Add jobs
queue.add('send-email', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Hello!'
}, { priority: 'high' })

queue.add('generate-report', {
  userId: 'user-123'
}, { priority: 'normal', delay: 5000 })

// Listen to events
queue.on('job:completed', (job) => {
  console.log('Job completed:', job.id, job.result)
})

queue.on('job:failed', (job) => {
  console.error('Job failed:', job.id, job.error)
})

// Query jobs
const pending = queue.getJobs({ status: 'pending' })
const stats = queue.getStats()

// Schedule recurring job
const cancelSchedule = scheduleRecurring(
  queue,
  'cleanup',
  { maxAge: 7 * 24 * 60 * 60 * 1000 },
  24 * 60 * 60 * 1000 // Daily
)

// Shutdown
await queue.shutdown()
*/
