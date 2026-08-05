import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { Modal } from './ui/Modal'

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
    <Modal open title={task ? 'Edit Task' : 'Add Task'} onClose={onClose} size="sheet">
      <div className="mb-4 flex items-center gap-2 text-text-muted">
        <CheckSquare size={18} className="text-accent" aria-hidden />
        <span className="text-sm">Job application checklist item</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-subtle mb-1">Description *</label>
          <input
            autoFocus
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm min-h-11"
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
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm min-h-11"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        {task && (
          <label className="flex items-center gap-2 text-sm min-h-11">
            <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
            Completed
          </label>
        )}
        <div className="flex gap-3 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 min-h-11">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 min-h-11" disabled={!description.trim()}>
            {task ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
