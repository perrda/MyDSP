// Advanced filtering presets and query builders

// === FILTER TYPES ===

export type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'matches_regex'

export type FilterLogic = 'and' | 'or'

export interface FilterCondition {
  field: string
  operator: FilterOperator
  value?: any
  logic?: FilterLogic
}

export interface FilterPreset {
  id: string
  name: string
  description?: string
  icon?: string
  conditions: FilterCondition[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// === SPENDING FILTER PRESETS ===

export const SPENDING_PRESETS: FilterPreset[] = [
  {
    id: 'high-value',
    name: 'High Value',
    description: 'Transactions over £100',
    icon: '💷',
    conditions: [
      { field: 'amount', operator: 'greater_than_or_equal', value: 100 }
    ],
    sortBy: 'amount',
    sortOrder: 'desc'
  },
  {
    id: 'last-7-days',
    name: 'Last 7 Days',
    description: 'Recent spending',
    icon: '📅',
    conditions: [
      { field: 'date', operator: 'greater_than_or_equal', value: () => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
      }}
    ],
    sortBy: 'date',
    sortOrder: 'desc'
  },
  {
    id: 'this-month',
    name: 'This Month',
    description: 'Current month spending',
    icon: '📊',
    conditions: [
      { field: 'date', operator: 'greater_than_or_equal', value: () => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      }}
    ],
    sortBy: 'date',
    sortOrder: 'desc'
  },
  {
    id: 'food-drinks',
    name: 'Food & Drinks',
    description: 'Food and beverage expenses',
    icon: '🍽️',
    conditions: [
      { field: 'category', operator: 'in', value: ['food', 'drinks', 'groceries', 'restaurants'] }
    ],
    sortBy: 'date',
    sortOrder: 'desc'
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Recurring subscription payments',
    icon: '🔄',
    conditions: [
      { field: 'category', operator: 'equals', value: 'subscriptions' }
    ],
    sortBy: 'amount',
    sortOrder: 'desc'
  },
  {
    id: 'cash-payments',
    name: 'Cash Payments',
    description: 'Cash-only transactions',
    icon: '💵',
    conditions: [
      { field: 'method', operator: 'equals', value: 'cash' }
    ],
    sortBy: 'date',
    sortOrder: 'desc'
  },
  {
    id: 'large-purchases',
    name: 'Large Purchases',
    description: 'Major expenses over £500',
    icon: '🛍️',
    conditions: [
      { field: 'amount', operator: 'greater_than_or_equal', value: 500 }
    ],
    sortBy: 'amount',
    sortOrder: 'desc'
  }
]

// === GOAL FILTER PRESETS ===

export const GOAL_PRESETS: FilterPreset[] = [
  {
    id: 'active-goals',
    name: 'Active Goals',
    description: 'Goals not yet reached deadline',
    icon: '🎯',
    conditions: [
      { field: 'deadline', operator: 'greater_than_or_equal', value: () => new Date().toISOString() }
    ],
    sortBy: 'deadline',
    sortOrder: 'asc'
  },
  {
    id: 'urgent-goals',
    name: 'Urgent Goals',
    description: 'Deadlines within 30 days',
    icon: '⚡',
    conditions: [
      { field: 'deadline', operator: 'between', value: () => {
        const now = new Date()
        const future = new Date()
        future.setDate(future.getDate() + 30)
        return [now.toISOString(), future.toISOString()]
      }}
    ],
    sortBy: 'deadline',
    sortOrder: 'asc'
  },
  {
    id: 'debt-goals',
    name: 'Debt Goals',
    description: 'Debt reduction goals',
    icon: '💳',
    conditions: [
      { field: 'type', operator: 'equals', value: 'debt' }
    ],
    sortBy: 'target',
    sortOrder: 'desc'
  },
  {
    id: 'networth-goals',
    name: 'Net Worth Goals',
    description: 'Net worth milestones',
    icon: '📈',
    conditions: [
      { field: 'type', operator: 'equals', value: 'networth' }
    ],
    sortBy: 'target',
    sortOrder: 'desc'
  }
]

// === TODO FILTER PRESETS ===

export const TODO_PRESETS: FilterPreset[] = [
  {
    id: 'high-priority',
    name: 'High Priority',
    description: 'Urgent tasks',
    icon: '🔥',
    conditions: [
      { field: 'priority', operator: 'equals', value: 'high' },
      { field: 'status', operator: 'not_equals', value: 'done' }
    ],
    sortBy: 'dueDate',
    sortOrder: 'asc'
  },
  {
    id: 'overdue',
    name: 'Overdue',
    description: 'Past due date',
    icon: '⏰',
    conditions: [
      { field: 'dueDate', operator: 'less_than', value: () => new Date().toISOString() },
      { field: 'status', operator: 'not_equals', value: 'done' }
    ],
    sortBy: 'dueDate',
    sortOrder: 'asc'
  },
  {
    id: 'today',
    name: 'Due Today',
    description: 'Tasks due today',
    icon: '📅',
    conditions: [
      { field: 'dueDate', operator: 'equals', value: () => new Date().toISOString().split('T')[0] }
    ],
    sortBy: 'priority',
    sortOrder: 'desc'
  },
  {
    id: 'finance-related',
    name: 'Finance Tasks',
    description: 'Financial to-dos',
    icon: '💰',
    conditions: [
      { field: 'isFinanceRelated', operator: 'equals', value: true }
    ],
    sortBy: 'dueDate',
    sortOrder: 'asc'
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    description: 'Currently working on',
    icon: '⚙️',
    conditions: [
      { field: 'status', operator: 'equals', value: 'in-progress' }
    ],
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  }
]

// === JOB FILTER PRESETS ===

export const JOB_PRESETS: FilterPreset[] = [
  {
    id: 'active-applications',
    name: 'Active Applications',
    description: 'Currently in process',
    icon: '📝',
    conditions: [
      { field: 'status', operator: 'in', value: ['applied', 'screening', 'interviewing'] }
    ],
    sortBy: 'appliedDate',
    sortOrder: 'desc'
  },
  {
    id: 'high-priority-jobs',
    name: 'High Priority',
    description: 'Priority applications',
    icon: '⭐',
    conditions: [
      { field: 'priority', operator: 'equals', value: 'high' },
      { field: 'status', operator: 'not_in', value: ['rejected', 'withdrawn', 'archived'] }
    ],
    sortBy: 'appliedDate',
    sortOrder: 'desc'
  },
  {
    id: 'remote-jobs',
    name: 'Remote Only',
    description: 'Fully remote positions',
    icon: '🏠',
    conditions: [
      { field: 'remote', operator: 'equals', value: 'remote' }
    ],
    sortBy: 'appliedDate',
    sortOrder: 'desc'
  },
  {
    id: 'interview-stage',
    name: 'Interview Stage',
    description: 'Currently interviewing',
    icon: '🎤',
    conditions: [
      { field: 'status', operator: 'equals', value: 'interviewing' }
    ],
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  },
  {
    id: 'recent-rejections',
    name: 'Recent Rejections',
    description: 'Rejected in last 30 days',
    icon: '❌',
    conditions: [
      { field: 'status', operator: 'equals', value: 'rejected' },
      { field: 'updatedAt', operator: 'greater_than_or_equal', value: () => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString()
      }}
    ],
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  }
]

// === FILTER ENGINE ===

export function applyFilter<T extends Record<string, any>>(
  items: T[],
  conditions: FilterCondition[]
): T[] {
  return items.filter(item => {
    return conditions.every(condition => {
      return evaluateCondition(item, condition)
    })
  })
}

function evaluateCondition<T extends Record<string, any>>(
  item: T,
  condition: FilterCondition
): boolean {
  const fieldValue = getNestedValue(item, condition.field)
  let conditionValue = condition.value
  
  // Evaluate function values
  if (typeof conditionValue === 'function') {
    conditionValue = conditionValue()
  }
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue
    
    case 'not_equals':
      return fieldValue !== conditionValue
    
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase())
    
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase())
    
    case 'starts_with':
      return String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase())
    
    case 'ends_with':
      return String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase())
    
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue)
    
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue)
    
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(conditionValue)
    
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(conditionValue)
    
    case 'between':
      if (!Array.isArray(conditionValue) || conditionValue.length !== 2) return false
      return Number(fieldValue) >= Number(conditionValue[0]) && 
             Number(fieldValue) <= Number(conditionValue[1])
    
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(fieldValue)
    
    case 'not_in':
      return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue)
    
    case 'is_null':
      return fieldValue === null || fieldValue === undefined
    
    case 'is_not_null':
      return fieldValue !== null && fieldValue !== undefined
    
    case 'matches_regex':
      try {
        const regex = new RegExp(String(conditionValue))
        return regex.test(String(fieldValue))
      } catch {
        return false
      }
    
    default:
      return true
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// === SORT ENGINE ===

export function applySort<T extends Record<string, any>>(
  items: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aVal = getNestedValue(a, sortBy)
    const bVal = getNestedValue(b, sortBy)
    
    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    
    const comparison = aVal < bVal ? -1 : 1
    return sortOrder === 'asc' ? comparison : -comparison
  })
}

// === PRESET APPLICATION ===

export function applyPreset<T extends Record<string, any>>(
  items: T[],
  preset: FilterPreset
): T[] {
  let result = applyFilter(items, preset.conditions)
  
  if (preset.sortBy) {
    result = applySort(result, preset.sortBy, preset.sortOrder)
  }
  
  return result
}

// === CUSTOM FILTER BUILDER ===

export class FilterBuilder<T extends Record<string, any>> {
  private conditions: FilterCondition[] = []
  private sortField?: string
  private sortDirection: 'asc' | 'desc' = 'asc'
  
  where(field: string, operator: FilterOperator, value?: any): this {
    this.conditions.push({ field, operator, value })
    return this
  }
  
  and(field: string, operator: FilterOperator, value?: any): this {
    this.conditions.push({ field, operator, value, logic: 'and' })
    return this
  }
  
  or(field: string, operator: FilterOperator, value?: any): this {
    this.conditions.push({ field, operator, value, logic: 'or' })
    return this
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.sortField = field
    this.sortDirection = direction
    return this
  }
  
  apply(items: T[]): T[] {
    let result = applyFilter(items, this.conditions)
    
    if (this.sortField) {
      result = applySort(result, this.sortField, this.sortDirection)
    }
    
    return result
  }
  
  build(): FilterPreset {
    return {
      id: 'custom',
      name: 'Custom Filter',
      conditions: this.conditions,
      sortBy: this.sortField,
      sortOrder: this.sortDirection
    }
  }
}

// === SMART FILTERS ===

export function getSuggestedFilters<T extends Record<string, any>>(
  _items: T[],
  recentFilters: FilterPreset[]
): FilterPreset[] {
  // Analyze data and suggest relevant filters
  const suggestions: FilterPreset[] = []
  
  // Add most used presets from recent filters
  const presetCounts = new Map<string, number>()
  recentFilters.forEach(f => {
    presetCounts.set(f.id, (presetCounts.get(f.id) || 0) + 1)
  })
  
  return suggestions
}

// === FILTER PERSISTENCE ===

const FILTER_HISTORY_KEY = 'mydsp_filter_history'

export function saveFilterHistory(preset: FilterPreset): void {
  try {
    const history = getFilterHistory()
    history.unshift(preset)
    
    // Keep only last 20
    const trimmed = history.slice(0, 20)
    
    localStorage.setItem(FILTER_HISTORY_KEY, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Failed to save filter history:', error)
  }
}

export function getFilterHistory(): FilterPreset[] {
  try {
    const stored = localStorage.getItem(FILTER_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function clearFilterHistory(): void {
  localStorage.removeItem(FILTER_HISTORY_KEY)
}
