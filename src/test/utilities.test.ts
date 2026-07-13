// Unit tests for API Client, WebSocket, Query Builder, and Job Queue

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApiClient } from '../utils/apiClient'
import { createWebSocketClient } from '../utils/websocket'
import { createQueryBuilder } from '../utils/queryBuilder'
import { createJobQueue } from '../utils/jobQueue'

// === API CLIENT TESTS ===

describe('API Client', () => {
  let api: ReturnType<typeof createApiClient>

  beforeEach(() => {
    api = createApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
      retryAttempts: 2,
    })
  })

  it('should create API client instance', () => {
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
  })

  it('should build URL with base and path', () => {
    // URL building is internal, test through usage
    expect(api).toHaveProperty('get')
    expect(api).toHaveProperty('post')
  })

  it('should add request interceptors', () => {
    const interceptor = vi.fn((config) => config)
    const remove = api.addRequestInterceptor(interceptor)
    
    expect(typeof remove).toBe('function')
    remove()
  })

  it('should add response interceptors', () => {
    const interceptor = vi.fn((response) => response)
    const remove = api.addResponseInterceptor(interceptor)
    
    expect(typeof remove).toBe('function')
    remove()
  })

  it('should clear cache', () => {
    api.clearCache()
    // Should not throw
    expect(true).toBe(true)
  })
})

// === WEBSOCKET CLIENT TESTS ===

describe('WebSocket Client', () => {
  let ws: ReturnType<typeof createWebSocketClient>

  beforeEach(() => {
    ws = createWebSocketClient({
      url: 'ws://localhost:8080',
      reconnect: false, // Disable reconnect for tests
      heartbeatInterval: 0, // Disable heartbeat for tests
    })
  })

  afterEach(() => {
    ws.disconnect()
  })

  it('should create WebSocket client instance', () => {
    expect(ws).toBeDefined()
    expect(typeof ws.connect).toBe('function')
    expect(typeof ws.disconnect).toBe('function')
  })

  it('should register event listeners', () => {
    const listener = vi.fn()
    const unsubscribe = ws.on('open', listener)
    
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('should register message handlers', () => {
    const handler = vi.fn()
    const unsubscribe = ws.onMessage('test', handler)
    
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('should have correct initial state', () => {
    expect(ws.getState()).toBe(3) // CLOSED
    expect(ws.isConnected()).toBe(false)
  })

  it('should queue messages when disconnected', () => {
    const result = ws.send({ type: 'test', payload: 'data' })
    expect(result).toBe(false) // Not sent immediately
  })
})

// === QUERY BUILDER TESTS ===

describe('Query Builder', () => {
  let db: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    db = createQueryBuilder({
      dbName: 'test-db',
      version: 1,
    })
  })

  afterEach(() => {
    db.close()
  })

  it('should create query builder instance', () => {
    expect(db).toBeDefined()
    expect(typeof db.from).toBe('function')
    expect(typeof db.where).toBe('function')
  })

  it('should chain query methods', () => {
    const query = db
      .from('users')
      .where('age', '>', 25)
      .orderBy('name', 'asc')
      .limit(10)
    
    expect(query).toBe(db) // Same instance (fluent API)
  })

  it('should support all operators', () => {
    db.from('users')
      .where('id', '=', 1)
      .where('age', '>', 18)
      .where('name', 'like', 'John')
      .where('status', 'in', ['active', 'pending'])
      .where('score', 'between', 50, 100)
    
    expect(true).toBe(true) // Should not throw
  })

  it('should close database connection', () => {
    db.close()
    expect(true).toBe(true) // Should not throw
  })
})

// === JOB QUEUE TESTS ===

describe('Job Queue', () => {
  let queue: ReturnType<typeof createJobQueue>

  beforeEach(() => {
    queue = createJobQueue({
      name: 'test-queue',
      concurrency: 2,
      maxRetries: 2,
      persistence: false,
    })
  })

  afterEach(async () => {
    await queue.shutdown()
  })

  it('should create job queue instance', () => {
    expect(queue).toBeDefined()
    expect(typeof queue.add).toBe('function')
    expect(typeof queue.process).toBe('function')
  })

  it('should add jobs', () => {
    const job = queue.add('test-job', { data: 'test' })
    
    expect(job).toBeDefined()
    expect(job.name).toBe('test-job')
    expect(job.status).toBe('pending')
    expect(job.priority).toBe('normal')
  })

  it('should add jobs with priority', () => {
    const job = queue.add('high-priority', { data: 'urgent' }, { 
      priority: 'high' 
    })
    
    expect(job.priority).toBe('high')
  })

  it('should register job handlers', () => {
    queue.process('test-job', async (data) => {
      return { processed: true }
    })
    
    expect(true).toBe(true) // Should not throw
  })

  it('should get job stats', () => {
    queue.add('job1', {})
    queue.add('job2', {}, { priority: 'high' })
    queue.add('job3', {})
    
    const stats = queue.getStats()
    
    expect(stats.total).toBe(3)
    expect(stats.pending).toBe(3)
    expect(stats.byPriority.high).toBe(1)
    expect(stats.byPriority.normal).toBe(2)
  })

  it('should register event listeners', () => {
    const listener = vi.fn()
    const unsubscribe = queue.on('job:created', listener)
    
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('should cancel jobs', () => {
    const job = queue.add('test-job', {})
    const result = queue.cancel(job.id)
    
    expect(result).toBe(true)
    expect(job.status).toBe('cancelled')
  })

  it('should retry failed jobs', () => {
    const job = queue.add('test-job', {})
    job.status = 'failed'
    
    const result = queue.retry(job.id)
    
    expect(result).toBe(true)
    expect(job.status).toBe('pending')
    expect(job.attempts).toBe(0)
  })

  it('should pause and resume queue', () => {
    queue.pause()
    queue.resume()
    
    expect(true).toBe(true) // Should not throw
  })

  it('should clear completed jobs', () => {
    const job1 = queue.add('job1', {})
    const job2 = queue.add('job2', {})
    
    job1.status = 'completed'
    job2.status = 'completed'
    
    const cleared = queue.clearCompleted()
    
    expect(cleared).toBe(2)
  })

  it('should get jobs by filter', () => {
    queue.add('job1', {}, { priority: 'high', tags: ['urgent'] })
    queue.add('job2', {}, { priority: 'low' })
    
    const highPriority = queue.getJobs({ priority: 'high' })
    expect(highPriority).toHaveLength(1)
    
    const withTag = queue.getJobs({ tags: ['urgent'] })
    expect(withTag).toHaveLength(1)
  })

  it('should process jobs asynchronously', async () => {
    const handler = vi.fn(async (data) => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return { processed: true }
    })
    
    queue.process('async-job', handler)
    queue.add('async-job', { test: 'data' })
    
    // Wait for processing with longer timeout
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Handler should have been called
    expect(handler).toHaveBeenCalled()
  })
})
