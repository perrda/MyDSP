import { useMemo, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
import type { DocumentNote } from '../domain/types'
import {
  deleteDocumentBlob,
  downloadBlob,
  getDocumentBlob,
  putDocumentBlob,
} from '../storage/documentBlobStore'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatDate } from '../utils/format'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const LINKED_KINDS: { value: DocumentNote['linkedKind'] | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'card', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'equity', label: 'Equity' },
  { value: 'trip', label: 'Trip' },
  { value: 'goal', label: 'Goal' },
  { value: 'job', label: 'Job application' },
]

const empty = { name: '', note: '', linkedKind: '' as DocumentNote['linkedKind'] | '', linkedId: '' }

export function DocumentsPage() {
  const { data, setData } = usePortfolio()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentNote | null>(null)
  const [form, setForm] = useState(empty)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const documents = useMemo(() => sortBySortOrder(data.documents), [data.documents])

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setPendingFile(null)
    setOpen(true)
  }

  const openEdit = (d: DocumentNote) => {
    setEditing(d)
    setForm({
      name: d.name,
      note: d.note ?? '',
      linkedKind: d.linkedKind ?? '',
      linkedId: d.linkedId != null ? String(d.linkedId) : '',
    })
    setPendingFile(null)
    setOpen(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      const id = editing?.id ?? nextId(data.documents)
      let fileName = editing?.fileName
      let mimeType = editing?.mimeType
      let size = editing?.size
      let hasBlob = editing?.hasBlob

      if (pendingFile) {
        await putDocumentBlob(id, pendingFile)
        fileName = pendingFile.name
        mimeType = pendingFile.type || undefined
        size = pendingFile.size
        hasBlob = true
      }

      const doc: DocumentNote = {
        id,
        name: form.name.trim() || 'Document',
        note: form.note.trim() || undefined,
        createdAt: editing?.createdAt ?? new Date().toISOString(),
        sortOrder: editing?.sortOrder,
        fileName,
        mimeType,
        size,
        hasBlob,
        linkedKind: form.linkedKind || undefined,
        linkedId: form.linkedKind && form.linkedId ? Number(form.linkedId) : undefined,
      }

      setData((prev) => ({
        ...prev,
        documents: editing
          ? prev.documents.map((d) => (d.id === editing.id ? doc : d))
          : applySortOrder([...prev.documents, doc]),
      }))
      setOpen(false)
      setPendingFile(null)
    } finally {
      setBusy(false)
    }
  }

  const onDownload = async (d: DocumentNote) => {
    const blob = await getDocumentBlob(d.id)
    if (!blob) return
    downloadBlob(blob, d.fileName || d.name)
  }

  const onDelete = async (id: number) => {
    await deleteDocumentBlob(id)
    setData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
    }))
  }

  return (
    <div>
      <PageHeader
        eyebrow="Vault"
        title="Documents"
        description="Lightweight file vault — upload statements and references, link to accounts, and reorder to taste."
        action={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            Add document
          </button>
        }
      />

      {documents.length === 0 ? (
        <div className="surface p-12 text-center text-text-subtle">
          No documents yet — add a name, optional note, and upload a file.
        </div>
      ) : (
        <ReorderList
          items={documents}
          getId={(d) => String(d.id)}
          onReorder={(next) => setData((prev) => ({ ...prev, documents: applySortOrder(next) }))}
          className="grid grid-cols-1 md:grid-cols-2 gap-px"
        >
          {(d) => (
            <div className="surface p-6">
              <div className="flex items-start gap-2 mb-2">
                <ReorderHandle label={`Reorder ${d.name}`} />
                <div className="flex-1 min-w-0 flex justify-between gap-3">
                  <h3 className="font-bold tracking-tight truncate">{d.name}</h3>
                  <span className="text-[10px] text-text-subtle tabular-nums shrink-0">
                    {formatDate(d.createdAt)}
                  </span>
                </div>
              </div>
              {d.note ? (
                <p className="text-sm text-text-muted font-light mb-3 whitespace-pre-wrap">{d.note}</p>
              ) : (
                <p className="text-sm text-text-subtle mb-3">No note</p>
              )}
              {d.hasBlob && (
                <p className="text-[11px] text-text-subtle mb-3 truncate">
                  {d.fileName} {d.size ? `· ${formatSize(d.size)}` : ''}
                </p>
              )}
              {d.linkedKind && (
                <span className="inline-block bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 mb-3">
                  {d.linkedKind}
                  {d.linkedId != null ? ` #${d.linkedId}` : ''}
                </span>
              )}
              <div className="flex gap-2 flex-wrap">
                {d.hasBlob && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm inline-flex items-center gap-1.5"
                    onClick={() => onDownload(d)}
                  >
                    <Download size={14} strokeWidth={1.5} /> Download
                  </button>
                )}
                <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(d)}>
                  Edit
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setDeleteId(d.id)}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </ReorderList>
      )}

      <Modal
        open={open}
        size="full"
        title={editing ? 'Edit document' : 'Add document'}
        onClose={() => setOpen(false)}
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Field label="Name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Note">
            <textarea
              rows={4}
              className="w-full"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
          <Field label="File" hint={editing?.hasBlob ? `Current: ${editing.fileName ?? 'attachment'}` : undefined}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-secondary btn-sm inline-flex items-center gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} strokeWidth={1.5} /> Choose file
              </button>
              <span className="text-sm text-text-subtle truncate">
                {pendingFile ? pendingFile.name : 'No new file selected'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Linked to">
              <select
                value={form.linkedKind}
                onChange={(e) =>
                  setForm({ ...form, linkedKind: e.target.value as DocumentNote['linkedKind'] | '' })
                }
              >
                {LINKED_KINDS.map((k) => (
                  <option key={k.value || 'none'} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Linked ID">
              <input
                type="text"
                inputMode="numeric"
                disabled={!form.linkedKind}
                value={form.linkedId}
                onChange={(e) => setForm({ ...form, linkedId: e.target.value })}
                placeholder="e.g. 3"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete document"
        body="Remove this document note and its attached file (if any)?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          void onDelete(deleteId)
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary documents actions">
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          Add document
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
