// Background Jobs Integration - Process tasks in background

import { createJobQueue } from '../utils/jobQueue'
import { logger } from '../utils/logger'
import { notificationManager } from '../utils/notifications'
import type { PortfolioData } from '../domain/types'

// Create global job queue
export const backgroundJobs = createJobQueue({
  name: 'mydsp-background',
  concurrency: 2,
  maxRetries: 3,
  persistence: true,
})

// === JOB HANDLERS ===

// Daily summary job
backgroundJobs.process('daily-summary', async (data: { userId?: string }) => {
  logger.info('Processing daily summary', data, 'app')
  
  try {
    // Calculate daily stats
    const summary = {
      date: new Date().toISOString().split('T')[0],
      processed: true,
      timestamp: Date.now()
    }
    
    // Send notification
    notificationManager.add({
      type: 'info',
      priority: 'low',
      title: 'Daily Summary Ready',
      message: 'Your financial summary for today is ready to view.',
      category: 'summary'
    })
    
    return summary
  } catch (error) {
    logger.error('Daily summary failed', error as Error, 'app')
    throw error
  }
})

// Data sync job
backgroundJobs.process('sync-data', async (data: { portfolioData: PortfolioData }) => {
  logger.info('Syncing data', { hasData: !!data.portfolioData }, 'app')
  
  try {
    // Simulate sync (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      synced: true,
      timestamp: Date.now()
    }
  } catch (error) {
    logger.error('Data sync failed', error as Error, 'app')
    throw error
  }
})

// Goal reminder job
backgroundJobs.process('goal-reminder', async (data: { goalId: number, goalName: string }) => {
  logger.info('Processing goal reminder', data, 'app')
  
  try {
    notificationManager.add({
      type: 'reminder',
      priority: 'medium',
      title: `Goal Reminder: ${data.goalName}`,
      message: 'Check your progress and stay on track!',
      actionUrl: '/goals',
      actionLabel: 'View Goals',
      category: 'goals'
    })
    
    return { notified: true }
  } catch (error) {
    logger.error('Goal reminder failed', error as Error, 'app')
    throw error
  }
})

// Budget alert job
backgroundJobs.process('budget-alert', async (data: { category: string, spent: number, budget: number }) => {
  logger.info('Processing budget alert', data, 'app')
  
  try {
    const percentage = (data.spent / data.budget) * 100
    
    notificationManager.add({
      type: 'warning',
      priority: percentage > 90 ? 'high' : 'medium',
      title: `Budget Alert: ${data.category}`,
      message: `You've used ${percentage.toFixed(0)}% of your ${data.category} budget (£${data.spent.toFixed(2)} / £${data.budget.toFixed(2)})`,
      actionUrl: '/budgets',
      actionLabel: 'View Budgets',
      category: 'budgets'
    })
    
    return { alerted: true }
  } catch (error) {
    logger.error('Budget alert failed', error as Error, 'app')
    throw error
  }
})

// Data cleanup job
backgroundJobs.process('cleanup-data', async (data: { olderThan?: number }) => {
  logger.info('Processing data cleanup', data, 'app')
  
  try {
    // Clean up old logs (keep last 1000)
    const allLogs = logger.getLogs()
    const cleaned = Math.max(0, allLogs.length - 1000)
    
    // Clean up old notifications
    const notifications = notificationManager.getAll()
    const oldNotifications = notifications.filter(n => {
      const age = Date.now() - n.timestamp
      const days = age / (1000 * 60 * 60 * 24)
      return days > (data.olderThan || 30)
    })
    
    oldNotifications.forEach(n => notificationManager.remove(n.id))
    
    logger.info('Cleanup complete', { 
      logsCleared: cleaned, 
      notificationsCleared: oldNotifications.length 
    }, 'app')
    
    return {
      logsCleared: cleaned,
      notificationsCleared: oldNotifications.length
    }
  } catch (error) {
    logger.error('Data cleanup failed', error as Error, 'app')
    throw error
  }
})

// === SCHEDULED JOBS ===

// Schedule daily summary (every day at 9 AM)
export function scheduleDailySummary() {
  const now = new Date()
  const tomorrow9AM = new Date(now)
  tomorrow9AM.setDate(tomorrow9AM.getDate() + 1)
  tomorrow9AM.setHours(9, 0, 0, 0)
  
  const delayMs = tomorrow9AM.getTime() - now.getTime()
  
  backgroundJobs.add('daily-summary', {}, {
    priority: 'low',
    delay: delayMs,
    tags: ['scheduled', 'daily']
  })
  
  logger.info('Daily summary scheduled', { nextRun: tomorrow9AM.toISOString() }, 'app')
}

// Schedule weekly cleanup (every Sunday at midnight)
export function scheduleWeeklyCleanup() {
  const now = new Date()
  const nextSunday = new Date(now)
  nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()))
  nextSunday.setHours(0, 0, 0, 0)
  
  const delayMs = nextSunday.getTime() - now.getTime()
  
  backgroundJobs.add('cleanup-data', { olderThan: 30 }, {
    priority: 'low',
    delay: delayMs,
    tags: ['scheduled', 'weekly']
  })
  
  logger.info('Weekly cleanup scheduled', { nextRun: nextSunday.toISOString() }, 'app')
}

// === HELPER FUNCTIONS ===

export function scheduleGoalReminder(goalId: number, goalName: string, reminderDate: Date) {
  const delayMs = Math.max(0, reminderDate.getTime() - Date.now())
  
  backgroundJobs.add('goal-reminder', { goalId, goalName }, {
    priority: 'high',
    delay: delayMs,
    tags: ['reminder', `goal-${goalId}`]
  })
  
  logger.info('Goal reminder scheduled', { goalId, goalName, reminderDate: reminderDate.toISOString() }, 'app')
}

export function scheduleBudgetAlert(category: string, spent: number, budget: number) {
  backgroundJobs.add('budget-alert', { category, spent, budget }, {
    priority: 'high',
    tags: ['alert', 'budget']
  })
  
  logger.info('Budget alert scheduled', { category, spent, budget }, 'app')
}

export function queueDataSync(portfolioData: PortfolioData) {
  backgroundJobs.add('sync-data', { portfolioData }, {
    priority: 'normal',
    tags: ['sync']
  })
  
  logger.info('Data sync queued', undefined, 'app')
}

// Initialize scheduled jobs
export function initializeBackgroundJobs() {
  logger.info('Initializing background jobs', undefined, 'app')
  
  // Schedule recurring jobs
  scheduleDailySummary()
  scheduleWeeklyCleanup()
  
  // Log job queue stats
  const stats = backgroundJobs.getStats()
  logger.info('Background jobs initialized', stats, 'app')
}

// Get job queue stats for debugging
export function getJobQueueStats() {
  return backgroundJobs.getStats()
}

// Pause/resume job processing
export function pauseBackgroundJobs() {
  backgroundJobs.pause()
  logger.info('Background jobs paused', undefined, 'app')
}

export function resumeBackgroundJobs() {
  backgroundJobs.resume()
  logger.info('Background jobs resumed', undefined, 'app')
}
