import { useState } from 'react'
import { X, FileText } from 'lucide-react'
import { putDocumentBlob, deleteDocumentBlob } from '../storage/documentBlobStore'

export interface JobDocumentDraft {
  name: string
  url?: string
  notes?: string
  blobDocId?: number
  fileName?: string
  mimeType?: string
  size?: number
  hasBlob?: boolean
}

interface DocumentModalProps {
  document?: JobDocumentDraft
  onSave: (doc: JobDocumentDraft) => void
  onClose: () => void
}

export function DocumentModal({ document, onSave, onClose }: DocumentModalProps) {
  const [name, setName] = useState(document?.name || '')
  const [url, setUrl] = useState(document?.url || '')
  const [notes, setNotes] = useState(document?.notes || '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      let blobFields: Partial<JobDocumentDraft> = {}
      if (file) {
        const blobDocId = document?.blobDocId ?? Date.now() + Math.floor(Math.random() * 1000)
        // If replacing with a new id, delete the previous blob
        if (document?.blobDocId && document.blobDocId !== blobDocId) {
          try {
            await deleteDocumentBlob(document.blobDocId)
          } catch {
            /* ignore */
          }
        }
        await putDocumentBlob(blobDocId, file)
        blobFields = {
          blobDocId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          hasBlob: true,
        }
      } else if (document?.hasBlob) {
        blobFields = {
          blobDocId: document.blobDocId,
          fileName: document.fileName,
          mimeType: document.mimeType,
          size: document.size,
          hasBlob: true,
        }
      }

      onSave({
        name: name.trim(),
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
        ...blobFields,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-elevated border border-border rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-accent" />
            <h2 className="font-bold">{document ? 'Edit Document' : 'Add Document'}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-bg rounded-lg" aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-text-subtle mb-1">Name *</label>
            <input
              autoFocus
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CV v3, Cover Letter"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-subtle mb-1">Upload file (CV / PDF)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,image/*,.png,.jpg,.jpeg"
              className="w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !name.trim()) setName(f.name.replace(/\.[^.]+$/, ''))
              }}
            />
            {(file || document?.fileName) && (
              <p className="text-xs text-text-subtle mt-1">
                {file ? file.name : document?.fileName}
                {document?.hasBlob && !file ? ' (stored on this device)' : ''}
              </p>
            )}
            <p className="text-[11px] text-text-subtle mt-1">
              Files stay in IndexedDB on this device — not included in cloud sync yet.
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-subtle mb-1">URL</label>
            <input
              type="url"
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs text-text-subtle mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!name.trim() || busy}>
              {busy ? 'Saving…' : document ? 'Save Changes' : 'Add Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
