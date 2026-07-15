import { beforeEach, describe, expect, it } from 'vitest'
import {
  collectSyncHighlights,
  diffNewIds,
  peekSyncHighlights,
  setSyncHighlights,
  clearSyncHighlights,
} from '../services/sync/syncHighlights'
import { createEmptyPortfolio } from '../domain/defaults'
import { createTodoItem, createTodoList } from '../domain/todos'
import { resolveBottomNavItems } from '../domain/bottomNav'

describe('syncHighlights', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearSyncHighlights()
  })

  it('diffs remote-only ids', () => {
    expect(diffNewIds([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toEqual([2])
  })

  it('collects todo highlights across portfolios', () => {
    const local = createEmptyPortfolio()
    const remote = createEmptyPortfolio()
    const list = createTodoList({ id: 10, name: 'Uncle John' })
    const oldItem = createTodoItem({ id: 1, listId: 10, title: 'Old' })
    const newItem = createTodoItem({ id: 2, listId: 10, title: 'New' })
    local.todoLists = [list]
    local.todoItems = [oldItem]
    remote.todoLists = [list]
    remote.todoItems = [oldItem, newItem]

    const map = collectSyncHighlights([{ local, remote }])
    expect(map.todoItems).toEqual([2])
  })

  it('persists highlights in sessionStorage', () => {
    setSyncHighlights({ todoItems: [42] })
    expect(peekSyncHighlights().todoItems).toEqual([42])
  })
})

describe('resolveBottomNavItems', () => {
  it('pins Settings last and caps at 5 tabs', () => {
    const items = resolveBottomNavItems(['/todos', '/jobs', '/markets', '/crypto', '/goals', '/spending'])
    expect(items).toHaveLength(5)
    expect(items[items.length - 1].to).toBe('/settings')
    expect(items.map((i) => i.to)).toContain('/todos')
  })

  it('falls back to Overview / Markets / Spending / Goals', () => {
    const items = resolveBottomNavItems([])
    expect(items.map((i) => i.to)).toEqual(['/', '/markets', '/spending', '/goals', '/settings'])
  })
})
