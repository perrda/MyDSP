import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, Target } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
import {
  estimateMonthlySurplus,
  formatGoalProjectionLine,
  projectGoalDate,
} from '../domain/goalProjectedDate'
import { nextCommentaryId, ragClass, ragLabel } from '../domain/liabilityHelpers'
import type { Goal, GoalMetric, GoalType, ProgressCommentary, RagStatus } from '../domain/types'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatDate, formatDateTime, formatGBP, privacyClass } from '../utils/format'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const empty = {
  name: '',
  type: 'networth' as GoalType,
  target: '',
  metric: 'networth' as GoalMetric,
  deadline: '',
  ragStatus: '' as '' | RagStatus,
}

export function GoalsPage() {
  const { data, setData, goalCurrent, goalProgress, privacy } = usePortfolio()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [noteGoalId, setNoteGoalId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [editingNote, setEditingNote] = useState<ProgressCommentary | null>(null)
  const [sorting, setSorting] = useState(false)

  const goals = useMemo(() => sortBySortOrder(data.goals), [data.goals])
  const noteGoal = goals.find((g) => g.id === noteGoalId) ?? null
  const monthlySurplus = useMemo(() => estimateMonthlySurplus(data), [data])

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const openEdit = (g: Goal) => {
    setEditing(g)
    setForm({
      name: g.name,
      type: g.type,
      target: String(g.target),
      metric: g.metric,
      deadline: g.deadline.slice(0, 10),
      ragStatus: g.ragStatus ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const goal: Goal = {
      id: editing?.id ?? nextId(data.goals),
      name: form.name.trim() || 'Goal',
      type: form.type,
      target: parseNum(form.target),
      metric: form.metric,
      deadline: form.deadline || new Date().toISOString().slice(0, 10),
      created: editing?.created || new Date().toISOString().slice(0, 10),
      startVal: editing?.startVal ?? goalCurrent(form.metric),
      ragStatus: form.ragStatus || undefined,
      commentaries: editing?.commentaries,
      sortOrder: editing?.sortOrder,
      notes: editing?.notes,
    }
    setData((prev) => ({
      ...prev,
      goals: editing
        ? prev.goals.map((g) => (g.id === editing.id ? goal : g))
        : applySortOrder([...prev.goals, goal]),
    }))
    setOpen(false)
  }

  const saveNote = () => {
    if (!noteGoal || !noteText.trim()) return
    const now = new Date().toISOString()
    const list = noteGoal.commentaries ?? []
    const nextList = editingNote
      ? list.map((c) =>
          c.id === editingNote.id ? { ...c, text: noteText.trim(), updatedAt: now } : c,
        )
      : [...list, { id: nextCommentaryId(list), text: noteText.trim(), createdAt: now, updatedAt: now }]
    setData((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === noteGoal.id ? { ...g, commentaries: nextList } : g,
      ),
    }))
    setNoteText('')
    setEditingNote(null)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Targets"
        title="Financial goals"
        description={
          sorting
            ? 'Drag ⋮⋮ to reorder — order is saved with this portfolio.'
            : 'Track net-worth, debt, and investment targets with RAG status.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/liabilities" className="btn-ghost btn-sm">
              Debt pay-down
            </Link>
            <Link to="/fire" className="btn-ghost btn-sm">
              FIRE
            </Link>
            <button
              type="button"
              className={`btn-secondary btn-sm inline-flex items-center gap-2 ${sorting ? 'border-accent text-accent' : ''}`}
              aria-pressed={sorting}
              disabled={goals.length === 0}
              onClick={() => setSorting((v) => !v)}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sorting ? 'Done' : 'Sort'}
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              Add goal
            </button>
          </div>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={40} strokeWidth={1.25} />}
          title="No goals yet"
          description="Set a net-worth, debt, or investment target and track progress with RAG status."
          action={{ label: 'Add goal', onClick: openCreate }}
        />
      ) : (
        <ReorderList
          items={goals}
          getId={(g) => String(g.id)}
          onReorder={(next) => setData((prev) => ({ ...prev, goals: applySortOrder(next) }))}
          className="flex flex-col gap-px goals-list-density"
        >
          {(g) => {
            const current = goalCurrent(g.metric)
            const progress = goalProgress(g)
            const notes = g.commentaries?.length ?? 0
            const projection =
              monthlySurplus != null ? projectGoalDate(g, current, monthlySurplus) : null
            return (
              <div className="surface p-5 sm:p-8 goals-density-card">
                <div className="flex gap-3 mb-4">
                  {sorting ? <ReorderHandle label={`Reorder ${g.name}`} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={ragClass(g.ragStatus)}>{ragLabel(g.ragStatus)}</span>
                      <span className="eyebrow !mb-0">{g.type}</span>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">{g.name}</h3>
                    <p className="mt-2 text-sm text-text-muted font-light">
                      Deadline {formatDate(g.deadline)} · {g.metric}
                      {notes > 0 ? ` · ${notes} notes` : ''}
                    </p>
                    {projection ? (
                      <p className={`goal-projection-line mt-1 text-xs text-accent font-medium ${privacyClass(privacy)}`}>
                        {formatGoalProjectionLine(projection, formatDate)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="label-uppercase mb-1">Progress</p>
                    <p className="text-2xl font-bold tabular-nums text-accent">{progress.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="progress-track mb-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                <div className={`flex justify-between text-sm mb-4 ${privacyClass(privacy)}`}>
                  <span className="text-text-muted">Current {formatGBP(current)}</span>
                  <span className="text-text-subtle">Target {formatGBP(g.target)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['red', 'amber', 'green'] as RagStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rag-chip ${g.ragStatus === s ? 'is-active' : ''} rag-${s}`}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          goals: prev.goals.map((x) =>
                            x.id === g.id
                              ? { ...x, ragStatus: x.ragStatus === s ? undefined : s }
                              : x,
                          ),
                        }))
                      }
                    >
                      {s === 'red' ? 'R' : s === 'amber' ? 'A' : 'G'}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary btn-sm ml-auto"
                    onClick={() => {
                      setNoteGoalId(g.id)
                      setNoteText('')
                      setEditingNote(null)
                    }}
                  >
                    Commentary
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(g)}>
                    Edit
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setDeleteId(g.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          }}
        </ReorderList>
      )}

      <Modal open={open} size="full" title={editing ? 'Edit goal' : 'Add goal'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as GoalType })}
              >
                <option value="networth">Net worth</option>
                <option value="debt">Debt</option>
                <option value="investment">Investment</option>
              </select>
            </Field>
            <Field label="Metric">
              <select
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value as GoalMetric })}
              >
                <option value="networth">Net worth</option>
                <option value="debt">Total debt</option>
                <option value="cc">Credit cards</option>
                <option value="equity">Equities</option>
                <option value="crypto">Crypto</option>
              </select>
            </Field>
            <Field label="Target (GBP)">
              <input
                inputMode="decimal"
                required
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </Field>
          </div>
          <Field label="RAG">
            <select
              value={form.ragStatus}
              onChange={(e) => setForm({ ...form, ragStatus: e.target.value as '' | RagStatus })}
            >
              <option value="">Unset</option>
              <option value="red">Red</option>
              <option value="amber">Amber</option>
              <option value="green">Green</option>
            </select>
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={noteGoal != null}
        size="full"
        title={noteGoal ? `Commentary · ${noteGoal.name}` : 'Commentary'}
        onClose={() => setNoteGoalId(null)}
      >
        {noteGoal && (
          <div className="space-y-4">
            <textarea
              className="w-full min-h-[6rem]"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Milestone update, blocker, next action…"
            />
            <div className="flex gap-2">
              <button type="button" className="btn-primary btn-sm" onClick={saveNote} disabled={!noteText.trim()}>
                {editingNote ? 'Update' : 'Add note'}
              </button>
              {editingNote && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setEditingNote(null)
                    setNoteText('')
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="space-y-px">
              {[...(noteGoal.commentaries ?? [])]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((c) => (
                  <article key={c.id} className="surface-nested p-4">
                    <div className="flex justify-between gap-2 mb-2">
                      <p className="text-[11px] text-text-subtle">{formatDateTime(c.createdAt)}</p>
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
                          onClick={() =>
                            setData((prev) => ({
                              ...prev,
                              goals: prev.goals.map((g) =>
                                g.id === noteGoal.id
                                  ? {
                                      ...g,
                                      commentaries: (g.commentaries ?? []).filter((x) => x.id !== c.id),
                                    }
                                  : g,
                              ),
                            }))
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.text}</p>
                  </article>
                ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete goal"
        body="Remove this goal permanently?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId == null) return
          setData((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== deleteId) }))
        }}
      />
    </div>
  )
}
