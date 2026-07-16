/** Shared date-stamped progress commentary CRUD (liabilities / recurring / holdings). */

import { useMemo, useState } from 'react'
import { ConfirmDialog } from './ui/Modal'
import type { ProgressCommentary } from '../domain/types'
import { nextCommentaryId } from '../domain/liabilityHelpers'
import { formatDateTime } from '../utils/format'

type Props = {
  commentaries: ProgressCommentary[] | undefined
  onChange: (next: ProgressCommentary[] | undefined) => void
  /** Eyebrow above the heading */
  eyebrow?: string
  title?: string
  description?: string
  placeholder?: string
  emptyLabel?: string
  className?: string
}

export function ProgressCommentaryPanel({
  commentaries,
  onChange,
  eyebrow = 'Progress',
  title = 'Commentary',
  description = 'Each entry is date-stamped — newest first.',
  placeholder = 'Add a note…',
  emptyLabel = 'No commentary yet — add your first note above.',
  className = '',
}: Props) {
  const [noteText, setNoteText] = useState('')
  const [editingNote, setEditingNote] = useState<ProgressCommentary | null>(null)
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null)

  const sorted = useMemo(
    () =>
      [...(commentaries ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [commentaries],
  )

  const saveNote = () => {
    const text = noteText.trim()
    if (!text) return
    const now = new Date().toISOString()
    const list = commentaries ?? []
    if (editingNote) {
      const next = list.map((c) =>
        c.id === editingNote.id ? { ...c, text, updatedAt: now } : c,
      )
      onChange(next.length ? next : undefined)
    } else {
      const next = [
        ...list,
        {
          id: nextCommentaryId(list),
          text,
          createdAt: now,
          updatedAt: now,
        },
      ]
      onChange(next)
    }
    setEditingNote(null)
    setNoteText('')
  }

  return (
    <section
      className={`surface p-5 sm:p-8 border-l-2 border-l-accent ${className}`.trim()}
      aria-label={title}
    >
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h3 className="text-lg font-bold tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-text-muted font-light mb-5">{description}</p>

      <div className="flex flex-col gap-3 mb-6">
        <label className="sr-only" htmlFor="progress-commentary-input">
          {editingNote ? 'Edit commentary' : 'New commentary'}
        </label>
        <textarea
          id="progress-commentary-input"
          className="w-full min-h-[7rem]"
          placeholder={placeholder}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={saveNote}
            disabled={!noteText.trim()}
          >
            {editingNote ? 'Update note' : 'Add commentary'}
          </button>
          {editingNote ? (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setEditingNote(null)
                setNoteText('')
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-px">
        {sorted.map((c) => (
          <article key={c.id} className="surface-nested p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <p className="text-[11px] text-text-subtle tabular-nums">
                {formatDateTime(c.createdAt)}
                {c.updatedAt !== c.createdAt
                  ? ` · edited ${formatDateTime(c.updatedAt)}`
                  : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setEditingNote(c)
                    setNoteText(c.text)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setDeleteNoteId(c.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.text}</p>
          </article>
        ))}
        {sorted.length === 0 ? (
          <p className="text-sm text-text-subtle py-2">{emptyLabel}</p>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteNoteId !== null}
        title="Delete commentary"
        body="Remove this note? This cannot be undone."
        confirmLabel="Delete"
        onClose={() => setDeleteNoteId(null)}
        onConfirm={() => {
          if (deleteNoteId === null) return
          const next = (commentaries ?? []).filter((c) => c.id !== deleteNoteId)
          onChange(next.length ? next : undefined)
          if (editingNote?.id === deleteNoteId) {
            setEditingNote(null)
            setNoteText('')
          }
        }}
      />
    </section>
  )
}
