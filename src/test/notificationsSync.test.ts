import { describe, expect, it, beforeEach } from 'vitest'
import { notificationManager } from '../utils/notifications'

describe('notificationManager.syncCategory', () => {
  beforeEach(() => {
    notificationManager.clear()
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
})
