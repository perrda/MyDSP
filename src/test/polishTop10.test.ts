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
  it('pins Overview first, Settings last, and caps at 5 tabs', () => {
    const items = resolveBottomNavItems(['/todos', '/jobs', '/markets'])
    expect(items).toHaveLength(5)
    expect(items[0].to).toBe('/')
    expect(items[items.length - 1].to).toBe('/settings')
    expect(items.map((i) => i.to)).toEqual(['/', '/todos', '/jobs', '/markets', '/settings'])
  })

  it('falls back to Overview / Markets / To Do / Equities / Settings', () => {
    const items = resolveBottomNavItems([])
    expect(items.map((i) => i.to)).toEqual(['/', '/markets', '/todos', '/equities', '/settings'])
  })
})
