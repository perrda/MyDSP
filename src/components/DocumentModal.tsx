import { useState } from 'react'
import { X, FileText } from 'lucide-react'

interface DocumentModalProps {
  onSave: (doc: { name: string; url?: string; notes?: string }) => void
  onClose: () => void
}

export function DocumentModal({ onSave, onClose }: DocumentModalProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-elevated border border-border rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-accent" />
            <h2 className="font-bold">Add Document</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-bg rounded-lg" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
              Name *
            </label>
            <input
              autoFocus
              className="w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CV v3, Cover Letter"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
              URL
            </label>
            <input
              type="url"
              className="w-full"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
              Notes
            </label>
            <textarea
              className="w-full min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!name.trim()}>
              Add Document
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
