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
  Settings2,
  ImagePlus,
  CheckCircle2,
  Circle,
  FolderInput,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/Modal'
import { TodoModal } from '../components/TodoModal'
import { TodoListModal, listIconGlyph } from '../components/TodoListModal'
import { ReorderList, ReorderHandle } from '../components/ui/Reorderable'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { checkTodoReminders, ensureDesktopNotificationPermission } from '../domain/todoReminders'
import { TodoScreenshotImportModal } from '../components/TodoScreenshotImportModal'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { TodoFilterBy, TodoItem, TodoList, TodoSortBy } from '../domain/todo-types'
import {
  calculateTodoStats,
  exportTodosToCsv,
  filterTodoItems,
  isOverdue,
  parseCsvToTodoItems,
  sortTodoItems,
} from '../domain/todos'
import { moveTodoItemsToList } from '../domain/todoOcr'
import { privacyClass } from '../utils/format'

const PRIORITY_COLORS = {
  high: 'border-l-red-500 bg-red-950/10',
  medium: 'border-l-amber-500 bg-amber-950/10',
  low: 'border-l-blue-500 bg-blue-950/10',
}

const PRIORITY_TEXT_COLORS = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-blue-500',
}

const STATUS_LABELS = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
  archived: 'Archived',
}

export function TodosPage() {
  const { data, setData, privacy } = usePortfolio()
  const { success, error: showError } = useToasts()
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<TodoSortBy>('priority-desc')
  const [filterBy, setFilterBy] = useState<TodoFilterBy>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
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

  const currentList = selectedListId ? lists.find((l) => l.id === selectedListId) : null
  const listItems = selectedListId ? allItems.filter((i) => i.listId === selectedListId) : allItems

  const filteredItems = useMemo(() => {
    let items = filterTodoItems(listItems, filterBy)

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
  }, [listItems, filterBy, searchQuery, showCompleted, sortBy])

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
      setData((prev) => ({
        ...prev,
        todoItems: [...(prev.todoItems ?? []), item],
      }))
      success('Task created', item.title)
    }
    setShowTaskModal(false)
    setEditingTodo(undefined)
  }

  const handleDuplicateItem = (item: TodoItem) => {
    const duplicate = {
      ...item,
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: `${item.title} (copy)`,
      status: 'todo' as const,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setData((prev) => ({
      ...prev,
      todoItems: [...(prev.todoItems ?? []), duplicate],
    }))
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
    setData((prev) => ({
      ...prev,
      todoItems: [...(prev.todoItems ?? []), ...items],
    }))
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
      setData((prev) => ({
        ...prev,
        todoItems: [...(prev.todoItems ?? []), ...items],
      }))
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
        title="Todo Lists"
        description={
          lists.length === 0
            ? 'Organize and track your tasks across multiple lists'
            : `${stats.total} tasks · ${stats.highPriority} high priority · ${stats.overdue} overdue`
        }
        action={
          <div className="flex flex-wrap gap-2">
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
              className="btn-secondary btn-sm"
              disabled={lists.length === 0}
            >
              <ImagePlus size={16} /> From Screenshot
            </button>
            <button type="button" onClick={handleCreateItem} className="btn-primary btn-sm" disabled={lists.length === 0}>
              <Plus size={16} /> New Task
            </button>
            <button type="button" onClick={openCreateList} className="btn-secondary btn-sm">
              <Plus size={16} /> New List
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">To Do</p>
              <p className="text-2xl font-bold tabular-nums">{stats.todo}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">In Progress</p>
              <p className="text-2xl font-bold tabular-nums text-amber-500">{stats.inProgress}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Done</p>
              <p className="text-2xl font-bold tabular-nums text-green-500">{stats.done}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">High Priority</p>
              <p className="text-2xl font-bold tabular-nums text-red-500">{stats.highPriority}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Overdue</p>
              <p className="text-2xl font-bold tabular-nums text-red-500">{stats.overdue}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs text-text-subtle">Drag lists to reorder · icons show on each tab</p>
              <button type="button" className="btn-ghost btn-sm text-xs" onClick={() => void enableDesktopReminders()}>
                Enable desktop reminders
              </button>
            </div>
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2 scrollbar-hide items-center">
              <button
                type="button"
                onClick={() => setSelectedListId(null)}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded border ${
                  selectedListId === null
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface border-border hover:border-accent'
                }`}
              >
                All Lists ({allItems.length})
              </button>
            </div>
            <ReorderList
              items={lists}
              getId={(l) => String(l.id)}
              onReorder={handleReorderLists}
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center"
              itemClassName="shrink-0"
            >
              {(list) => {
                const count = allItems.filter((i) => i.listId === list.id).length
                const active = selectedListId === list.id
                return (
                  <div className="flex items-center gap-1">
                    <ReorderHandle />
                    <button
                      type="button"
                      onClick={() => setSelectedListId(list.id)}
                      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded border ${
                        active
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface border-border hover:border-accent'
                      }`}
                    >
                      <span className="mr-1.5" aria-hidden>
                        {listIconGlyph(list.icon)}
                      </span>
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                        style={{ backgroundColor: list.color || '#F7931A' }}
                      />
                      {list.name} ({count})
                    </button>
                    {active && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditList(list)}
                          className="btn-ghost btn-sm p-2"
                          title="Edit list"
                          aria-label="Edit list"
                        >
                          <Settings2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteList(list)}
                          className="btn-ghost btn-sm p-2 text-red-500"
                          title="Delete list"
                          aria-label="Delete list"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )
              }}
            </ReorderList>
          </div>

          {currentList?.description && (
            <p className="text-sm text-text-muted mb-4">{currentList.description}</p>
          )}

          <div className="surface p-4 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="lg:col-span-2">
                <label className="block text-xs text-text-subtle mb-1">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search todos..."
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Sort</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as TodoSortBy)}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="priority-desc">Priority (High first)</option>
                  <option value="due-date-asc">Due Date (Earliest)</option>
                  <option value="created-desc">Newest First</option>
                  <option value="title-asc">Title (A-Z)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Filter</label>
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as TodoFilterBy)}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  <option value="all">All Tasks</option>
                  <option value="high-priority">High Priority</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due Today</option>
                  <option value="this-week">This Week</option>
                  <option value="finance-related">Finance Related</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex items-center gap-2 text-sm px-3 py-2 bg-surface-hover border border-border rounded">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />
                Show Completed
              </label>
              <button type="button" onClick={handleImportCsv} className="btn-secondary btn-sm">
                <Upload size={14} /> Import CSV
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
              <div className="flex flex-wrap gap-2 items-center p-3 mt-3 bg-accent/10 rounded-lg border border-accent/20">
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
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`surface p-4 border-l-4 rounded-r-xl md:rounded-none shadow-sm md:shadow-none ${PRIORITY_COLORS[item.priority]} ${
                    selectedTodos.has(item.id) ? 'ring-2 ring-accent' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedTodos.has(item.id)}
                      onChange={() => handleToggleSelect(item.id)}
                      className="mt-1 w-4 h-4 flex-shrink-0"
                      aria-label={`Select ${item.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(item)}
                      className="mt-0.5 text-text-subtle hover:text-accent flex-shrink-0"
                      title={item.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                      aria-label={item.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {item.status === 'done' ? (
                        <CheckCircle2 size={18} className="text-green-500" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          className={`font-semibold ${item.status === 'done' ? 'line-through text-text-muted' : ''}`}
                        >
                          {item.title}
                        </h3>
                        {!selectedListId && (
                          <span className="text-xs text-text-subtle">
                            {lists.find((l) => l.id === item.listId)?.name ?? 'Unknown list'}
                          </span>
                        )}
                        {item.linkedJobId != null && (
                          <Link
                            to={`/jobs/${item.linkedJobId}`}
                            className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded"
                          >
                            Job linked
                          </Link>
                        )}
                        <span className={`text-xs font-bold uppercase ${PRIORITY_TEXT_COLORS[item.priority]}`}>
                          {item.priority}
                        </span>
                        {item.isFinanceRelated && (
                          <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">Finance</span>
                        )}
                        {isOverdue(item) && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-500 rounded inline-flex items-center gap-1">
                            <AlertCircle size={12} /> Overdue
                          </span>
                        )}
                      </div>
                      {item.description && <p className="text-sm text-text-muted mb-2">{item.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-text-subtle flex-wrap">
                        {item.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} /> Due: {item.dueDate}
                            {item.dueTime ? ` at ${item.dueTime}` : ''}
                          </span>
                        )}
                        <span className="uppercase">{STATUS_LABELS[item.status]}</span>
                        {item.estimatedMinutes ? <span>Est: {item.estimatedMinutes}m</span> : null}
                        {(item.tags ?? []).length > 0 && <span>Tags: {item.tags.join(', ')}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditItem(item)}
                        className="btn-ghost btn-sm text-xs p-2"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateItem(item)}
                        className="btn-ghost btn-sm text-xs p-2"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="btn-ghost btn-sm text-xs text-red-500 hover:text-red-400 p-2"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
