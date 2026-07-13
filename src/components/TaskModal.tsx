import { useState } from 'react'
import { X, CheckSquare } from 'lucide-react'

interface TaskModalProps {
  onSave: (task: { id: number; description: string; dueDate?: string; completed: boolean }) => void
  onClose: () => void
}

export function TaskModal({ onSave, onClose }: TaskModalProps) {
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    onSave({
      id: Date.now(),
      description: description.trim(),
      dueDate: dueDate || undefined,
      completed: false,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-elevated border border-border rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-accent" />
            <h2 className="font-bold">Add Task</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-bg rounded-lg" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
              Description *
            </label>
            <input
              autoFocus
              className="w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Prepare STAR stories"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
              Due date
            </label>
            <input type="date" className="w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!description.trim()}>
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
