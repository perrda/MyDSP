import { useState } from 'react'
import type {
  TodoItem,
  TodoList,
  TodoPriority,
  TodoRecurrence,
  TodoStatus,
  TodoSubtask,
} from '../domain/todo-types'
import { createTodoItem } from '../domain/todos'
import { Modal } from './ui/Modal'

interface TodoModalProps {
  todo?: TodoItem
  listId: number
  lists?: TodoList[]
  onSave: (todo: TodoItem) => void
  onClose: () => void
}

export function TodoModal({ todo, listId, lists = [], onSave, onClose }: TodoModalProps) {
  const [formData, setFormData] = useState({
    listId: todo?.listId || listId,
    title: todo?.title || '',
    description: todo?.description || '',
    priority: (todo?.priority || 'medium') as TodoPriority,
    status: (todo?.status || 'todo') as TodoStatus,
    dueDate: todo?.dueDate || '',
    dueTime: todo?.dueTime || '',
    reminderDate: todo?.reminderDate || '',
    reminderTime: todo?.reminderTime || '',
    recurrence: (todo?.recurrence || 'none') as TodoRecurrence,
    tags: todo?.tags?.join(', ') || '',
    isFinanceRelated: todo?.isFinanceRelated || false,
    estimatedMinutes: todo?.estimatedMinutes?.toString() || '',
    actualMinutes: todo?.actualMinutes?.toString() || '',
  })
  const [subtasks, setSubtasks] = useState<TodoSubtask[]>(() => todo?.subtasks ?? [])
  const [subtaskTitle, setSubtaskTitle] = useState('')

  const addSubtask = () => {
    const title = subtaskTitle.trim()
    if (!title) return
    setSubtasks((prev) => [
      ...prev,
      { id: Date.now() + Math.floor(Math.random() * 1000), title, done: false },
    ])
    setSubtaskTitle('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const estimatedMinutes = formData.estimatedMinutes ? Number(formData.estimatedMinutes) : undefined
    const actualMinutes = formData.actualMinutes ? Number(formData.actualMinutes) : undefined
    const completedAt =
      formData.status === 'done'
        ? todo?.completedAt || new Date().toISOString()
        : undefined

    const cleaned = {
      listId: formData.listId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      status: formData.status,
      dueDate: formData.dueDate || undefined,
      dueTime: formData.dueTime || undefined,
      reminderDate: formData.reminderDate || undefined,
      reminderTime: formData.reminderTime || undefined,
      recurrence: formData.recurrence,
      tags,
      isFinanceRelated: formData.isFinanceRelated,
      estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : undefined,
      actualMinutes: Number.isFinite(actualMinutes) ? actualMinutes : undefined,
      completedAt,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    }

    const todoItem = todo
      ? {
          ...todo,
          ...cleaned,
          updatedAt: new Date().toISOString(),
        }
      : createTodoItem(cleaned)

    onSave(todoItem as TodoItem)
  }

  return (
    <Modal open title={todo ? 'Edit Task' : 'New Task'} onClose={onClose} size="full">
        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h3 className="font-bold mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-text-subtle mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  placeholder="What needs to be done?"
                />
              </div>
              {lists.length > 0 && (
                <div>
                  <label className="block text-xs text-text-subtle mb-1">List</label>
                  <select
                    value={formData.listId}
                    onChange={(e) => setFormData({ ...formData, listId: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-text-subtle mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TodoPriority })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TodoStatus })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-subtle mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-[90px]"
                  placeholder="Add more details..."
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-3">Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Due Time</label>
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Reminder Date</label>
                <input
                  type="date"
                  value={formData.reminderDate}
                  onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Reminder Time</label>
                <input
                  type="time"
                  value={formData.reminderTime}
                  onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-subtle mb-1">Recurrence</label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as TodoRecurrence })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  data-testid="todo-recurrence-select"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold">Subtasks</h3>
              {subtasks.length > 0 ? (
                <span className="text-xs text-text-subtle">
                  {subtasks.filter((s) => s.done).length}/{subtasks.length} done
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 rounded border border-border bg-surface-hover px-3 py-2"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      onChange={() =>
                        setSubtasks((prev) =>
                          prev.map((s) =>
                            s.id === subtask.id ? { ...s, done: !s.done } : s,
                          ),
                        )
                      }
                    />
                    <span className={`truncate ${subtask.done ? 'line-through text-text-muted' : ''}`}>
                      {subtask.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-xs text-red-500"
                    onClick={() => setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id))}
                  >
                    Delete
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                  className="flex-1 px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  placeholder="Add a subtask"
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm min-h-11"
                  onClick={addSubtask}
                  disabled={!subtaskTitle.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-3">Tracking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Estimated Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={formData.estimatedMinutes}
                  onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  placeholder="60"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Actual Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={formData.actualMinutes}
                  onChange={(e) => setFormData({ ...formData, actualMinutes: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  placeholder="45"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-subtle mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
                  placeholder="work, urgent, personal (comma separated)"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface-hover border border-border rounded text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isFinanceRelated}
                    onChange={(e) => setFormData({ ...formData, isFinanceRelated: e.target.checked })}
                  />
                  <span>Finance related</span>
                </label>
              </div>
            </div>
          </section>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 min-h-11">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 min-h-11" disabled={!formData.title.trim()}>
              {todo ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
