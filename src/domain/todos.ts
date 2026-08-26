import type {
  TodoItem,
  TodoList,
  TodoPriority,
  TodoRecurrence,
  TodoSortBy,
  TodoFilterBy,
  TodoStats,
  TodoStatus,
} from './todo-types'
import { sortBySortOrder } from '../utils/reorder'

export function createTodoItem(partial: Partial<TodoItem> & Pick<TodoItem, 'title' | 'listId'>): TodoItem {
  const now = new Date().toISOString()
  return {
    id: partial.id ?? Date.now() + Math.floor(Math.random() * 1000),
    title: partial.title,
    listId: partial.listId,
    description: partial.description,
    priority: partial.priority ?? 'medium',
    status: partial.status ?? 'todo',
    dueDate: partial.dueDate,
    dueTime: partial.dueTime,
    reminderDate: partial.reminderDate,
    reminderTime: partial.reminderTime,
    recurrence: partial.recurrence ?? 'none',
    tags: partial.tags ?? [],
    isFinanceRelated: partial.isFinanceRelated ?? false,
    estimatedMinutes: partial.estimatedMinutes,
    actualMinutes: partial.actualMinutes,
    completedAt: partial.completedAt,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    sortOrder: partial.sortOrder,
    linkedJobId: partial.linkedJobId,
    subtasks: partial.subtasks,
  }
}

export function createTodoList(partial: Partial<TodoList> & Pick<TodoList, 'name'>): TodoList {
  const now = new Date().toISOString()
  return {
    id: partial.id ?? Date.now() + Math.floor(Math.random() * 1000),
    name: partial.name,
    description: partial.description,
    color: partial.color ?? '#F7931A',
    icon: partial.icon ?? 'list',
    shared: partial.shared,
    sortOrder: partial.sortOrder,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  }
}

/** Local-calendar due date — `YYYY-MM-DD` must not parse as UTC midnight. */
function dueDateLocal(item: TodoItem): Date | null {
  if (!item.dueDate) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
    const [y, m, d] = item.dueDate.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const parsed = new Date(item.dueDate)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export function isOverdue(item: TodoItem, now: Date = new Date()): boolean {
  if (!item.dueDate || item.status === 'done' || item.status === 'archived') return false
  const due = dueDateLocal(item)
  if (!due) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  due.setHours(0, 0, 0, 0)
  return due < today
}

export function isDueToday(item: TodoItem, now: Date = new Date()): boolean {
  if (!item.dueDate) return false
  const due = dueDateLocal(item)
  if (!due) return false
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  )
}

export function isDueThisWeek(item: TodoItem, now: Date = new Date()): boolean {
  if (!item.dueDate) return false
  const due = dueDateLocal(item)
  if (!due) return false
  due.setHours(0, 0, 0, 0)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)
  return due >= today && due <= weekFromNow
}

export function sortTodoItems(items: TodoItem[], sortBy: TodoSortBy): TodoItem[] {
  const priorityOrder: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 }
  const orderKey = (item: TodoItem) => item.sortOrder ?? 1_000_000 + item.id

  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'order-asc':
        return orderKey(a) - orderKey(b)
      case 'order-desc':
        return orderKey(b) - orderKey(a)
      case 'priority-desc':
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      case 'priority-asc':
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      case 'due-date-asc': {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      case 'due-date-desc': {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
      }
      case 'created-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'created-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'title-asc':
        return a.title.localeCompare(b.title)
      case 'title-desc':
        return b.title.localeCompare(a.title)
      default:
        return 0
    }
  })
}

export function filterTodoItems(items: TodoItem[], filterBy: TodoFilterBy): TodoItem[] {
  switch (filterBy) {
    case 'all':
      return items.filter((i) => i.status !== 'archived')
    case 'high-priority':
      return items.filter((i) => i.priority === 'high' && i.status !== 'archived')
    case 'medium-priority':
      return items.filter((i) => i.priority === 'medium' && i.status !== 'archived')
    case 'low-priority':
      return items.filter((i) => i.priority === 'low' && i.status !== 'archived')
    case 'overdue':
      return items.filter((i) => isOverdue(i))
    case 'today':
      return items.filter((i) => isDueToday(i) && i.status !== 'archived')
    case 'this-week':
      return items.filter((i) => isDueThisWeek(i) && i.status !== 'archived')
    case 'finance-related':
      return items.filter((i) => i.isFinanceRelated && i.status !== 'archived')
    case 'no-due-date':
      return items.filter((i) => !i.dueDate && i.status !== 'archived')
    case 'status-todo':
      return items.filter((i) => i.status === 'todo')
    case 'status-in-progress':
      return items.filter((i) => i.status === 'in-progress')
    case 'archived':
      return items.filter((i) => i.status === 'archived')
    default:
      return items
  }
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(value: string | undefined, fallback: Date): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate())
}

export function nextTodoDueDate(
  dueDate: string | undefined,
  recurrence: Exclude<TodoRecurrence, 'none'>,
  now: Date = new Date(),
): string {
  const next = parseYmd(dueDate, now)
  if (recurrence === 'daily') next.setDate(next.getDate() + 1)
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7)
  else next.setMonth(next.getMonth() + 1)
  return toLocalYmd(next)
}

/**
 * Complete one todo. Recurring todos keep a completed occurrence and spawn the
 * next active occurrence with the same metadata and advanced due/reminder dates.
 */
export function completeTodoWithRecurrence(items: TodoItem[], itemId: number, nowIso = new Date().toISOString()): TodoItem[] {
  const item = items.find((i) => i.id === itemId)
  if (!item) return items
  const now = new Date(nowIso)
  const isCompleting = item.status !== 'done'
  if (!isCompleting) {
    return items.map((i) =>
      i.id === itemId ? { ...i, status: 'todo', completedAt: undefined, updatedAt: nowIso } : i,
    )
  }

  const completed = items.map((i) =>
    i.id === itemId ? { ...i, status: 'done' as const, completedAt: nowIso, updatedAt: nowIso } : i,
  )
  if (!item.recurrence || item.recurrence === 'none') return completed

  const dueDate = nextTodoDueDate(item.dueDate, item.recurrence, now)
  const reminderDate = item.reminderDate
    ? nextTodoDueDate(item.reminderDate, item.recurrence, now)
    : undefined
  const nextItem = createTodoItem({
    ...item,
    id: Date.now() + Math.floor(Math.random() * 1000),
    status: 'todo',
    completedAt: undefined,
    dueDate,
    reminderDate,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
  return [...completed, nextItem]
}

/** Next contiguous sortOrder for a new item at the end of a list. */
export function nextSortOrderForList(items: TodoItem[], listId: number): number {
  const siblings = sortBySortOrder(
    items.filter((i) => i.listId === listId && i.status !== 'archived'),
  )
  if (siblings.length === 0) return 0
  const last = siblings[siblings.length - 1]
  return (last.sortOrder ?? siblings.length - 1) + 1
}

export function calculateTodoStats(items: TodoItem[]): TodoStats {
  const total = items.length
  const todo = items.filter((i) => i.status === 'todo').length
  const inProgress = items.filter((i) => i.status === 'in-progress').length
  const done = items.filter((i) => i.status === 'done').length
  const archived = items.filter((i) => i.status === 'archived').length
  const highPriority = items.filter((i) => i.priority === 'high' && i.status !== 'archived').length
  const overdue = items.filter((i) => isOverdue(i)).length

  return { total, todo, inProgress, done, archived, highPriority, overdue }
}

export function parseCsvToTodoItems(csv: string, listId: number): TodoItem[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const items: TodoItem[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim())
    if (values.length === 0 || !values[0]) continue

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })

    const priority = (row.priority as TodoPriority) || 'medium'
    const status = (row.status as TodoStatus) || 'todo'

    items.push(
      createTodoItem({
        listId,
        title: row.title || row.task || row.name || 'Untitled',
        description: row.description || row.notes || row.desc,
        priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
        status: ['todo', 'in-progress', 'done', 'archived'].includes(status) ? status : 'todo',
        dueDate: row.duedate || row['due date'] || row.due,
        tags: row.tags ? row.tags.split(';').map((t) => t.trim()) : [],
        isFinanceRelated: row.finance === 'true' || row.finance === '1' || row.financial === 'true',
      }),
    )
  }

  return items
}

export function exportTodosToCsv(items: TodoItem[]): string {
  const headers = [
    'Title',
    'Description',
    'Priority',
    'Status',
    'Due Date',
    'Tags',
    'Finance Related',
    'Created At',
    'Completed At',
  ]

  const rows = items.map((item) => [
    item.title,
    item.description || '',
    item.priority,
    item.status,
    item.dueDate || '',
    item.tags.join(';'),
    item.isFinanceRelated ? 'Yes' : 'No',
    item.createdAt,
    item.completedAt || '',
  ])

  return [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
}
