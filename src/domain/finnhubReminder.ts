/** High-priority Finnhub API key setup task for Today / To Do's. */

import type { PortfolioData } from './types'
import { createTodoItem, createTodoList, nextSortOrderForList } from './todos'

export const FINNHUB_TODO_TAG = 'finnhub'
export const FINNHUB_TODO_TITLE = 'Add Finnhub API key for live equity quotes'

function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function hasFinnhubKey(data: PortfolioData): boolean {
  const fromSettings = data.settings?.finnhubKey?.trim()
  if (fromSettings) return true
  try {
    const ls = localStorage.getItem('finnhub_key')?.trim()
    return Boolean(ls)
  } catch {
    return false
  }
}

export function findOpenFinnhubTodo(data: PortfolioData) {
  return (data.todoItems ?? []).find(
    (t) =>
      t.status !== 'done' &&
      t.status !== 'archived' &&
      (t.tags?.includes(FINNHUB_TODO_TAG) || /finnhub/i.test(t.title)),
  )
}

/**
 * Ensure a high-priority, due-today To Do exists when no Finnhub key is configured.
 * Returns null when no change is needed.
 */
export function ensureFinnhubSetupTodo(
  data: PortfolioData,
  now = new Date(),
): PortfolioData | null {
  if (hasFinnhubKey(data)) return null
  if (findOpenFinnhubTodo(data)) return null

  let lists = [...(data.todoLists ?? [])]
  let list = lists.find((l) => /setup|markets|finance/i.test(l.name)) ?? lists[0]
  if (!list) {
    list = createTodoList({
      name: 'Setup',
      description: 'App setup and provider keys',
      icon: 'list',
      color: '#F7931A',
    })
    lists = [...lists, list]
  }

  const due = todayIsoDate(now)
  const todo = createTodoItem({
    listId: list.id,
    title: FINNHUB_TODO_TITLE,
    description:
      'Create a free key at finnhub.io/register, then paste it in Settings → Prices (Live market data). Equities prefer Finnhub when the key works; Yahoo remains the fallback.',
    priority: 'high',
    status: 'todo',
    dueDate: due,
    reminderDate: due,
    tags: [FINNHUB_TODO_TAG, 'setup', 'markets'],
    isFinanceRelated: true,
    sortOrder: nextSortOrderForList(data.todoItems ?? [], list.id),
  })

  return {
    ...data,
    todoLists: lists,
    todoItems: [...(data.todoItems ?? []), todo],
  }
}

/** Mark the Finnhub setup task done once a key is saved. */
export function completeFinnhubSetupTodo(data: PortfolioData, now = new Date()): PortfolioData {
  const open = findOpenFinnhubTodo(data)
  if (!open) return data
  const iso = now.toISOString()
  return {
    ...data,
    todoItems: (data.todoItems ?? []).map((t) =>
      t.id === open.id
        ? { ...t, status: 'done' as const, completedAt: iso, updatedAt: iso }
        : t,
    ),
  }
}
