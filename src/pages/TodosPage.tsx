import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Download,
  Upload,
  ListChecks,
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
import { BackNav } from '../components/ui/BackNav'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/Modal'
import { TodoModal } from '../components/TodoModal'
import { TodoListModal } from '../components/TodoListModal'
import { ReorderList, ReorderHandle } from '../components/ui/Reorderable'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { checkTodoReminders, ensureDesktopNotificationPermission } from '../domain/todoReminders'
import { TodoScreenshotImportModal } from '../components/TodoScreenshotImportModal'
import { TodoListPicker } from '../components/TodoListPicker'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { syncHighlightClass, useSyncHighlights } from '../hooks/useSyncHighlights'
import type { TodoFilterBy, TodoItem, TodoList, TodoSortBy } from '../domain/todo-types'
import {
  calculateTodoStats,
  exportTodosToCsv,
  filterTodoItems,
  isOverdue,
  nextSortOrderForList,
  parseCsvToTodoItems,
  sortTodoItems,
} from '../domain/todos'
import { moveTodoItemsToList } from '../domain/todoOcr'
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

export function TodosPage() {
  const { data, setData, privacy } = usePortfolio()
  const { success, error: showError } = useToasts()
  const justSyncedTodos = useSyncHighlights('todoItems')
  const [selectedListId, setSelectedListId] = useState<number | null>(() => {
    const sorted = sortBySortOrder(data.todoLists || [])
    return sorted[0]?.id ?? null
  })
  const [sortBy, setSortBy] = useState<TodoSortBy>('order-asc')
  const [filterBy, setFilterBy] = useState<TodoFilterBy>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  /** Quick priority chips — empty = no extra priority constraint */
  const [priorityChips, setPriorityChips] = useState<Set<'high' | 'medium' | 'low'>>(new Set())
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>()
  const [editingList, setEditingList] = useState<TodoList | undefined>()
  const [selectedTodos, setSelectedTodos] = useState<Set<number>>(new Set())
  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const [showScreenshotImport, setShowScreenshotImport] = useState(false)
  const [bulkMoveListId, setBulkMoveListId] = useState<number | ''>('')

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

    if (!showCompleted) {
      items = items.filter((i) => i.status !== 'done' && i.status !== 'archived')
    }

    return sortTodoItems(items, sortBy)
  }, [listItems, filterBy, priorityChips, searchQuery, showCompleted, sortBy])

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
      todoItems: (prev.todoItems ?? []).map((i) =>
        selectedTodos.has(i.id)
          ? { ...i, status: 'done' as const, completedAt: now, updatedAt: now }
          : i,
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
    const done = item.status !== 'done'
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: done ? ('done' as const) : ('todo' as const),
              completedAt: done ? now : undefined,
              updatedAt: now,
            }
          : i,
      ),
    }))
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
        success('Todo deleted')
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
      success('Imported todos', `${items.length} items added`)
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
        title="To Do Lists"
        description={
          lists.length === 0
            ? 'Organize and track your tasks across multiple lists'
            : `${stats.total} tasks · ${stats.highPriority} high · ${stats.overdue} overdue`
        }
        action={
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={handleCreateItem} className="btn-primary btn-sm" disabled={lists.length === 0}>
              <Plus size={16} /> New Task
            </button>
            <button type="button" onClick={openCreateList} className="btn-secondary btn-sm">
              <Plus size={16} /> New List
            </button>
            <button
              type="button"
              onClick={() => {
                if (lists.length === 0) {
                  showError('Create a list first', 'You need a list before importing')
                  openCreateList()
                  return
                }
                setShowScreenshotImport(true)
              }}
              className="btn-secondary btn-sm hidden sm:inline-flex"
              disabled={lists.length === 0}
            >
              <ImagePlus size={16} /> From Screenshot
            </button>
          </div>
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={64} />}
          title="No Lists Yet"
          description="Create your first todo list to start tracking tasks. Organize by project, category, or any way that works for you."
          action={{
            label: 'Create First List',
            onClick: openCreateList,
          }}
        />
      ) : (
        <>
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
            <button type="button" className="btn-ghost btn-sm text-xs hidden sm:inline-flex" onClick={() => void enableDesktopReminders()}>
              Enable desktop reminders
            </button>
          </div>

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

          {currentList?.description && (
            <p className="text-sm text-text-muted mb-4">{currentList.description}</p>
          )}

          {/* Compact controls — stays above the task cards (mobile-first) */}
          <div className="surface p-3 sm:p-4 mb-4 rounded-xl md:rounded-none shadow-sm md:shadow-none space-y-3">
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="flex-1 min-w-[9.5rem]">
                <label className="block text-[11px] uppercase tracking-wider text-text-subtle mb-1.5 font-semibold">
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as TodoSortBy)}
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
                  onChange={(e) => setFilterBy(e.target.value as TodoFilterBy)}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="all">All Tasks</option>
                  <option value="high-priority">High Priority</option>
                  <option value="medium-priority">Medium Priority</option>
                  <option value="low-priority">Low Priority</option>
                  <option value="status-todo">Status: To Do</option>
                  <option value="status-in-progress">Status: In Progress</option>
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs md:text-[10px] uppercase tracking-wider text-text-subtle font-semibold w-full sm:w-auto">
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
                    <span className="sm:hidden">{chip.label}</span>
                    <span className="hidden sm:inline">{chip.label}</span>
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

            <div className="flex flex-wrap gap-2 items-center">
              {selectedListId != null ? (
                <p className="text-xs text-text-subtle flex-1 min-w-[12rem]">
                  Drag the grip to reorder · #1 is top
                </p>
              ) : (
                <p className="text-xs text-amber-500/90 flex-1 min-w-[12rem]">
                  Select a list tab to drag-reorder tasks
                </p>
              )}
              <button type="button" onClick={handleImportCsv} className="btn-secondary btn-sm">
                <Upload size={14} /> Import
              </button>
              <button
                type="button"
                onClick={() => setShowScreenshotImport(true)}
                className="btn-secondary btn-sm"
              >
                <ImagePlus size={14} /> Screenshot
              </button>
              <button type="button" onClick={handleExportCsv} className="btn-ghost btn-sm">
                <Download size={14} /> Export
              </button>
            </div>

            {selectedTodos.size > 0 && (
              <div className="flex flex-wrap gap-2 items-center p-3 bg-accent/10 rounded-lg border border-accent/20">
                <span className="text-sm font-semibold">{selectedTodos.size} selected</span>
                <button
                  type="button"
                  onClick={handleBulkComplete}
                  className="btn-sm bg-green-500/20 text-green-500 hover:bg-green-500/30"
                >
                  Complete All
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
                    Move
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="btn-sm bg-red-500/20 text-red-500 hover:bg-red-500/30"
                >
                  Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTodos(new Set())}
                  className="btn-ghost btn-sm ml-auto"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={48} />}
              title="No Tasks Found"
              description="No tasks match your current filters. Try adjusting your search or create a new task."
              action={{ label: 'New Task', onClick: handleCreateItem }}
            />
          ) : canReorderItems && selectedListId != null ? (
            <ReorderList
              items={filteredItems}
              getId={(item) => String(item.id)}
              onReorder={(next) => handleReorderItems(selectedListId, next)}
              className="space-y-3"
            >
              {(item) => (
                <TodoItemCard
                  item={item}
                  orderNumber={orderNumbers.get(item.id)}
                  listName={!selectedListId ? lists.find((l) => l.id === item.listId)?.name : undefined}
                  selected={selectedTodos.has(item.id)}
                  justSynced={justSyncedTodos.has(item.id)}
                  showReorderHandle
                  onToggleSelect={handleToggleSelect}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleEditItem}
                  onDuplicate={handleDuplicateItem}
                  onDelete={handleDeleteItem}
                />
              )}
            </ReorderList>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <TodoItemCard
                  key={item.id}
                  item={item}
                  orderNumber={orderNumbers.get(item.id)}
                  listName={!selectedListId ? lists.find((l) => l.id === item.listId)?.name : undefined}
                  selected={selectedTodos.has(item.id)}
                  justSynced={justSyncedTodos.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleEditItem}
                  onDuplicate={handleDuplicateItem}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          )}
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
  justSynced = false,
  showReorderHandle = false,
  onToggleSelect,
  onToggleComplete,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  item: TodoItem
  orderNumber?: number
  listName?: string
  selected: boolean
  justSynced?: boolean
  showReorderHandle?: boolean
  onToggleSelect: (id: number) => void
  onToggleComplete: (item: TodoItem) => void
  onEdit: (item: TodoItem) => void
  onDuplicate: (item: TodoItem) => void
  onDelete: (id: number) => void
}) {
  const overdue = isOverdue(item)
  const dueLabel = item.dueDate ? formatTodoDue(item.dueDate, item.dueTime) : null

  return (
    <article
      className={`surface p-3 sm:p-4 border-l-4 rounded-xl md:rounded-none shadow-sm md:shadow-none ${PRIORITY_COLORS[item.priority]} ${
        selected ? 'ring-2 ring-accent' : ''
      } ${syncHighlightClass(justSynced)}`}
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
              className="btn-ghost btn-sm p-2 min-h-9 min-w-9"
              title="Edit"
              aria-label="Edit task"
            >
              <Edit2 size={14} />
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

      <div className="sm:hidden mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="btn-ghost btn-sm text-xs px-3 min-h-10"
            aria-label="Edit task"
          >
            <Edit2 size={15} /> Edit
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
    </article>
  )
}
