import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { JobNote } from '../domain/job-types'
import { Modal } from './ui/Modal'

interface NoteModalProps {
  note?: JobNote
  onSave: (note: JobNote) => void
  onClose: () => void
}

export function NoteModal({ note, onSave, onClose }: NoteModalProps) {
  const [formData, setFormData] = useState({
    content: note?.content || '',
    type: note?.type || ('general' as JobNote['type']),
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
    <Modal open title={note ? 'Edit Note' : 'Add Note'} onClose={onClose} size="sheet">
      <div className="mb-4 flex items-center gap-2 text-text-muted">
        <MessageSquare size={20} aria-hidden />
        <span className="text-sm">Research, feedback, or decision notes</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs text-text-subtle mb-1">Note Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as JobNote['type'] })}
            className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-11"
          >
            <option value="general">General</option>
            <option value="research">Research</option>
            <option value="follow-up">Follow-up</option>
            <option value="feedback">Feedback</option>
            <option value="decision">Decision</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-subtle mb-1">Note *</label>
          <textarea
            required
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded text-base min-h-[200px]"
            placeholder="Write your note here..."
            autoFocus
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 min-h-11">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 min-h-11">
            {note ? 'Save Changes' : 'Add Note'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
