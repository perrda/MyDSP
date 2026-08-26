import { useMemo, useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Download,
  Upload,
  Clock,
  AlertCircle,
  Edit2,
  Copy,
  Archive,
  Trash2,
  ImagePlus,
  CheckCircle2,
  Circle,
  FolderInput,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { PagePrimaryActions } from '../components/ui/PagePrimaryActions'
import { BackNav } from '../components/ui/BackNav'
import { EmptyState } from '../components/ui/EmptyState'
import { CollapsibleFilters } from '../components/ui/CollapsibleFilters'
import { ConfirmDialog } from '../components/ui/Modal'
import { TodoModal } from '../components/TodoModal'
import { TodoListModal } from '../components/TodoListModal'
import { ReorderList, ReorderHandle } from '../components/ui/Reorderable'
import { SwipeTodoRow } from '../components/ui/SwipeTodoRow'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { snoozeDueDateOneDay } from '../domain/todoSnooze'
import { checkTodoReminders, ensureDesktopNotificationPermission } from '../domain/todoReminders'
import { TodoScreenshotImportModal } from '../components/TodoScreenshotImportModal'
import { TodoListPicker } from '../components/TodoListPicker'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { syncHighlightClass, useSyncHighlights } from '../hooks/useSyncHighlights'
import type { TodoFilterBy, TodoItem, TodoList, TodoSortBy } from '../domain/todo-types'
import {
  calculateTodoStats,
  completeTodoWithRecurrence,
  createTodoItem,
  exportTodosToCsv,
  filterTodoItems,
  isOverdue,
  nextSortOrderForList,
  parseCsvToTodoItems,
  sortTodoItems,
} from '../domain/todos'
import { parseTodoQuickAdd } from '../domain/todoQuickAdd'
import { moveTodoItemsToList } from '../domain/todoOcr'
import {
  loadTodosQuickFilter,
  saveTodosQuickFilter,
} from '../domain/todosQuickFilterPrefs'
import { loadTodosSort, saveTodosSort } from '../domain/todosSortPrefs'
import { privacyClass, formatDate } from '../utils/format'

const PRIORITY_COLORS = {
  high: 'border-l-red-500 bg-red-950/10',
  medium: 'border-l-amber-500 bg-amber-950/10',
  low: 'border-l-accent/60 bg-accent/5',
}

const PRIORITY_TEXT_COLORS = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-accent',
}

const PRIORITY_CHIP_LABEL: Record<TodoItem['priority'], string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

const STATUS_LABELS = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
  archived: 'Archived',
}

const TODO_DAY_SEGMENTS = ['Morning', 'Afternoon', 'Evening'] as const

const FILTER_SUMMARY: Record<TodoFilterBy, string> = {
  all: 'All',
  'high-priority': 'High priority',
  'medium-priority': 'Medium priority',
  'low-priority': 'Low priority',
  'status-todo': 'To Do',
  'status-in-progress': 'In Progress',
  archived: 'Archived',
  overdue: 'Overdue',
  today: 'Due today',
  'this-week': 'This week',
  'no-due-date': 'No due date',
  'finance-related': 'Finance',
}

const SORT_SUMMARY: Record<TodoSortBy, string> = {
  'order-asc': '#1 → n',
  'order-desc': '#n → 1',
  'priority-desc': 'Priority ↓',
  'priority-asc': 'Priority ↑',
  'due-date-asc': 'Due earliest',
  'due-date-desc': 'Due latest',
  'created-desc': 'Newest',
  'created-asc': 'Oldest',
  'title-asc': 'A–Z',
  'title-desc': 'Z–A',
}

/** Format YYYY-MM-DD due dates in local time without UTC day-shift. */
function formatTodoDue(dueDate: string, dueTime?: string): string {
  let dateLabel = dueDate
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [y, m, d] = dueDate.split('-').map(Number)
    dateLabel = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d))
  } else {
    dateLabel = formatDate(dueDate)
  }
  return dueTime ? `${dateLabel} · ${dueTime}` : dateLabel
}

function todayYmd(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function todoDaySegment(item: TodoItem): (typeof TODO_DAY_SEGMENTS)[number] {
  const hour = Number((item.dueTime || '').split(':')[0])
  if (Number.isFinite(hour)) {
    if (hour < 12) return 'Morning'
    if (hour < 17) return 'Afternoon'
    return 'Evening'
  }
  if (item.priority === 'high') return 'Morning'
  if (item.priority === 'medium') return 'Afternoon'
  return 'Evening'
}

export function TodosPage() {
  const { data, setData, privacy } = usePortfolio()
  const { success, error: showError } = useToasts()
  const [searchParams, setSearchParams] = useSearchParams()
  const justSyncedTodos = useSyncHighlights('todoItems')
  const [selectedListId, setSelectedListId] = useState<number | null>(() => {
    const sorted = sortBySortOrder(data.todoLists || [])
    return sorted[0]?.id ?? null
  })
  const [sortBy, setSortBy] = useState<TodoSortBy>(() => loadTodosSort())
  const [filterBy, setFilterBy] = useState<TodoFilterBy>(() => loadTodosQuickFilter())
  const [searchQuery, setSearchQuery] = useState('')
  const [quickAddText, setQuickAddText] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'day'>('list')
  /** Quick priority chips — empty = no extra priority constraint */
  const [priorityChips, setPriorityChips] = useState<Set<'high' | 'medium' | 'low'>>(new Set())
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>()
  const [editingList, setEditingList] = useState<TodoList | undefined>()
  const [selectedTodos, setSelectedTodos] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const [showScreenshotImport, setShowScreenshotImport] = useState(false)
  const [bulkMoveListId, setBulkMoveListId] = useState<number | ''>('')
  const [focusTodoId, setFocusTodoId] = useState<number | null>(null)
  /** Completed section open — collapsed by default on phone (<768). */
  const [completedOpen, setCompletedOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  )

  const lists = sortBySortOrder(data.todoLists || [])
  const allItems = data.todoItems || []
  const listCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const item of allItems) {
      m.set(item.listId, (m.get(item.listId) ?? 0) + 1)
    }
    return m
  }, [allItems])
  const todoItemsRef = useRef(allItems)
  todoItemsRef.current = allItems

  useEffect(() => {
    const run = () => {
      checkTodoReminders(todoItemsRef.current, {
        onToast: (title, message) => success(title, message),
      })
    }
    run()
    const id = window.setInterval(run, 60_000)
    return () => window.clearInterval(id)
  }, [success])

  // Deep-link: /todos?list=<id> selects the synced list (focus wins if both present)
  useEffect(() => {
    if (searchParams.get('focus')) return
    const raw = searchParams.get('list')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) {
      setSearchParams({}, { replace: true })
      return
    }
    const list = lists.find((l) => l.id === id)
    if (!list) {
      setSearchParams({}, { replace: true })
      return
    }
    setSelectedListId(id)
    setSearchParams({}, { replace: true })
  }, [searchParams, lists, setSearchParams])

  // Deep-link: /todos?focus=<id> selects list, reveals item, scrolls into view
  useEffect(() => {
    const raw = searchParams.get('focus')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) {
      setSearchParams({}, { replace: true })
      return
    }
    const item = allItems.find((t) => t.id === id)
    if (!item) {
      setSearchParams({}, { replace: true })
      return
    }
    setSelectedListId(item.listId)
    setFilterBy('all')
    setSearchQuery('')
    setPriorityChips(new Set())
    const visibleInDay =
      item.status !== 'archived' &&
      Boolean(item.dueDate && (item.dueDate.slice(0, 10) === todayYmd() || isOverdue(item)))
    if (viewMode === 'day' && !visibleInDay) setViewMode('list')
    if (item.status === 'done' || item.status === 'archived') {
      setShowCompleted(true)
      setCompletedOpen(true)
    }
    setFocusTodoId(id)
    setSearchParams({}, { replace: true })
  }, [searchParams, allItems, setSearchParams, viewMode])

  useEffect(() => {
    if (focusTodoId == null) return
    const tryScroll = () => {
      const el = document.getElementById(`todo-${focusTodoId}`)
      if (!el) return false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
    if (tryScroll()) {
      const clear = window.setTimeout(() => setFocusTodoId(null), 2500)
      return () => window.clearTimeout(clear)
    }
    const retry = window.setTimeout(() => {
      tryScroll()
      window.setTimeout(() => setFocusTodoId(null), 2500)
    }, 100)
    return () => window.clearTimeout(retry)
  }, [focusTodoId, selectedListId, filterBy, showCompleted])

  const enableDesktopReminders = async () => {
    const perm = await ensureDesktopNotificationPermission()
    if (perm === 'granted') success('Desktop reminders on', 'You will get system notifications for due reminders')
    else if (perm === 'denied') showError('Permission denied', 'Enable notifications in browser settings')
    else if (perm === 'unsupported') showError('Not supported', 'This browser does not support notifications')
  }

  const handleReorderLists = (next: TodoList[]) => {
    setData((prev) => ({
      ...prev,
      todoLists: applySortOrder(next),
    }))
  }

  const handleReorderItems = (listId: number, reorderedVisible: TodoItem[]) => {
    if (sortBy !== 'order-asc') setSortBy('order-asc')
    const now = new Date().toISOString()
    setData((prev) => {
      const inList = (prev.todoItems ?? []).filter((i) => i.listId === listId)
      const visibleIds = new Set(reorderedVisible.map((i) => i.id))
      const hidden = sortBySortOrder(inList.filter((i) => !visibleIds.has(i.id)))
      const nextOrder = applySortOrder([...reorderedVisible, ...hidden])
      const idToOrder = new Map(nextOrder.map((i) => [i.id, i.sortOrder!]))
      return {
        ...prev,
        todoItems: (prev.todoItems ?? []).map((item) =>
          item.listId === listId && idToOrder.has(item.id)
            ? { ...item, sortOrder: idToOrder.get(item.id), updatedAt: now }
            : item,
        ),
      }
    })
  }

  const currentList = selectedListId ? lists.find((l) => l.id === selectedListId) : null
  const listItems = selectedListId ? allItems.filter((i) => i.listId === selectedListId) : allItems

  /** Stable #1..n per list (non-archived), based on sortOrder */
  const orderNumbers = useMemo(() => {
    const map = new Map<number, number>()
    const byList = new Map<number, TodoItem[]>()
    for (const item of allItems) {
      if (item.status === 'archived') continue
      const arr = byList.get(item.listId) ?? []
      arr.push(item)
      byList.set(item.listId, arr)
    }
    for (const [, arr] of byList) {
      sortBySortOrder(arr).forEach((item, index) => {
        map.set(item.id, index + 1)
      })
    }
    return map
  }, [allItems])

  /** Grip visible whenever a single list is open — drag also switches sort to Number order */
  const canReorderItems = selectedListId != null

  const filteredItems = useMemo(() => {
    let items = filterTodoItems(listItems, filterBy)

    if (priorityChips.size > 0) {
      items = items.filter((i) => priorityChips.has(i.priority))
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.description?.toLowerCase().includes(query) ||
          (i.tags ?? []).some((t) => t.toLowerCase().includes(query)),
      )
    }

    if (!showCompleted && filterBy !== 'archived') {
      items = items.filter((i) => i.status !== 'done' && i.status !== 'archived')
    }

    return sortTodoItems(items, sortBy)
  }, [listItems, filterBy, priorityChips, searchQuery, showCompleted, sortBy])

  const incompleteItems = useMemo(
    () => filteredItems.filter((i) => i.status !== 'done' && i.status !== 'archived'),
    [filteredItems],
  )
  const completedItems = useMemo(
    () => filteredItems.filter((i) => i.status === 'done' || i.status === 'archived'),
    [filteredItems],
  )
  const dayGroups = useMemo(() => {
    const today = todayYmd()
    const groups = new Map<(typeof TODO_DAY_SEGMENTS)[number], TodoItem[]>(
      TODO_DAY_SEGMENTS.map((segment) => [segment, []]),
    )
    filteredItems
      .filter((item) => item.dueDate === today && item.status !== 'archived')
      .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
      .forEach((item) => {
        groups.get(todoDaySegment(item))!.push(item)
      })
    return groups
  }, [filteredItems])
  const dayOverdueItems = useMemo(
    () =>
      filteredItems
        .filter((item) => isOverdue(item))
        .sort(
          (a, b) =>
            (a.dueDate || '').localeCompare(b.dueDate || '') ||
            (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'),
        ),
    [filteredItems],
  )

  const filterActiveCount = useMemo(() => {
    let n = 0
    if (filterBy !== 'all') n++
    if (sortBy !== 'order-asc') n++
    if (priorityChips.size > 0) n++
    if (searchQuery.trim()) n++
    if (showCompleted) n++
    return n
  }, [filterBy, sortBy, priorityChips, searchQuery, showCompleted])

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (filterBy !== 'all') parts.push(FILTER_SUMMARY[filterBy])
    if (sortBy !== 'order-asc') parts.push(SORT_SUMMARY[sortBy])
    if (priorityChips.size > 0) {
      parts.push(
        [...priorityChips]
          .map((p) => PRIORITY_CHIP_LABEL[p])
          .join('+'),
      )
    }
    if (searchQuery.trim()) parts.push(`“${searchQuery.trim().slice(0, 16)}${searchQuery.trim().length > 16 ? '…' : ''}”`)
    if (showCompleted) parts.push('Completed')
    return parts.length ? parts.join(' · ') : 'None active'
  }, [filterBy, sortBy, priorityChips, searchQuery, showCompleted])

  const togglePriorityChip = (p: 'high' | 'medium' | 'low') => {
    setPriorityChips((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const stats = useMemo(() => calculateTodoStats(listItems), [listItems])

  const openCreateList = () => {
    setEditingList(undefined)
    setShowListModal(true)
  }

  const openEditList = (list: TodoList) => {
    setEditingList(list)
    setShowListModal(true)
  }

  const handleSaveList = (list: TodoList) => {
    if (editingList) {
      setData((prev) => ({
        ...prev,
        todoLists: (prev.todoLists ?? []).map((l) => (l.id === list.id ? list : l)),
      }))
      success('List updated', list.name)
    } else {
      setData((prev) => ({
        ...prev,
        todoLists: [...(prev.todoLists ?? []), list],
      }))
      setSelectedListId(list.id)
      success('List created', list.name)
    }
    setShowListModal(false)
    setEditingList(undefined)
  }

  const handleDeleteList = (list: TodoList) => {
    const count = allItems.filter((i) => i.listId === list.id).length
    setConfirmState({
      title: 'Delete list',
      body:
        count > 0
          ? `Delete “${list.name}” and its ${count} task${count === 1 ? '' : 's'}? This cannot be undone.`
          : `Delete “${list.name}”? This cannot be undone.`,
      confirmLabel: 'Delete list',
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          todoLists: (prev.todoLists ?? []).filter((l) => l.id !== list.id),
          todoItems: (prev.todoItems ?? []).filter((i) => i.listId !== list.id),
        }))
        if (selectedListId === list.id) setSelectedListId(null)
        success('List deleted', list.name)
      },
    })
  }

  const handleCreateItem = () => {
    if (lists.length === 0) {
      showError('Create a list first', 'You need at least one list to add items')
      openCreateList()
      return
    }
    setEditingTodo(undefined)
    setShowTaskModal(true)
  }

  const handleQuickAdd = () => {
    const raw = quickAddText.trim()
    if (!raw) return
    if (lists.length === 0) {
      showError('Create a list first', 'You need at least one list to add items')
      openCreateList()
      return
    }
    const listId = selectedListId || lists[0]?.id
    if (!listId) return
    const parsed = parseTodoQuickAdd(raw)
    if (!parsed.title) return
    const item = createTodoItem({
      title: parsed.title,
      listId,
      dueDate: parsed.dueDate,
      priority: parsed.priority,
      tags: parsed.tags,
    })
    setData((prev) => {
      const withOrder = {
        ...item,
        sortOrder: nextSortOrderForList(prev.todoItems ?? [], listId),
      }
      return {
        ...prev,
        todoItems: [...(prev.todoItems ?? []), withOrder],
      }
    })
    setQuickAddText('')
    success(
      'Task created',
      parsed.dueDate ? `${parsed.title} · due ${parsed.dueDate}` : parsed.title,
    )
  }

  const handleEditItem = (item: TodoItem) => {
    setEditingTodo(item)
    setShowTaskModal(true)
  }

  const handleSaveItem = (item: TodoItem) => {
    if (editingTodo) {
      setData((prev) => ({
        ...prev,
        todoItems: (prev.todoItems ?? []).map((i) => (i.id === item.id ? item : i)),
      }))
      success('Task updated')
    } else {
      setData((prev) => {
        const withOrder = {
          ...item,
          sortOrder: item.sortOrder ?? nextSortOrderForList(prev.todoItems ?? [], item.listId),
        }
        return {
          ...prev,
          todoItems: [...(prev.todoItems ?? []), withOrder],
        }
      })
      success('Task created', item.title)
    }
    setShowTaskModal(false)
    setEditingTodo(undefined)
  }

  const handleDuplicateItem = (item: TodoItem) => {
    setData((prev) => {
      const sortOrder = nextSortOrderForList(prev.todoItems ?? [], item.listId)
      const duplicate = {
        ...item,
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: `${item.title} (copy)`,
        status: 'todo' as const,
        completedAt: undefined,
        sortOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return {
        ...prev,
        todoItems: [...(prev.todoItems ?? []), duplicate],
      }
    })
    success('Task duplicated')
  }

  const handleToggleSelect = (id: number) => {
    const next = new Set(selectedTodos)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedTodos(next)
  }

  const handleBulkComplete = () => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      todoItems: [...selectedTodos].reduce(
        (items, id) => completeTodoWithRecurrence(items, id, now),
        prev.todoItems ?? [],
      ),
    }))
    success('Tasks completed', `${selectedTodos.size} tasks`)
    setSelectedTodos(new Set())
  }

  const handleBulkArchive = () => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        selectedTodos.has(i.id) ? { ...i, status: 'archived' as const, updatedAt: now } : i,
      ),
    }))
    success('Tasks archived', `${selectedTodos.size} tasks`)
    setSelectedTodos(new Set())
  }

  const handleBulkMove = () => {
    if (bulkMoveListId === '' || selectedTodos.size === 0) return
    const targetId = Number(bulkMoveListId)
    const target = lists.find((l) => l.id === targetId)
    setData((prev) => ({
      ...prev,
      todoItems: moveTodoItemsToList(prev.todoItems ?? [], selectedTodos, targetId),
    }))
    success('Tasks moved', `${selectedTodos.size} → ${target?.name ?? 'list'}`)
    setSelectedTodos(new Set())
    setBulkMoveListId('')
  }

  const handleToggleComplete = (item: TodoItem) => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      todoItems: completeTodoWithRecurrence(prev.todoItems ?? [], item.id, now),
    }))
  }

  const handleFocus = (item: TodoItem) => {
    if (item.status === 'done' || item.status === 'archived') return
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, status: 'in-progress' as const, updatedAt: now }
          : candidate,
      ),
    }))
    setFocusTodoId(item.id)
    success('Focus started', item.title)
  }

  const handleRestoreItem = (id: number) => {
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === id ? { ...i, status: 'todo' as const, updatedAt: now } : i,
      ),
    }))
    success('Task restored')
  }

  const handleSnooze = (item: TodoItem) => {
    if (item.status === 'done' || item.status === 'archived') return
    const dueDate = snoozeDueDateOneDay(item.dueDate)
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === item.id ? { ...i, dueDate, updatedAt: now } : i,
      ),
    }))
    success('Snoozed', `Due ${dueDate}`)
  }

  const handleScreenshotImport = (items: TodoItem[]) => {
    setData((prev) => {
      let existing = prev.todoItems ?? []
      const withOrders = items.map((item) => {
        const sortOrder = nextSortOrderForList(existing, item.listId)
        const next = { ...item, sortOrder }
        existing = [...existing, next]
        return next
      })
      return { ...prev, todoItems: [...(prev.todoItems ?? []), ...withOrders] }
    })
    if (items[0]?.listId) setSelectedListId(items[0].listId)
    setShowScreenshotImport(false)
    success('Imported from screenshot', `${items.length} tasks`)
  }

  const handleBulkDelete = () => {
    const count = selectedTodos.size
    setConfirmState({
      title: 'Delete tasks',
      body: `Delete ${count} selected task${count === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete tasks',
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          todoItems: (prev.todoItems ?? []).filter((i) => !selectedTodos.has(i.id)),
        }))
        success('Tasks deleted', `${count} tasks`)
        setSelectedTodos(new Set())
      },
    })
  }

  const handleDeleteItem = (id: number) => {
    setConfirmState({
      title: 'Delete task',
      body: 'Delete this task? This cannot be undone.',
      confirmLabel: 'Delete task',
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          todoItems: (prev.todoItems ?? []).filter((i) => i.id !== id),
        }))
        success('To Do deleted')
      },
    })
  }

  const handleImportCsv = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      const listId = selectedListId || lists[0]?.id
      if (!listId) {
        showError('No list selected', 'Create a list first')
        return
      }

      const items = parseCsvToTodoItems(text, listId)
      setData((prev) => {
        let existing = prev.todoItems ?? []
        const withOrders = items.map((item) => {
          const sortOrder = nextSortOrderForList(existing, item.listId)
          const next = { ...item, sortOrder }
          existing = [...existing, next]
          return next
        })
        return { ...prev, todoItems: [...(prev.todoItems ?? []), ...withOrders] }
      })
      success("Imported To Do's", `${items.length} items added`)
    }
    input.click()
  }

  const handleExportCsv = () => {
    const csv = exportTodosToCsv(filteredItems)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `todos-${currentList?.name || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    success('Exported', `${filteredItems.length} items`)
  }

  const activeListIdForModal = selectedListId || lists[0]?.id || 0

  return (
    <div className={privacyClass(privacy)}>
      {showListModal && (
        <TodoListModal
          list={editingList}
          onSave={handleSaveList}
          onClose={() => {
            setShowListModal(false)
            setEditingList(undefined)
          }}
        />
      )}
      {showTaskModal && lists.length > 0 && (
        <TodoModal
          todo={editingTodo}
          listId={activeListIdForModal}
          lists={lists}
          onSave={handleSaveItem}
          onClose={() => {
            setShowTaskModal(false)
            setEditingTodo(undefined)
          }}
        />
      )}
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        body={confirmState?.body ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        onClose={() => setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />
      {showScreenshotImport && lists.length > 0 && (
        <TodoScreenshotImportModal
          lists={lists}
          defaultListId={activeListIdForModal}
          onImport={handleScreenshotImport}
          onClose={() => setShowScreenshotImport(false)}
        />
      )}

      <PageHeader
        eyebrow="Tasks"
        title="To Do's"
        description={
          lists.length === 0
            ? 'Organize and track your tasks across multiple lists'
            : `${stats.total} tasks · ${stats.highPriority} high · ${stats.overdue} overdue`
        }
        action={
          <PagePrimaryActions
            primaryLabel="New Task"
            onPrimary={handleCreateItem}
            primaryDisabled={lists.length === 0}
            menuLabel="To Do actions"
            items={[
              { id: 'list', label: 'New List', onClick: openCreateList },
              {
                id: 'ocr',
                label: 'From Screenshot',
                onClick: () => {
                  if (lists.length === 0) {
                    showError('Create a list first', 'You need a list before importing')
                    openCreateList()
                    return
                  }
                  setShowScreenshotImport(true)
                },
              },
            ]}
          />
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          illustration
          title="No Lists Yet"
          description="Create your first To Do list to start tracking tasks. Organize by project, category, or any way that works for you — or import from a screenshot with on-device OCR."
          action={{
            label: 'Create First List',
            onClick: openCreateList,
          }}
          secondaryAction={{
            label: 'From Screenshot (OCR)',
            onClick: () => {
              showError('Create a list first', 'You need a list before importing from a screenshot')
              openCreateList()
            },
          }}
        />
      ) : (
        <>
          <form
            className="todos-quick-add flex flex-wrap gap-2 mb-4 items-stretch"
            onSubmit={(e) => {
              e.preventDefault()
              handleQuickAdd()
            }}
            aria-label="Quick add task"
          >
            <label className="sr-only" htmlFor="todos-quick-add">
              Quick add task
            </label>
            <input
              id="todos-quick-add"
              type="text"
              className="toolbar-select flex-1 min-w-[12rem] !w-auto px-3 py-2.5 text-sm min-h-11"
              placeholder="Quick add — e.g. Pay rent Friday"
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn-primary btn-sm min-h-11 px-4"
              disabled={!quickAddText.trim()}
            >
              <Plus size={16} /> Add
            </button>
          </form>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-5 sm:mb-6">
            <div className="surface p-3 sm:p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-[11px] sm:text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">To Do</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums">{stats.todo}</p>
            </div>
            <div className="surface p-3 sm:p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-[11px] sm:text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">In Progress</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-amber-500">{stats.inProgress}</p>
            </div>
            <div className="surface p-3 sm:p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-[11px] sm:text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Done</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-green-500">{stats.done}</p>
            </div>
            <div className="surface p-3 sm:p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-[11px] sm:text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">High Priority</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-red-500">{stats.highPriority}</p>
            </div>
            <div className="surface p-3 sm:p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none col-span-2 sm:col-span-1">
              <p className="text-[11px] sm:text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Overdue</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-red-500">{stats.overdue}</p>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            {selectedListId != null ? (
              <BackNav
                label="Back to all lists"
                onClick={() => {
                  setSelectedListId(null)
                  window.scrollTo(0, 0)
                }}
              />
            ) : (
              <p className="text-xs text-text-subtle">Pick a list · Sort inside the menu to reorder</p>
            )}
            <div className="flex items-center gap-2">
              <div className="ui-seg-group ui-seg-group--tight" role="tablist" aria-label="To Do view">
                {(['list', 'day'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === mode}
                    className={`ui-seg ${viewMode === mode ? 'is-active' : ''}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === 'list' ? 'List' : 'Day'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`btn-sm ${selectMode ? 'btn-primary' : 'btn-ghost'} text-xs`}
                aria-pressed={selectMode}
                onClick={() => {
                  setSelectMode((v) => {
                    if (v) setSelectedTodos(new Set())
                    return !v
                  })
                }}
              >
                {selectMode ? 'Done' : 'Select'}
              </button>
              <button type="button" className="btn-ghost btn-sm text-xs hidden sm:inline-flex" onClick={() => void enableDesktopReminders()}>
                Enable desktop reminders
              </button>
            </div>
          </div>

          <div className="todos-tablet-two-pane">
            <div className="todos-tablet-two-pane__lists">
              <TodoListPicker
                lists={lists}
                selectedListId={selectedListId}
                counts={listCounts}
                totalCount={allItems.length}
                onSelect={(id) => {
                  setSelectedListId(id)
                  window.scrollTo(0, 0)
                }}
                onReorder={handleReorderLists}
                onEdit={openEditList}
                onDelete={handleDeleteList}
              />
            </div>
            <div className="todos-tablet-two-pane__detail">

          {currentList?.description && (
            <p className="text-sm text-text-muted mb-4">{currentList.description}</p>
          )}
          {currentList?.shared ? (
            <div
              className="mb-4 rounded border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text-muted"
              data-testid="todos-list-share-hint"
              role="status"
            >
              <span className="font-semibold text-text">Household (local)</span> — this shared-list hint syncs through workspace cloud sync.
            </div>
          ) : null}

          {/* Filters collapsed by default — Import / Screenshot / Export stay on the header */}
          <CollapsibleFilters
            id="todos-filters"
            className="todos-sticky-filters"
            title="Filters & search"
            summary={filterSummary}
            activeCount={filterActiveCount}
            actions={
              <>
                <button type="button" onClick={handleImportCsv} className="btn-secondary btn-sm">
                  <Upload size={14} /> Import
                </button>
                <button
                  type="button"
                  onClick={() => setShowScreenshotImport(true)}
                  className="btn-primary btn-sm"
                >
                  <ImagePlus size={14} /> Screenshot
                </button>
                <button type="button" onClick={handleExportCsv} className="btn-ghost btn-sm">
                  <Download size={14} /> Export
                </button>
              </>
            }
          >
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="flex-1 min-w-[9.5rem]">
                <label className="block text-[11px] uppercase tracking-wider text-text-subtle mb-1.5 font-semibold">
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const next = e.target.value as TodoSortBy
                    setSortBy(next)
                    saveTodosSort(next)
                  }}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="order-asc">Number (#1 → n)</option>
                  <option value="order-desc">Number (#n → 1)</option>
                  <option value="priority-desc">Priority (High first)</option>
                  <option value="priority-asc">Priority (Low first)</option>
                  <option value="due-date-asc">Due Date (Earliest)</option>
                  <option value="due-date-desc">Due Date (Latest)</option>
                  <option value="created-desc">Newest First</option>
                  <option value="created-asc">Oldest First</option>
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                </select>
              </div>
              <div className="flex-1 min-w-[9.5rem]">
                <label className="block text-[11px] uppercase tracking-wider text-text-subtle mb-1.5 font-semibold">
                  Filter
                </label>
                <select
                  value={filterBy}
                  onChange={(e) => {
                    const next = e.target.value as TodoFilterBy
                    setFilterBy(next)
                    saveTodosQuickFilter(next)
                  }}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="all">All Tasks</option>
                  <option value="high-priority">High Priority</option>
                  <option value="medium-priority">Medium Priority</option>
                  <option value="low-priority">Low Priority</option>
                  <option value="status-todo">Status: To Do</option>
                  <option value="status-in-progress">Status: In Progress</option>
                  <option value="archived">Archived</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due Today</option>
                  <option value="this-week">This Week</option>
                  <option value="no-due-date">No Due Date</option>
                  <option value="finance-related">Finance Related</option>
                </select>
              </div>
              <div className="w-full sm:w-auto sm:flex-1 min-w-[12rem]">
                <label className="block text-[11px] uppercase tracking-wider text-text-subtle mb-1.5 font-semibold">
                  Search
                </label>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
            </div>

            <div className="todos-quick-filter-chips flex flex-wrap items-center gap-2">
              <span className="text-xs md:text-[10px] uppercase tracking-wider text-text-subtle font-semibold w-full sm:w-auto">
                Quick
              </span>
              <button
                type="button"
                className={`todos-due-today-chip min-h-11 sm:min-h-9 px-3.5 rounded border text-sm font-bold ${
                  filterBy === 'today'
                    ? 'bg-accent/25 text-accent ring-1 ring-accent/50 border-transparent'
                    : 'border-border bg-surface-hover text-text-muted hover:border-accent'
                }`}
                aria-pressed={filterBy === 'today'}
                onClick={() => {
                  const next = filterBy === 'today' ? 'all' : 'today'
                  setFilterBy(next)
                  saveTodosQuickFilter(next)
                }}
              >
                Due today
              </button>
              <button
                type="button"
                className={`todos-high-priority-chip min-h-11 sm:min-h-9 px-3.5 rounded border text-sm font-bold ${
                  filterBy === 'high-priority'
                    ? 'bg-red-500/25 text-red-400 ring-1 ring-red-500/50 border-transparent'
                    : 'border-border bg-surface-hover text-text-muted hover:border-accent'
                }`}
                aria-pressed={filterBy === 'high-priority'}
                onClick={() => {
                  const next = filterBy === 'high-priority' ? 'all' : 'high-priority'
                  setFilterBy(next)
                  saveTodosQuickFilter(next)
                }}
              >
                High priority
              </button>
              <span className="text-xs md:text-[10px] uppercase tracking-wider text-text-subtle font-semibold w-full sm:w-auto sm:ml-2">
                Priority
              </span>
              {(
                [
                  {
                    key: 'high' as const,
                    label: 'High',
                    title: 'High',
                    active: 'bg-red-500/25 text-red-400 ring-red-500/50',
                  },
                  {
                    key: 'medium' as const,
                    label: 'Med',
                    title: 'Medium',
                    active: 'bg-amber-500/25 text-amber-400 ring-amber-500/50',
                  },
                  {
                    key: 'low' as const,
                    label: 'Low',
                    title: 'Low',
                    active: 'bg-accent/25 text-accent ring-accent/50',
                  },
                ] as const
              ).map((chip) => {
                const on = priorityChips.has(chip.key)
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => togglePriorityChip(chip.key)}
                    className={`min-h-11 sm:min-h-9 min-w-[3.25rem] px-3.5 rounded border text-sm font-bold ${
                      on
                        ? `${chip.active} ring-1 border-transparent`
                        : 'border-border bg-surface-hover text-text-muted hover:border-accent'
                    }`}
                    aria-pressed={on}
                    title={`${chip.title} priority`}
                    aria-label={`${chip.title} priority`}
                  >
                    {chip.label}
                  </button>
                )
              })}
              {priorityChips.size > 0 && (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-xs"
                  onClick={() => setPriorityChips(new Set())}
                >
                  Clear
                </button>
              )}
              <label className="flex items-center gap-2 text-sm min-h-11 sm:min-h-9 px-3 py-2 bg-surface-hover border border-border rounded sm:ml-auto w-full sm:w-auto">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="w-4 h-4"
                />
                Show completed
              </label>
            </div>

            {selectedListId != null ? (
              <p className="text-xs text-text-subtle">Drag the grip to reorder · #1 is top</p>
            ) : (
              <p className="text-xs text-amber-500/90">Select a list tab to drag-reorder tasks</p>
            )}
          </CollapsibleFilters>

          {selectMode && selectedTodos.size > 0 && (
            <div className="flex flex-wrap gap-2 items-center p-3 mb-4 bg-accent/10 rounded-lg border border-accent/20">
              <span className="text-sm font-semibold">{selectedTodos.size} selected</span>
              <button
                type="button"
                onClick={handleBulkComplete}
                className="btn-sm bg-green-500/20 text-green-500 hover:bg-green-500/30"
              >
                Complete
              </button>
              <button
                type="button"
                onClick={handleBulkArchive}
                className="btn-sm bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
              >
                <Archive size={14} /> Archive
              </button>
              <div className="flex items-center gap-2">
                <FolderInput size={14} className="text-text-subtle" />
                <select
                  value={bulkMoveListId}
                  onChange={(e) => setBulkMoveListId(e.target.value ? Number(e.target.value) : '')}
                  className="px-2 py-1.5 bg-surface-hover border border-border rounded text-sm"
                  aria-label="Move to list"
                >
                  <option value="">Move to list…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkMove}
                  disabled={bulkMoveListId === ''}
                  className="btn-sm btn-primary"
                >
                  Move list
                </button>
              </div>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="btn-sm bg-red-500/20 text-red-500 hover:bg-red-500/30"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedTodos(new Set())}
                className="btn-ghost btn-sm ml-auto"
              >
                Clear
              </button>
            </div>
          )}

          {viewMode === 'day' ? (
            <section
              className="todos-day-view space-y-2 sm:space-y-3"
              data-testid="todos-day-view"
              aria-label="Today's To Do time blocks"
            >
              {dayOverdueItems.length > 0 ? (
                <div
                  className="todos-day-view__overdue [grid-column:1/-1] surface border-l-2 border-l-red-500 p-2.5 sm:p-4 rounded-xl md:rounded-none"
                  data-testid="todos-day-overdue"
                >
                  <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-bold text-red-500">Overdue</h3>
                    <span className="text-xs text-text-subtle">
                      {dayOverdueItems.length} task{dayOverdueItems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="todos-day-view__items space-y-2 sm:space-y-3">
                    {dayOverdueItems.map((item) => (
                      <TodoItemCard
                        key={item.id}
                        item={item}
                        orderNumber={orderNumbers.get(item.id)}
                        listName={lists.find((list) => list.id === item.listId)?.name}
                        selected={selectedTodos.has(item.id)}
                        selectMode={selectMode}
                        focused={focusTodoId === item.id}
                        justSynced={justSyncedTodos.has(item.id)}
                        dayActions
                        onToggleSelect={handleToggleSelect}
                        onToggleComplete={handleToggleComplete}
                        onStartFocus={handleFocus}
                        onSnooze={handleSnooze}
                        onEdit={handleEditItem}
                        onDuplicate={handleDuplicateItem}
                        onRestore={handleRestoreItem}
                        onDelete={handleDeleteItem}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {TODO_DAY_SEGMENTS.map((segment) => {
                const items = dayGroups.get(segment) ?? []
                return (
                  <div
                    key={segment}
                    className="todos-day-view__segment surface p-2.5 sm:p-4 rounded-xl md:rounded-none"
                  >
                    <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-bold">{segment}</h3>
                      <span className="text-xs text-text-subtle">{items.length} task{items.length === 1 ? '' : 's'}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-sm text-text-subtle">No tasks due in this block today.</p>
                    ) : (
                      <div className="todos-day-view__items space-y-2 sm:space-y-3">
                        {items.map((item) => (
                          <TodoItemCard
                            key={item.id}
                            item={item}
                            orderNumber={orderNumbers.get(item.id)}
                            listName={lists.find((l) => l.id === item.listId)?.name}
                            selected={selectedTodos.has(item.id)}
                            selectMode={selectMode}
                            focused={focusTodoId === item.id}
                            justSynced={justSyncedTodos.has(item.id)}
                            dayActions
                            onToggleSelect={handleToggleSelect}
                            onToggleComplete={handleToggleComplete}
                            onStartFocus={handleFocus}
                            onSnooze={handleSnooze}
                            onEdit={handleEditItem}
                            onDuplicate={handleDuplicateItem}
                            onRestore={handleRestoreItem}
                            onDelete={handleDeleteItem}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              illustration
              title={listItems.length === 0 ? 'No Tasks Yet' : 'No Tasks Found'}
              description={
                listItems.length === 0
                  ? 'Add a task or import from a screenshot with on-device OCR.'
                  : 'No tasks match your current filters. Try adjusting your search or create a new task.'
              }
              action={{
                label: 'From Screenshot (OCR)',
                onClick: () => setShowScreenshotImport(true),
              }}
              secondaryAction={{ label: 'New Task', onClick: handleCreateItem }}
            />
          ) : (
            <>
              {canReorderItems && selectedListId != null ? (
                <ReorderList
                  items={incompleteItems}
                  getId={(item) => String(item.id)}
                  onReorder={(next) => {
                    const merged = showCompleted ? [...next, ...completedItems] : next
                    handleReorderItems(selectedListId, merged)
                  }}
                  className="space-y-3"
                >
                  {(item) => (
                    <SwipeTodoRow
                      onComplete={() => handleToggleComplete(item)}
                      onSnooze={() => handleSnooze(item)}
                    >
                      <TodoItemCard
                        item={item}
                        orderNumber={orderNumbers.get(item.id)}
                        listName={!selectedListId ? lists.find((l) => l.id === item.listId)?.name : undefined}
                        selected={selectedTodos.has(item.id)}
                        selectMode={selectMode}
                        focused={focusTodoId === item.id}
                        justSynced={justSyncedTodos.has(item.id)}
                        showReorderHandle
                        onToggleSelect={handleToggleSelect}
                        onToggleComplete={handleToggleComplete}
                        onEdit={handleEditItem}
                        onDuplicate={handleDuplicateItem}
                        onRestore={handleRestoreItem}
                        onDelete={handleDeleteItem}
                      />
                    </SwipeTodoRow>
                  )}
                </ReorderList>
              ) : (
                <div className="space-y-3">
                  {incompleteItems.map((item) => (
                    <SwipeTodoRow
                      key={item.id}
                      onComplete={() => handleToggleComplete(item)}
                      onSnooze={() => handleSnooze(item)}
                    >
                      <TodoItemCard
                        item={item}
                        orderNumber={orderNumbers.get(item.id)}
                        listName={!selectedListId ? lists.find((l) => l.id === item.listId)?.name : undefined}
                        selected={selectedTodos.has(item.id)}
                        selectMode={selectMode}
                        focused={focusTodoId === item.id}
                        justSynced={justSyncedTodos.has(item.id)}
                        onToggleSelect={handleToggleSelect}
                        onToggleComplete={handleToggleComplete}
                        onEdit={handleEditItem}
                        onDuplicate={handleDuplicateItem}
                        onRestore={handleRestoreItem}
                        onDelete={handleDeleteItem}
                      />
                    </SwipeTodoRow>
                  ))}
                </div>
              )}

              {(showCompleted || filterBy === 'archived') && completedItems.length > 0 ? (
                <div className="mt-4 todos-completed-section">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full min-h-11 px-3 py-2 text-left surface rounded-xl md:rounded-none border border-border mb-2"
                    aria-expanded={completedOpen}
                    onClick={() => setCompletedOpen((v) => !v)}
                  >
                    <span className="text-sm font-semibold">
                      {filterBy === 'archived' ? 'Archived' : 'Completed'} ({completedItems.length})
                    </span>
                    <span className="text-xs text-text-subtle ml-auto">
                      {completedOpen ? 'Hide' : 'Show'}
                    </span>
                  </button>
                  {completedOpen ? (
                    <div className="space-y-3">
                      {completedItems.map((item) => (
                        <TodoItemCard
                          key={item.id}
                          item={item}
                          orderNumber={orderNumbers.get(item.id)}
                          listName={!selectedListId ? lists.find((l) => l.id === item.listId)?.name : undefined}
                          selected={selectedTodos.has(item.id)}
                          selectMode={selectMode}
                          focused={focusTodoId === item.id}
                          justSynced={justSyncedTodos.has(item.id)}
                          onToggleSelect={handleToggleSelect}
                          onToggleComplete={handleToggleComplete}
                          onEdit={handleEditItem}
                          onDuplicate={handleDuplicateItem}
                          onRestore={handleRestoreItem}
                          onDelete={handleDeleteItem}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
            </div>
          </div>
        </>
      )}

    </div>
  )
}

function TodoItemCard({
  item,
  orderNumber,
  listName,
  selected,
  selectMode = false,
  focused = false,
  justSynced = false,
  showReorderHandle = false,
  dayActions = false,
  onToggleSelect,
  onToggleComplete,
  onStartFocus,
  onSnooze,
  onEdit,
  onDuplicate,
  onRestore,
  onDelete,
}: {
  item: TodoItem
  orderNumber?: number
  listName?: string
  selected: boolean
  selectMode?: boolean
  focused?: boolean
  justSynced?: boolean
  showReorderHandle?: boolean
  dayActions?: boolean
  onToggleSelect: (id: number) => void
  onToggleComplete: (item: TodoItem) => void
  onStartFocus?: (item: TodoItem) => void
  onSnooze?: (item: TodoItem) => void
  onEdit: (item: TodoItem) => void
  onDuplicate: (item: TodoItem) => void
  onRestore: (id: number) => void
  onDelete: (id: number) => void
}) {
  const overdue = isOverdue(item)
  const dueLabel = item.dueDate ? formatTodoDue(item.dueDate, item.dueTime) : null
  const subtaskCount = item.subtasks?.length ?? 0
  const doneSubtasks = item.subtasks?.filter((s) => s.done).length ?? 0

  return (
    <article
      id={`todo-${item.id}`}
      className={`surface p-3 sm:p-4 border-l-4 rounded-xl md:rounded-none shadow-sm md:shadow-none ${PRIORITY_COLORS[item.priority]} ${
        selected ? 'ring-2 ring-accent' : ''
      } ${focused ? 'todo-focus-ring ring-2 ring-accent' : ''} ${syncHighlightClass(justSynced)}`}
    >
      <div
        className={`grid gap-x-2.5 sm:gap-x-3 gap-y-2 ${
          showReorderHandle
            ? 'grid-cols-[2rem_2.75rem_minmax(0,1fr)]'
            : 'grid-cols-[2.75rem_minmax(0,1fr)]'
        }`}
      >
        {showReorderHandle ? (
          <div className="row-span-2 flex justify-center pt-1">
            <ReorderHandle label="Reorder task" />
          </div>
        ) : null}

        <div className="row-span-2 flex justify-center pt-0.5">
          <button
            type="button"
            onClick={() => onToggleComplete(item)}
            className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-full text-text-subtle hover:text-accent hover:bg-surface-hover"
            title={item.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
            aria-label={item.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.status === 'done' ? (
              <CheckCircle2 size={22} className="text-green-500" />
            ) : (
              <Circle size={22} />
            )}
          </button>
        </div>

        <div className="min-w-0 flex items-start gap-2">
          <button type="button" onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
            <h3
              className={`text-[15px] sm:text-base font-semibold leading-snug break-words ${
                item.status === 'done' ? 'line-through text-text-muted' : 'text-text'
              }`}
            >
              {item.title}
            </h3>
            {item.description ? (
              <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2 break-words">
                {item.description}
              </p>
            ) : null}
          </button>

          <div className="hidden sm:flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="btn-ghost btn-sm btn-icon-edit p-2 min-h-9 min-w-9"
              title="Edit"
              aria-label="Edit task"
            >
              <Edit2 size={16} strokeWidth={1.75} className="icon-edit" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(item)}
              className="btn-ghost btn-sm p-2 min-h-9 min-w-9"
              title="Duplicate"
              aria-label="Duplicate task"
            >
              <Copy size={14} />
            </button>
            {item.status === 'archived' ? (
              <button
                type="button"
                onClick={() => onRestore(item.id)}
                className="btn-ghost btn-sm p-2 min-h-9 min-w-9 text-accent"
                title="Restore"
                aria-label="Restore task"
              >
                <Archive size={14} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="btn-ghost btn-sm p-2 min-h-9 min-w-9 text-red-500 hover:text-red-400"
              title="Delete"
              aria-label="Delete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 content-start">
          {orderNumber != null ? (
            <span
              className="text-xs font-bold tabular-nums text-accent"
              title="List position (#1 is top)"
            >
              #{orderNumber}
            </span>
          ) : null}
          <span
            className={`text-[11px] sm:text-xs font-bold uppercase tracking-wide ${PRIORITY_TEXT_COLORS[item.priority]}`}
          >
            {PRIORITY_CHIP_LABEL[item.priority]}
          </span>
          <span className="text-[11px] sm:text-xs text-text-subtle">
            {STATUS_LABELS[item.status]}
          </span>
          {listName ? (
            <span className="text-[11px] sm:text-xs text-text-subtle truncate max-w-[10rem]">
              {listName}
            </span>
          ) : null}
          {dueLabel ? (
            <span
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs ${
                overdue ? 'text-red-500 font-medium' : 'text-text-subtle'
              }`}
            >
              <Clock size={12} aria-hidden />
              {dueLabel}
            </span>
          ) : null}
          {overdue ? (
            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded font-medium">
              <AlertCircle size={12} aria-hidden /> Overdue
            </span>
          ) : null}
          {item.isFinanceRelated ? (
            <span className="text-[11px] sm:text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded">
              Finance
            </span>
          ) : null}
          {item.recurrence && item.recurrence !== 'none' ? (
            <span className="text-[11px] sm:text-xs px-1.5 py-0.5 bg-surface-hover text-text-subtle rounded">
              Repeats {item.recurrence}
            </span>
          ) : null}
          {subtaskCount > 0 ? (
            <span className="text-[11px] sm:text-xs px-1.5 py-0.5 bg-surface-hover text-text-subtle rounded">
              {doneSubtasks}/{subtaskCount} subtasks
            </span>
          ) : null}
          {item.linkedJobId != null ? (
            <Link
              to={`/jobs/${item.linkedJobId}`}
              className="text-[11px] sm:text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded"
            >
              Job
            </Link>
          ) : null}
          {item.estimatedMinutes ? (
            <span className="text-[11px] sm:text-xs text-text-subtle">{item.estimatedMinutes}m</span>
          ) : null}
          {(item.tags ?? []).length > 0 ? (
            <span className="text-[11px] sm:text-xs text-text-subtle truncate max-w-full">
              {(item.tags ?? []).slice(0, 3).join(' · ')}
              {(item.tags ?? []).length > 3 ? '…' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {dayActions && item.status !== 'done' && item.status !== 'archived' ? (
        <div
          className="todos-day-row-actions mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3"
          data-testid={`todo-day-actions-${item.id}`}
        >
          <button
            type="button"
            className={`btn-sm ${
              item.status === 'in-progress' ? 'btn-secondary border-accent text-accent' : 'btn-primary'
            }`}
            aria-pressed={item.status === 'in-progress'}
            disabled={item.status === 'in-progress'}
            onClick={() => onStartFocus?.(item)}
          >
            {item.status === 'in-progress' ? 'Focused' : 'Focus'}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => onSnooze?.(item)}
          >
            Snooze
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => onToggleComplete(item)}
          >
            Complete
          </button>
        </div>
      ) : null}

      <div className="sm:hidden mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
        {selectMode ? (
          <label className="inline-flex items-center gap-2 text-xs text-text-muted min-h-10">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(item.id)}
              className="w-4 h-4"
              aria-label={`Select ${item.title}`}
            />
            Select
          </label>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="btn-ghost btn-sm btn-icon-edit text-xs px-3 min-h-10"
            aria-label="Edit task"
          >
            <Edit2 size={16} strokeWidth={1.75} className="icon-edit" aria-hidden /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(item)}
            className="btn-ghost btn-sm p-2 min-h-10 min-w-10"
            title="Duplicate"
            aria-label="Duplicate task"
          >
            <Copy size={15} />
          </button>
          {item.status === 'archived' ? (
            <button
              type="button"
              onClick={() => onRestore(item.id)}
              className="btn-ghost btn-sm p-2 min-h-10 min-w-10 text-accent"
              title="Restore"
              aria-label="Restore task"
            >
              <Archive size={15} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="btn-ghost btn-sm p-2 min-h-10 min-w-10 text-red-500"
            title="Delete"
            aria-label="Delete task"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {selectMode ? (
        <div className="hidden sm:flex mt-2.5 items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-text-subtle">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(item.id)}
              className="w-3.5 h-3.5"
              aria-label={`Select ${item.title}`}
            />
            Select for bulk actions
          </label>
        </div>
      ) : null}
    </article>
  )
}
