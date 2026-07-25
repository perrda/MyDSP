export type TodoPriority = 'high' | 'medium' | 'low'
export type TodoStatus = 'todo' | 'in-progress' | 'done' | 'archived'
export type TodoRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface TodoSubtask {
  id: number
  title: string
  done: boolean
}

export interface TodoItem {
  id: number
  listId: number
  title: string
  description?: string
  priority: TodoPriority
  status: TodoStatus
  dueDate?: string
  dueTime?: string
  reminderDate?: string
  reminderTime?: string
  recurrence?: TodoRecurrence
  tags: string[]
  isFinanceRelated: boolean
  estimatedMinutes?: number
  actualMinutes?: number
  completedAt?: string
  createdAt: string
  updatedAt: string
  sortOrder?: number
  /** Optional link to a job application (Jobs ↔ Todos) */
  linkedJobId?: number
  /** Optional checklist for breaking larger To Do's down locally. */
  subtasks?: TodoSubtask[]
}

export interface TodoList {
  id: number
  name: string
  description?: string
  color?: string
  icon?: string
  /** Local-only shared-list hint; actual multi-user sync still uses workspace cloud sync. */
  shared?: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export interface TodoStats {
  total: number
  todo: number
  inProgress: number
  done: number
  archived: number
  highPriority: number
  overdue: number
}

export type TodoSortBy = 
  | 'order-asc'
  | 'order-desc'
  | 'priority-desc'
  | 'priority-asc'
  | 'due-date-asc'
  | 'due-date-desc'
  | 'created-asc'
  | 'created-desc'
  | 'title-asc'
  | 'title-desc'

export type TodoFilterBy = 
  | 'all'
  | 'high-priority'
  | 'medium-priority'
  | 'low-priority'
  | 'overdue'
  | 'today'
  | 'this-week'
  | 'finance-related'
  | 'no-due-date'
  | 'status-todo'
  | 'status-in-progress'
  | 'archived'

