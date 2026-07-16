import { useMemo, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { ProgressCommentaryPanel } from '../components/ProgressCommentaryPanel'
import { usePortfolio } from '../context/PortfolioContext'
import { markRecurringPaid } from '../domain/recurringActions'
import {
  monthlyRecurringTotal,
  RECURRING_SORT_OPTIONS,
  sortRecurringTransactions,
  type RecurringSort,
} from '../domain/recurringHelpers'
import type { ProgressCommentary, RecurringTransaction } from '../domain/types'
import {
  formatDate,
  formatDateTime,
  formatGBP,
  formatGBPPrecise,
  privacyClass,
} from '../utils/format'

const FREQ = ['weekly', 'monthly', 'yearly'] as const
const CATS = [
  'food',
  'transport',
  'shopping',
  'entertainment',
  'bills',
  'health',
  'travel',
  'subscriptions',
  'cash',
  'other',
]

const SORT_KEY = 'mydsp_recurring_sort_v1'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

function loadSort(): RecurringSort {
  try {
    const raw = localStorage.getItem(SORT_KEY)
    if (RECURRING_SORT_OPTIONS.some((o) => o.id === raw)) return raw as RecurringSort
  } catch {
    /* ignore */
  }
  return 'due-asc'
}

const empty = {
  name: '',
  amount: '',
  frequency: 'monthly' as RecurringTransaction['frequency'],
  category: 'subscriptions',
  nextDue: new Date().toISOString().slice(0, 10),
}

export function RecurringPage() {
  const { data, setData, privacy } = usePortfolio()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [form, setForm] = useState(empty)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [sort, setSort] = useState<RecurringSort>(loadSort)
  const [commentsFor, setCommentsFor] = useState<RecurringTransaction | null>(null)

  const items = useMemo(
    () => sortRecurringTransactions(data.recurringTransactions ?? [], sort),
    [data.recurringTransactions, sort],
  )

  const monthlyTotal = useMemo(
    () => monthlyRecurringTotal(data.recurringTransactions ?? []),
    [data.recurringTransactions],
  )

  const monthlyCount = useMemo(
    () => (data.recurringTransactions ?? []).filter((r) => r.frequency === 'monthly').length,
    [data.recurringTransactions],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setFormError(null)
    setOpen(true)
  }

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r)
    setForm({
      name: r.name,
      amount: String(r.amount),
      frequency: r.frequency,
      category: r.category,
      nextDue: r.nextDue.slice(0, 10),
    })
    setFormError(null)
    setOpen(true)
  }

  const save = () => {
    const amount = parseNum(form.amount)
    if (!(amount > 0)) {
      setFormError('Enter a positive amount.')
      return
    }
    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }
    const entry: RecurringTransaction = {
      id: editing?.id ?? nextId(data.recurringTransactions),
      name: form.name.trim(),
      amount,
      frequency: form.frequency,
      category: form.category,
      nextDue: form.nextDue,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      lastPaidAt: editing?.lastPaidAt,
      commentaries: editing?.commentaries,
    }
    setData((prev) => ({
      ...prev,
      recurringTransactions: editing
        ? prev.recurringTransactions.map((r) => (r.id === editing.id ? entry : r))
        : [...prev.recurringTransactions, entry],
    }))
    setOpen(false)
  }

  const markPaid = (r: RecurringTransaction) => {
    setData((prev) => markRecurringPaid(prev, r.id))
  }

  const patchCommentaries = (id: number, next: ProgressCommentary[] | undefined) => {
    setData((prev) => ({
      ...prev,
      recurringTransactions: prev.recurringTransactions.map((r) =>
        r.id === id ? { ...r, commentaries: next } : r,
      ),
    }))
    setCommentsFor((cur) =>
      cur && cur.id === id
        ? { ...cur, commentaries: next }
        : cur,
    )
  }

  const changeSort = (next: RecurringSort) => {
    setSort(next)
    try {
      localStorage.setItem(SORT_KEY, next)
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Recurring"
        description="Subscriptions and bills. Mark paid to post a spending entry and advance the due date."
        action={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            Add recurring
          </button>
        }
      />

      {/* Monthly total + sort */}
      <div className="recurring-summary mb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-stretch">
        <div
          className="surface border border-border-strong px-4 sm:px-5 py-4 flex flex-wrap items-end justify-between gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0">
            <p className="label-uppercase text-[11px] text-accent mb-1">Monthly total</p>
            <p className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${privacyClass(privacy)}`}>
              {formatGBP(monthlyTotal)}
            </p>
            <p className="text-xs text-text-subtle mt-1.5">
              All {data.recurringTransactions.length} item
              {data.recurringTransactions.length === 1 ? '' : 's'} as a monthly equivalent
              {monthlyCount > 0
                ? ` · ${monthlyCount} monthly`
                : ''}
            </p>
          </div>
        </div>

        <div className="surface border border-border-strong px-3 py-3 sm:min-w-[14rem]">
          <label className="label-uppercase text-[11px] text-text-subtle block mb-2" htmlFor="recurring-sort">
            Sort by
          </label>
          <select
            id="recurring-sort"
            className="w-full min-h-11"
            value={sort}
            onChange={(e) => changeSort(e.target.value as RecurringSort)}
            aria-label="Sort recurring subscriptions"
          >
            {RECURRING_SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Quick sort"
      >
        {RECURRING_SORT_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`btn-sm min-h-9 ${
              sort === o.id ? 'btn-secondary border-accent text-accent' : 'btn-ghost'
            }`}
            aria-pressed={sort === o.id}
            onClick={() => changeSort(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px">
        {items.map((r) => {
          const noteCount = r.commentaries?.length ?? 0
          return (
            <div key={r.id} className="surface p-6 sm:p-8 flex flex-col">
              <div className="flex justify-between gap-4 mb-3">
                <h3 className="font-bold tracking-tight text-lg leading-snug">{r.name}</h3>
                <span className="bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 self-start shrink-0">
                  {r.frequency}
                </span>
              </div>
              <p className={`text-2xl font-bold tabular-nums mb-2 ${privacyClass(privacy)}`}>
                {formatGBPPrecise(r.amount)}
              </p>
              <p className="text-sm text-text-subtle mb-1">
                Next due {formatDate(r.nextDue)} · {r.category}
              </p>
              <p className="text-xs text-text-subtle mb-5 tabular-nums">
                {r.lastPaidAt
                  ? `Last paid ${formatDateTime(r.lastPaidAt)}`
                  : 'Never paid'}
                {r.frequency !== 'monthly'
                  ? ` · ≈ ${formatGBP(monthlyRecurringTotal([r]))}/mo`
                  : ''}
              </p>

              <div className="mt-auto flex flex-wrap gap-2">
                <button type="button" className="btn-primary btn-sm" onClick={() => markPaid(r)}>
                  Mark paid
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm inline-flex items-center gap-1.5"
                  onClick={() => setCommentsFor(r)}
                  aria-label={`Commentary for ${r.name}`}
                >
                  <MessageSquareText size={14} strokeWidth={1.75} aria-hidden />
                  {noteCount > 0 ? `Notes (${noteCount})` : 'Add note'}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(r)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setDeleteId(r.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <div className="surface p-12 text-center text-text-subtle col-span-full">
            No recurring items yet. Add a subscription or bill to track due dates and monthly spend.
          </div>
        )}
      </div>

      <Modal open={open} title={editing ? 'Edit recurring' : 'Add recurring'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <Field label="Name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Frequency">
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frequency: e.target.value as RecurringTransaction['frequency'],
                  })
                }
              >
                {FREQ.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Next due">
              <input
                type="date"
                required
                value={form.nextDue}
                onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
              />
            </Field>
          </div>
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
        open={Boolean(commentsFor)}
        title={commentsFor ? `Commentary · ${commentsFor.name}` : 'Commentary'}
        onClose={() => setCommentsFor(null)}
        size="sheet"
      >
        {commentsFor ? (
          <ProgressCommentaryPanel
            commentaries={commentsFor.commentaries}
            onChange={(next) => patchCommentaries(commentsFor.id, next)}
            description="Log calls, renewals, and price-change notes. Each entry is date-stamped — newest first."
            placeholder="e.g. Renewed annual plan — price rises next April…"
            emptyLabel="No commentary yet — add your first note above."
            className="border-0 shadow-none bg-transparent p-0 sm:p-0"
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete recurring"
        body="Remove this recurring item and its commentary?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            recurringTransactions: prev.recurringTransactions.filter((r) => r.id !== deleteId),
          }))
          if (commentsFor?.id === deleteId) setCommentsFor(null)
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary recurring actions">
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          Add recurring
        </button>
        {items.length > 0 ? (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => markPaid(items[0])}
            title={`Mark ${items[0].name} paid`}
          >
            Mark paid
          </button>
        ) : null}
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
