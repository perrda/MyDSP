import { describe, expect, it, beforeEach } from 'vitest'
import { notificationManager } from '../utils/notifications'

describe('notificationManager.syncCategory', () => {
  beforeEach(() => {
    notificationManager.clear()
    localStorage.removeItem('mydsp_notification_settings')
    notificationManager.updateSettings({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      priorityThreshold: 'high',
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

  it('persists notification settings', () => {
    notificationManager.updateSettings({
      desktopEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '06:30',
      priorityThreshold: 'critical',
    })
    const raw = localStorage.getItem('mydsp_notification_settings')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { quietHoursStart: string; priorityThreshold: string }
    expect(parsed.quietHoursStart).toBe('23:00')
    expect(parsed.priorityThreshold).toBe('critical')
    expect(notificationManager.getSettings().desktopEnabled).toBe(true)
  })
})
