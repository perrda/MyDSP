import { useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import type { JobNote } from '../domain/job-types'

interface NoteModalProps {
  note?: JobNote
  onSave: (note: JobNote) => void
  onClose: () => void
}

export function NoteModal({ note, onSave, onClose }: NoteModalProps) {
  const [formData, setFormData] = useState({
    content: note?.content || '',
    type: note?.type || 'general' as JobNote['type'],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.content.trim()) return

    const noteData: JobNote = note
      ? {
          ...note,
          ...formData,
          updatedAt: new Date().toISOString(),
        }
      : {
          id: Date.now(),
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

    onSave(noteData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="surface rounded-xl max-w-2xl w-full">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between rounded-t-xl md:rounded-t-none">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare size={20} />
            {note ? 'Edit Note' : 'Add Note'}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Type */}
          <div>
            <label className="block text-sm font-semibold mb-2">Note Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as JobNote['type'] })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none"
            >
              <option value="general">General</option>
              <option value="research">Research</option>
              <option value="follow-up">Follow-up</option>
              <option value="feedback">Feedback</option>
              <option value="decision">Decision</option>
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-semibold mb-2">Note *</label>
            <textarea
              required
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-base focus:border-accent focus:outline-none min-h-[200px]"
              placeholder="Write your note here..."
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              {note ? 'Save Changes' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
