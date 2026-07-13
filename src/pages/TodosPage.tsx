import { useMemo, useState } from 'react'
import { Plus, Download, Upload, ListChecks, Clock, AlertCircle, Edit2, Copy, Archive } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { TodoModal } from '../components/TodoModal'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { TodoFilterBy, TodoItem, TodoSortBy } from '../domain/todo-types'
import {
  calculateTodoStats,
  createTodoList,
  exportTodosToCsv,
  filterTodoItems,
  isOverdue,
  parseCsvToTodoItems,
  sortTodoItems,
} from '../domain/todos'
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
  const [showModal, setShowModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>()
  const [selectedTodos, setSelectedTodos] = useState<Set<number>>(new Set())

  const lists = data.todoLists || []
  const allItems = data.todoItems || []

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
          i.tags.some((t) => t.toLowerCase().includes(query)),
      )
    }

    if (!showCompleted) {
      items = items.filter((i) => i.status !== 'done' && i.status !== 'archived')
    }

    return sortTodoItems(items, sortBy)
  }, [listItems, filterBy, searchQuery, showCompleted, sortBy])

  const stats = useMemo(() => calculateTodoStats(listItems), [listItems])

  const handleCreateList = () => {
    const name = window.prompt('List name:')
    if (!name) return

    const newList = createTodoList({ name })
    setData((prev) => ({
      ...prev,
      todoLists: [...(prev.todoLists || []), newList],
    }))
    success('List created', name)
  }

  const handleCreateItem = () => {
    if (!selectedListId && lists.length === 0) {
      showError('Create a list first', 'You need at least one list to add items')
      return
    }
    setEditingTodo(undefined)
    setShowModal(true)
  }

  const handleEditItem = (item: TodoItem) => {
    setEditingTodo(item)
    setShowModal(true)
  }

  const handleSaveItem = (item: TodoItem) => {
    if (editingTodo) {
      setData((prev) => ({
        ...prev,
        todoItems: prev.todoItems.map((i) => (i.id === item.id ? item : i)),
      }))
      success('Task updated')
    } else {
      setData((prev) => ({
        ...prev,
        todoItems: [...(prev.todoItems || []), item],
      }))
      success('Task created', item.title)
    }
    setShowModal(false)
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
      todoItems: [...(prev.todoItems || []), duplicate],
    }))
    success('Task duplicated')
  }

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedTodos)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTodos(newSelected)
  }

  const handleBulkComplete = () => {
    setData((prev) => ({
      ...prev,
      todoItems: prev.todoItems.map((i) =>
        selectedTodos.has(i.id)
          ? { ...i, status: 'done' as const, completedAt: new Date().toISOString() }
          : i,
      ),
    }))
    success('Tasks completed', `${selectedTodos.size} tasks`)
    setSelectedTodos(new Set())
  }

  const handleBulkArchive = () => {
    setData((prev) => ({
      ...prev,
      todoItems: prev.todoItems.map((i) =>
        selectedTodos.has(i.id) ? { ...i, status: 'archived' as const } : i,
      ),
    }))
    success('Tasks archived', `${selectedTodos.size} tasks`)
    setSelectedTodos(new Set())
  }

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedTodos.size} tasks?`)) return
    setData((prev) => ({
      ...prev,
      todoItems: prev.todoItems.filter((i) => !selectedTodos.has(i.id)),
    }))
    success('Tasks deleted', `${selectedTodos.size} tasks`)
    setSelectedTodos(new Set())
  }

  const handleDeleteItem = (id: number) => {
    if (!confirm('Delete this todo?')) return
    setData((prev) => ({
      ...prev,
      todoItems: prev.todoItems.filter((i) => i.id !== id),
    }))
    success('Todo deleted')
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
        todoItems: [...(prev.todoItems || []), ...items],
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

  if (lists.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Tasks" title="Todo Lists" description="Organize and track your tasks across multiple lists" />
        <EmptyState
          icon={<ListChecks size={64} />}
          title="No Lists Yet"
          description="Create your first todo list to start tracking tasks. Organize by project, category, or any way that works for you."
          action={{
            label: 'Create First List',
            onClick: handleCreateList,
          }}
        />
      </div>
    )
  }

  return (
    <div className={privacyClass(privacy)}>
      {showModal && (
        <TodoModal
          todo={editingTodo}
          listId={selectedListId || lists[0]?.id}
          onSave={handleSaveItem}
          onClose={() => {
            setShowModal(false)
            setEditingTodo(undefined)
          }}
        />
      )}
      <PageHeader
        eyebrow="Tasks"
        title="Todo Lists"
        description={`${stats.total} tasks · ${stats.highPriority} high priority · ${stats.overdue} overdue`}
        action={
          <div className="flex gap-2">
            <button type="button" onClick={handleCreateItem} className="btn-primary btn-sm">
              <Plus size={16} /> New Task
            </button>
            <button type="button" onClick={handleCreateList} className="btn-secondary btn-sm">
              New List
            </button>
          </div>
        }
      />

      {/* Stats Cards */}
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

      {/* Lists Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button
          type="button"
          onClick={() => setSelectedListId(null)}
          className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider whitespace-nowrap ${
            selectedListId === null
              ? 'bg-accent text-white'
              : 'bg-surface border border-border hover:border-accent'
          }`}
        >
          All Lists ({allItems.length})
        </button>
        {lists.map((list) => {
          const count = allItems.filter((i) => i.listId === list.id).length
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => setSelectedListId(list.id)}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider whitespace-nowrap ${
                selectedListId === list.id
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border hover:border-accent'
              }`}
            >
              {list.icon} {list.name} ({count})
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="surface p-4 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search todos..."
            className="flex-1 min-w-[200px] bg-transparent border border-border px-3 py-2 text-sm rounded-lg"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as TodoSortBy)} className="btn-ghost btn-sm">
            <option value="priority-desc">Priority (High first)</option>
            <option value="due-date-asc">Due Date (Earliest)</option>
            <option value="created-desc">Newest First</option>
            <option value="title-asc">Title (A-Z)</option>
          </select>
          <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as TodoFilterBy)} className="btn-ghost btn-sm">
            <option value="all">All Tasks</option>
            <option value="high-priority">High Priority</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="this-week">This Week</option>
            <option value="finance-related">Finance Related</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
            Show Completed
          </label>
          <button type="button" onClick={handleImportCsv} className="btn-secondary btn-sm">
            <Upload size={14} /> Import
          </button>
          <button type="button" onClick={handleExportCsv} className="btn-ghost btn-sm">
            <Download size={14} /> Export
          </button>
        </div>
        {selectedTodos.size > 0 && (
          <div className="flex gap-2 items-center p-3 bg-accent/10 rounded-lg border border-accent/20">
            <span className="text-sm font-semibold">{selectedTodos.size} selected</span>
            <button type="button" onClick={handleBulkComplete} className="btn-sm bg-green-500/20 text-green-500 hover:bg-green-500/30">
              Complete All
            </button>
            <button type="button" onClick={handleBulkArchive} className="btn-sm bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">
              <Archive size={14} /> Archive
            </button>
            <button type="button" onClick={handleBulkDelete} className="btn-sm bg-red-500/20 text-red-500 hover:bg-red-500/30">
              Delete All
            </button>
            <button type="button" onClick={() => setSelectedTodos(new Set())} className="btn-ghost btn-sm ml-auto">
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Todo Items */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={48} />}
          title="No Tasks Found"
          description="No tasks match your current filters. Try adjusting your search or filters."
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
                  className="mt-1 w-5 h-5 flex-shrink-0 rounded border-2 border-border cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`font-semibold ${item.status === 'done' ? 'line-through text-text-muted' : ''}`}>
                      {item.title}
                    </h3>
                    <span className={`text-xs font-bold uppercase ${PRIORITY_TEXT_COLORS[item.priority]}`}>
                      {item.priority}
                    </span>
                    {item.isFinanceRelated && (
                      <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">Finance</span>
                    )}
                    {isOverdue(item) && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-500 rounded flex items-center gap-1">
                        <AlertCircle size={12} /> Overdue
                      </span>
                    )}
                  </div>
                  {item.description && <p className="text-sm text-text-muted mb-2">{item.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-text-subtle flex-wrap">
                    {item.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> Due: {item.dueDate} {item.dueTime && `at ${item.dueTime}`}
                      </span>
                    )}
                    <span className="uppercase">{STATUS_LABELS[item.status]}</span>
                    {item.estimatedMinutes && (
                      <span>Est: {item.estimatedMinutes}m</span>
                    )}
                    {item.actualMinutes && (
                      <span>Actual: {item.actualMinutes}m</span>
                    )}
                    {item.tags.length > 0 && <span>Tags: {item.tags.join(', ')}</span>}
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
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
