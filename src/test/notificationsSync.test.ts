import { describe, expect, it, beforeEach } from 'vitest'
import {
  buildNewsUnreadNotifications,
  buildReminderCenterNotifications,
} from '../components/SmartNotifications'
import type { PortfolioData } from '../domain/types'
import { notificationManager } from '../utils/notifications'

describe('notificationManager.syncCategory', () => {
  beforeEach(() => {
    notificationManager.clear()
    localStorage.removeItem('mydsp_notification_settings')
    notificationManager.updateSettings({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      priorityThreshold: 'critical',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      categories: {},
    })
  })

  it('inserts alerts and preserves read state on re-sync', () => {
    notificationManager.syncCategory('portfolio-alerts', [
      {
        id: 'budget-food',
        type: 'error',
        priority: 'critical',
        title: 'Budget overrun: food',
        message: 'Over limit',
        actionUrl: '/budgets',
      },
    ])
    expect(notificationManager.getAll()).toHaveLength(1)
    notificationManager.markAsRead('budget-food')

    notificationManager.syncCategory('portfolio-alerts', [
      {
        id: 'budget-food',
        type: 'error',
        priority: 'critical',
        title: 'Budget overrun: food',
        message: 'Still over',
        actionUrl: '/budgets',
      },
      {
        id: 'card-util-1',
        type: 'warning',
        priority: 'high',
        title: 'High utilisation',
        message: '90%',
        actionUrl: '/liabilities',
      },
    ])

    const all = notificationManager.getAll()
    expect(all).toHaveLength(2)
    expect(all.find((n) => n.id === 'budget-food')?.read).toBe(true)
    expect(all.find((n) => n.id === 'budget-food')?.message).toBe('Still over')
    expect(all.find((n) => n.id === 'card-util-1')?.read).toBe(false)
  })

  it('removes stale alerts when category re-syncs without them', () => {
    notificationManager.syncCategory('portfolio-alerts', [
      {
        id: 'a',
        type: 'info',
        priority: 'low',
        title: 'A',
        message: 'gone soon',
      },
    ])
    notificationManager.syncCategory('portfolio-alerts', [])
    expect(notificationManager.getAll()).toHaveLength(0)
  })

  it('clears muted categories from the bell', () => {
    notificationManager.syncCategory('price-alerts', [
      {
        id: 'price-btc',
        type: 'warning',
        priority: 'high',
        title: 'BTC up',
        message: '+4%',
      },
    ])
    expect(notificationManager.getAll()).toHaveLength(1)
    notificationManager.updateSettings({ categories: { 'price-alerts': false } })
    notificationManager.syncCategory('price-alerts', [
      {
        id: 'price-btc',
        type: 'warning',
        priority: 'high',
        title: 'BTC up',
        message: '+4%',
      },
    ])
    expect(notificationManager.getAll()).toHaveLength(0)
  })
})

describe('Notification Center action URLs', () => {
  it('deep-links todo and Jobs reminders to their records', () => {
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const data = {
      spending: [],
      budgetGoals: {},
      goals: [],
      liabilities: [],
      todoItems: [
        {
          id: 7,
          listId: 1,
          title: 'Send documents',
          status: 'todo',
          priority: 'high',
          dueDate: yesterday,
        },
      ],
      jobApplications: [
        {
          id: 42,
          companyName: 'Acme',
          jobTitle: 'Engineer',
          status: 'interviewing',
          priority: 'high',
          interviews: [
            {
              id: 9,
              type: 'technical',
              scheduledDate: tomorrow,
              interviewers: [],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
    } as unknown as PortfolioData

    const notifications = buildReminderCenterNotifications(data)
    expect(notifications.find((n) => n.metadata?.reminderType === 'todo')?.actionUrl).toBe(
      '/todos?focus=7',
    )
    expect(notifications.find((n) => n.metadata?.reminderType === 'job')?.actionUrl).toBe(
      '/jobs/42',
    )
    expect(notifications.every((n) => Boolean(n.actionUrl))).toBe(true)
  })

  it('builds one actionable aggregate for unread News', () => {
    expect(buildNewsUnreadNotifications(0)).toEqual([])
    expect(buildNewsUnreadNotifications(3)).toEqual([
      expect.objectContaining({
        id: 'news-unread-3',
        message: '3 new headlines ready to review',
        actionUrl: '/news',
        actionLabel: 'Open News',
      }),
    ])
  })
})
