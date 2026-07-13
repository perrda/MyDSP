// Unit tests for Logger

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Logger, logger, createLogger } from '../utils/logger'

describe('Logger', () => {
  let testLogger: Logger

  beforeEach(() => {
    testLogger = createLogger({
      level: 'debug',
      console: false,
      persist: false,
    })
  })

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      testLogger.debug('Test debug message', { foo: 'bar' })
      const logs = testLogger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe('debug')
      expect(logs[0].message).toBe('Test debug message')
      expect(logs[0].data).toEqual({ foo: 'bar' })
    })

    it('should log info messages', () => {
      testLogger.info('Test info message')
      const logs = testLogger.getLogs()
      expect(logs[0].level).toBe('info')
    })

    it('should log warnings', () => {
      testLogger.warn('Test warning')
      const logs = testLogger.getLogs()
      expect(logs[0].level).toBe('warn')
    })

    it('should log errors', () => {
      const error = new Error('Test error')
      testLogger.error('Test error message', error)
      const logs = testLogger.getLogs()
      expect(logs[0].level).toBe('error')
      expect(logs[0].error).toBe(error)
    })

    it('should respect log level filtering', () => {
      const warnLogger = createLogger({ level: 'warn', console: false, persist: false })
      warnLogger.debug('Should not appear')
      warnLogger.info('Should not appear')
      warnLogger.warn('Should appear')
      warnLogger.error('Should appear')

      const logs = warnLogger.getLogs()
      expect(logs).toHaveLength(2)
      expect(logs[0].level).toBe('warn')
      expect(logs[1].level).toBe('error')
    })

    it('should filter by category', () => {
      testLogger.info('API message', undefined, 'api')
      testLogger.info('UI message', undefined, 'ui')

      const apiLogs = testLogger.getLogs({ category: 'api' })
      expect(apiLogs).toHaveLength(1)
      expect(apiLogs[0].category).toBe('api')
    })
  })

  describe('Performance Tracking', () => {
    it('should track execution time', async () => {
      const stop = testLogger.startTimer('test-operation')
      await new Promise(resolve => setTimeout(resolve, 10))
      const duration = stop()

      expect(duration).toBeGreaterThan(9)
      const metrics = testLogger.getMetrics({ name: 'test-operation' })
      expect(metrics).toHaveLength(1)
      expect(metrics[0].duration).toBeGreaterThan(9)
    })

    it('should measure async operations', async () => {
      const result = await testLogger.measure('async-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'result'
      })

      expect(result).toBe('result')
      const metrics = testLogger.getMetrics({ name: 'async-op' })
      expect(metrics).toHaveLength(1)
      expect(metrics[0].duration).toBeGreaterThan(9)
    })

    it('should log custom metrics', () => {
      testLogger.metric('bundle-size', 1235.55, { unit: 'kB' })

      const metrics = testLogger.getMetrics({ name: 'bundle-size' })
      expect(metrics).toHaveLength(1)
      expect(metrics[0].duration).toBe(1235.55)
      expect(metrics[0].metadata?.unit).toBe('kB')
    })
  })

  describe('Analytics Events', () => {
    it('should track events', () => {
      testLogger.track('button_clicked', { button: 'submit' })

      const events = testLogger.getEvents({ name: 'button_clicked' })
      expect(events).toHaveLength(1)
      expect(events[0].name).toBe('button_clicked')
      expect(events[0].properties).toEqual({ button: 'submit' })
    })

    it('should track page views', () => {
      testLogger.pageView('/dashboard', 'Dashboard')

      const events = testLogger.getEvents({ name: 'page_view' })
      expect(events).toHaveLength(1)
      expect(events[0].properties).toEqual({ path: '/dashboard', title: 'Dashboard' })
    })

    it('should track user actions', () => {
      testLogger.action('click', 'submit-button', { form: 'login' })

      const events = testLogger.getEvents({ name: 'user_action' })
      expect(events).toHaveLength(1)
      expect(events[0].properties).toEqual({ action: 'click', target: 'submit-button', form: 'login' })
    })
  })

  describe('Query and Retrieval', () => {
    beforeEach(() => {
      testLogger.debug('Debug 1')
      testLogger.info('Info 1')
      testLogger.warn('Warn 1')
      testLogger.error('Error 1')
      testLogger.info('Info 2')
    })

    it('should get all logs', () => {
      const logs = testLogger.getLogs()
      expect(logs).toHaveLength(5)
    })

    it('should filter logs by level', () => {
      const errors = testLogger.getLogs({ level: 'error' })
      expect(errors).toHaveLength(1)
      expect(errors[0].level).toBe('error')
    })

    it('should filter logs by time', () => {
      const now = Date.now()
      const recent = testLogger.getLogs({ since: now - 1000 })
      expect(recent.length).toBeGreaterThan(0)
    })

    it('should limit log results', () => {
      const limited = testLogger.getLogs({ limit: 2 })
      expect(limited).toHaveLength(2)
    })
  })

  describe('Summary and Reporting', () => {
    beforeEach(() => {
      testLogger.info('Log 1')
      testLogger.error('Log 2')
      testLogger.metric('op1', 100)
      testLogger.metric('op2', 200)
      testLogger.track('event1')
      testLogger.track('event2')
    })

    it('should generate summary', () => {
      const summary = testLogger.getSummary()

      expect(summary.logs.total).toBe(6) // 2 logs + 2 from metrics (which also log) + 2 from events (which also log)
      expect(summary.metrics.total).toBe(2)
      expect(summary.metrics.avgDuration).toBe(150)
      expect(summary.events.total).toBe(2)
    })

    it('should identify slowest metric', () => {
      const summary = testLogger.getSummary()
      expect(summary.metrics.slowest?.duration).toBe(200)
    })
  })

  describe('Utility Functions', () => {
    it('should set user ID', () => {
      testLogger.setUserId('user-123')
      testLogger.info('Test')

      const logs = testLogger.getLogs()
      expect(logs[0].userId).toBe('user-123')
    })

    it('should clear logs', () => {
      testLogger.info('Test')
      expect(testLogger.getLogs()).toHaveLength(1)

      testLogger.clear()
      expect(testLogger.getLogs()).toHaveLength(0)
    })

    it('should export logs', () => {
      testLogger.info('Test')
      const exported = testLogger.export()
      const parsed = JSON.parse(exported)

      expect(parsed.logs).toHaveLength(1)
      expect(parsed.summary).toBeDefined()
    })
  })

  describe('Global Logger', () => {
    it('should have global logger instance', () => {
      expect(logger).toBeDefined()
      expect(logger instanceof Logger).toBe(true)
    })
  })
})
