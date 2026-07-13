import type {
  TodoItem,
  TodoList,
  TodoPriority,
  TodoSortBy,
  TodoFilterBy,
  TodoStats,
  TodoStatus,
} from './todo-types'

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
    tags: partial.tags ?? [],
    isFinanceRelated: partial.isFinanceRelated ?? false,
    estimatedMinutes: partial.estimatedMinutes,
    actualMinutes: partial.actualMinutes,
    completedAt: partial.completedAt,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    sortOrder: partial.sortOrder,
  }
}

export function createTodoList(partial: Partial<TodoList> & Pick<TodoList, 'name'>): TodoList {
  const now = new Date().toISOString()
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: partial.name,
    description: partial.description,
    color: partial.color ?? '#F7931A',
    icon: partial.icon ?? '📋',
    sortOrder: partial.sortOrder,
    createdAt: now,
    updatedAt: now,
  }
}

export function isOverdue(item: TodoItem): boolean {
  if (!item.dueDate || item.status === 'done' || item.status === 'archived') return false
  const due = new Date(item.dueDate)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return due < now
}

export function isDueToday(item: TodoItem): boolean {
  if (!item.dueDate) return false
  const due = new Date(item.dueDate)
  const today = new Date()
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  )
}

export function isDueThisWeek(item: TodoItem): boolean {
  if (!item.dueDate) return false
  const due = new Date(item.dueDate)
  const today = new Date()
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)
  return due >= today && due <= weekFromNow
}

export function sortTodoItems(items: TodoItem[], sortBy: TodoSortBy): TodoItem[] {
  const priorityOrder: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 }

  return [...items].sort((a, b) => {
    switch (sortBy) {
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
    default:
      return items
  }
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
