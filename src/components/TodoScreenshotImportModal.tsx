import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import type { TodoItem, TodoList, TodoPriority } from '../domain/todo-types'
import {
  candidatesToTodoItems,
  parseOcrTextToCandidates,
  type ParsedTodoCandidate,
} from '../domain/todoOcr'

type DraftRow = ParsedTodoCandidate & { include: boolean }

interface TodoScreenshotImportModalProps {
  lists: TodoList[]
  defaultListId: number
  onImport: (items: TodoItem[]) => void
  onClose: () => void
}

async function runOcr(file: File, onProgress: (pct: number, status: string) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(Math.round(m.progress * 100), 'Reading text…')
      } else if (m.status) {
        onProgress(0, m.status.replace(/_/g, ' '))
      }
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text || ''
  } finally {
    await worker.terminate()
  }
}

export function TodoScreenshotImportModal({
  lists,
  defaultListId,
  onImport,
  onClose,
}: TodoScreenshotImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [listId, setListId] = useState(defaultListId)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [step, setStep] = useState<'upload' | 'review'>('upload')

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image screenshot (PNG, JPG, HEIC/WebP if supported).')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image is too large (max 12MB). Try a cropped screenshot.')
      return
    }

    setError(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setBusy(true)
    setProgress(0)
    setStatus('Starting OCR…')
    setRows([])
    setRawText('')

    try {
      const text = await runOcr(file, (pct, st) => {
        setProgress(pct)
        setStatus(st)
      })
      setRawText(text)
      const parsed = parseOcrTextToCandidates(text)
      if (parsed.length === 0) {
        setError(
          'No task lines detected. Try a clearer crop, higher contrast, or paste OCR text manually below after retry.',
        )
        setRows([])
        setStep('review')
      } else {
        setRows(parsed.map((c) => ({ ...c, include: true })))
        setStep('review')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed. Try another image.')
    } finally {
      setBusy(false)
      setStatus('')
    }
  }, [])

  const updateRow = (idx: number, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const addBlankRow = () => {
    setRows((prev) => [
      ...prev,
      { title: '', priority: 'medium', completed: false, raw: '', include: true },
    ])
  }

  const reparseFromRaw = () => {
    const parsed = parseOcrTextToCandidates(rawText)
    setRows(parsed.map((c) => ({ ...c, include: true })))
  }

  const selected = rows.filter((r) => r.include && r.title.trim())

  const handleImport = () => {
    if (!listId || selected.length === 0) return
    const items = candidatesToTodoItems(selected, listId)
    onImport(items)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="surface rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Import from Screenshot</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Close" disabled={busy}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="font-bold mb-3">Target List</h3>
            <label className="block text-xs text-text-subtle mb-1">Add imported tasks to</label>
            <select
              value={listId}
              onChange={(e) => setListId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
              disabled={busy}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="font-bold mb-3">Screenshot</h3>
            <p className="text-sm text-text-muted mb-3">
              Upload a screenshot from another todo app. Text is read on-device (OCR) — nothing is uploaded to a
              server. Review the detected tasks before importing.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {busy ? status || 'Reading…' : 'Choose screenshot'}
            </button>
            {busy && (
              <div className="mt-3">
                <div className="h-1.5 bg-surface-hover rounded overflow-hidden">
                  <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(progress, 5)}%` }} />
                </div>
                <p className="text-xs text-text-subtle mt-1">{progress}%</p>
              </div>
            )}
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Screenshot preview"
                className="mt-4 max-h-48 rounded border border-border object-contain bg-black/20 w-full"
              />
            )}
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
          </section>

          {step === 'review' && (
            <>
              <section>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-bold">Detected Tasks ({selected.length} selected)</h3>
                  <button type="button" className="btn-ghost btn-sm" onClick={addBlankRow}>
                    Add row
                  </button>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-text-muted">No rows yet — edit raw OCR text below and re-parse.</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-2 items-center p-3 bg-surface-hover border border-border rounded"
                      >
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => updateRow(idx, { include: e.target.checked })}
                          aria-label="Include task"
                        />
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => updateRow(idx, { title: e.target.value })}
                          className="w-full px-3 py-2 bg-bg border border-border rounded text-sm"
                          placeholder="Task title"
                        />
                        <select
                          value={row.priority}
                          onChange={(e) => updateRow(idx, { priority: e.target.value as TodoPriority })}
                          className="px-2 py-2 bg-bg border border-border rounded text-sm"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-red-500 p-2"
                          onClick={() => removeRow(idx)}
                          aria-label="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                        <label className="md:col-span-4 flex items-center gap-2 text-xs text-text-subtle">
                          <input
                            type="checkbox"
                            checked={row.completed}
                            onChange={(e) => updateRow(idx, { completed: e.target.checked })}
                          />
                          Mark as already done
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="font-bold mb-3">Raw OCR Text</h3>
                <label className="block text-xs text-text-subtle mb-1">Edit if needed, then re-parse</label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm min-h-[100px] font-mono"
                />
                <button type="button" className="btn-ghost btn-sm mt-2" onClick={reparseFromRaw}>
                  Re-parse text
                </button>
              </section>
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy || selected.length === 0 || !listId}
              onClick={handleImport}
            >
              Import {selected.length > 0 ? `${selected.length} tasks` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
