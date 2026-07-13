import { useState } from 'react'
import { X, CheckSquare } from 'lucide-react'

export interface JobTaskDraft {
  id: number
  description: string
  dueDate?: string
  completed: boolean
  completedAt?: string
}

interface TaskModalProps {
  task?: JobTaskDraft
  onSave: (task: JobTaskDraft) => void
  onClose: () => void
}

export function TaskModal({ task, onSave, onClose }: TaskModalProps) {
  const [description, setDescription] = useState(task?.description || '')
  const [dueDate, setDueDate] = useState(task?.dueDate || '')
  const [completed, setCompleted] = useState(task?.completed || false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    onSave({
      id: task?.id ?? Date.now(),
      description: description.trim(),
      dueDate: dueDate || undefined,
      completed,
      completedAt: completed ? task?.completedAt || new Date().toISOString() : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-elevated border border-border rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-accent" />
            <h2 className="font-bold">{task ? 'Edit Task' : 'Add Task'}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-bg rounded-lg" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-text-subtle mb-1">Description *</label>
            <input
              autoFocus
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Prepare STAR stories"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-subtle mb-1">Due date</label>
            <input
              type="date"
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {task && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
              Completed
            </label>
          )}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!description.trim()}>
              {task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
