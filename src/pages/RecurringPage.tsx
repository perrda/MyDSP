import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { ProgressCommentaryPanel } from '../components/ProgressCommentaryPanel'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { recurringFocusUrl } from '../domain/deepLinks'
import {
  markRecurringPaidWithUndo,
  skipRecurringOccurrenceWithUndo,
  undoRecurringPaid,
  undoRecurringSkip,
} from '../domain/recurringActions'
import {
  monthlyRecurringTotal,
  RECURRING_SORT_OPTIONS,
  sortRecurringTransactions,
  type RecurringSort,
} from '../domain/recurringHelpers'
import { loadRecurringSort, saveRecurringSort } from '../domain/recurringSortPrefs'
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

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
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
  const { showToast } = useToasts()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [form, setForm] = useState(empty)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [sort, setSort] = useState<RecurringSort>(() => loadRecurringSort())
  const [commentsFor, setCommentsFor] = useState<RecurringTransaction | null>(null)
  const [focusRecurringId, setFocusRecurringId] = useState<number | null>(null)

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

  // Deep-link: /recurring?focus=<id> scrolls matching item into view
  useEffect(() => {
    const raw = searchParams.get('focus')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) {
      const next = new URLSearchParams(searchParams)
      next.delete('focus')
      setSearchParams(next, { replace: true })
      return
    }
    const item = (data.recurringTransactions ?? []).find((r) => r.id === id)
    if (!item) return
    setFocusRecurringId(id)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
  }, [searchParams, data.recurringTransactions, setSearchParams])

  useEffect(() => {
    if (focusRecurringId == null) return
    const tryScroll = () => {
      const el = document.getElementById(`recurring-row-${focusRecurringId}`)
      if (!el) return false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
    if (tryScroll()) {
      const clear = window.setTimeout(() => setFocusRecurringId(null), 2500)
      return () => window.clearTimeout(clear)
    }
    const retry = window.setTimeout(() => {
      tryScroll()
      window.setTimeout(() => setFocusRecurringId(null), 2500)
    }, 100)
    return () => window.clearTimeout(retry)
  }, [focusRecurringId, items])

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
    const result = markRecurringPaidWithUndo(data, r.id)
    if (!result.undo) return
    setData(result.data)
    const undo = result.undo
    showToast({
      type: 'success',
      title: `${r.name} marked paid`,
      message: 'Posted to Spending; budget totals now include this payment.',
      duration: 5_000,
      className: 'recurring-mark-paid-undo',
      actions: [
        { label: 'Undo', onClick: () => setData((prev) => undoRecurringPaid(prev, undo)) },
        { label: 'View recurring', onClick: () => navigate(recurringFocusUrl(r.id)) },
      ],
    })
  }

  const skip = (r: RecurringTransaction) => {
    const result = skipRecurringOccurrenceWithUndo(data, r.id)
    if (!result.undo) return
    setData(result.data)
    const undo = result.undo
    showToast({
      type: 'success',
      title: `${r.name} skipped`,
      message: 'The next due date moved forward; no Spending entry was added.',
      duration: 5_000,
      className: 'recurring-skip-undo',
      actions: [
        { label: 'Undo', onClick: () => setData((prev) => undoRecurringSkip(prev, undo)) },
        { label: 'View recurring', onClick: () => navigate(recurringFocusUrl(r.id)) },
      ],
    })
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
    saveRecurringSort(next)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Recurring"
        description="Subscriptions and bills. Mark paid to post a spending entry and advance the due date."
        action={
          <button
            type="button"
            className="btn-primary btn-sm page-primary-actions"
            data-testid="page-primary-actions"
            onClick={openCreate}
          >
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
        className="recurring-sticky-sort mb-4 flex flex-wrap gap-1.5"
        data-testid="recurring-sticky-sort"
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
          const focused = focusRecurringId === r.id
          return (
            <div
              key={r.id}
              id={`recurring-row-${r.id}`}
              data-testid={`recurring-row-${r.id}`}
              className={`surface p-4 sm:p-6 flex flex-col ${
                focused ? 'todo-focus-ring ring-2 ring-accent bg-accent/10' : ''
              }`}
            >
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

              <OverflowMenu
                compact
                className="mt-auto"
                label={`Actions for ${r.name}`}
                leading={
                  <>
                    <button type="button" className="btn-primary btn-sm" onClick={() => markPaid(r)}>
                      Mark paid
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => skip(r)}>
                      Skip
                    </button>
                  </>
                }
                items={[
                  {
                    id: 'notes',
                    label: noteCount > 0 ? `Notes (${noteCount})` : 'Add note',
                    onClick: () => setCommentsFor(r),
                  },
                  { id: 'edit', label: 'Edit', onClick: () => openEdit(r) },
                  {
                    id: 'delete',
                    label: 'Delete',
                    destructive: true,
                    onClick: () => setDeleteId(r.id),
                  },
                ]}
              />
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

    </div>
  )
}
