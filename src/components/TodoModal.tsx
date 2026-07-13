import { useState } from 'react'
import { X, Calendar, Clock, Tag, DollarSign, AlertCircle } from 'lucide-react'
import type { TodoItem, TodoPriority, TodoStatus } from '../domain/todo-types'
import { createTodoItem } from '../domain/todos'

interface TodoModalProps {
  todo?: TodoItem
  listId: number
  onSave: (todo: TodoItem) => void
  onClose: () => void
}

export function TodoModal({ todo, listId, onSave, onClose }: TodoModalProps) {
  const [formData, setFormData] = useState({
    title: todo?.title || '',
    description: todo?.description || '',
    priority: todo?.priority || 'medium' as TodoPriority,
    status: todo?.status || 'todo' as TodoStatus,
    dueDate: todo?.dueDate || '',
    dueTime: todo?.dueTime || '',
    reminderDate: todo?.reminderDate || '',
    reminderTime: todo?.reminderTime || '',
    tags: todo?.tags?.join(', ') || '',
    isFinanceRelated: todo?.isFinanceRelated || false,
    estimatedMinutes: todo?.estimatedMinutes?.toString() || '',
    actualMinutes: todo?.actualMinutes?.toString() || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    const todoItem = todo
      ? {
          ...todo,
          ...formData,
          tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
          estimatedMinutes: formData.estimatedMinutes ? Number(formData.estimatedMinutes) : undefined,
          actualMinutes: formData.actualMinutes ? Number(formData.actualMinutes) : undefined,
          updatedAt: new Date().toISOString(),
        }
      : createTodoItem({
          listId,
          ...formData,
          tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
          estimatedMinutes: formData.estimatedMinutes ? Number(formData.estimatedMinutes) : undefined,
          actualMinutes: formData.actualMinutes ? Number(formData.actualMinutes) : undefined,
        })

    onSave(todoItem)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between rounded-t-xl md:rounded-t-none">
          <h2 className="text-xl font-bold">{todo ? 'Edit Task' : 'New Task'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2">Task Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[100px]"
              placeholder="Add more details..."
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TodoPriority })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TodoStatus })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Due Date & Time */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Calendar size={16} /> Due Date & Time
            </label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
              <input
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Reminder Date & Time */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertCircle size={16} /> Reminder
            </label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={formData.reminderDate}
                onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
              <input
                type="time"
                value={formData.reminderTime}
                onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Time Estimates */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock size={16} /> Time Tracking
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Estimated (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.estimatedMinutes}
                  onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                  placeholder="60"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Actual (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.actualMinutes}
                  onChange={(e) => setFormData({ ...formData, actualMinutes: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
                  placeholder="45"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Tag size={16} /> Tags
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
              placeholder="work, urgent, personal (comma separated)"
            />
          </div>

          {/* Finance Related */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer p-4 bg-surface-hover border border-border rounded-lg hover:border-accent transition-colors">
              <input
                type="checkbox"
                checked={formData.isFinanceRelated}
                onChange={(e) => setFormData({ ...formData, isFinanceRelated: e.target.checked })}
                className="w-5 h-5"
              />
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-accent" />
                <span className="font-semibold">Finance Related</span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              {todo ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
