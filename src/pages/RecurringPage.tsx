import { useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import type { RecurringTransaction } from '../domain/types'
import { formatDate, formatGBPPrecise, privacyClass } from '../utils/format'

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

function advanceDue(date: string, frequency: RecurringTransaction['frequency']): string {
  const d = new Date(date)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
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
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
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
    setOpen(true)
  }

  const save = () => {
    const entry: RecurringTransaction = {
      id: editing?.id ?? nextId(data.recurringTransactions),
      name: form.name.trim() || 'Recurring',
      amount: parseNum(form.amount),
      frequency: form.frequency,
      category: form.category,
      nextDue: form.nextDue,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
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
    const spendId =
      data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1
    setData((prev) => ({
      ...prev,
      spending: [
        ...prev.spending,
        {
          id: spendId,
          date: r.nextDue,
          description: r.name,
          amount: Math.abs(r.amount),
          category: r.category,
          method: 'debit',
          createdAt: new Date().toISOString(),
        },
      ],
      recurringTransactions: prev.recurringTransactions.map((x) =>
        x.id === r.id ? { ...x, nextDue: advanceDue(r.nextDue, r.frequency) } : x,
      ),
    }))
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px">
        {[...data.recurringTransactions]
          .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
          .map((r) => (
            <div key={r.id} className="surface p-6 sm:p-8">
              <div className="flex justify-between gap-4 mb-3">
                <h3 className="font-bold tracking-tight">{r.name}</h3>
                <span className="bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 self-start">
                  {r.frequency}
                </span>
              </div>
              <p className={`text-2xl font-bold tabular-nums mb-2 ${privacyClass(privacy)}`}>
                {formatGBPPrecise(r.amount)}
              </p>
              <p className="text-sm text-text-subtle mb-6">
                Next due {formatDate(r.nextDue)} · {r.category}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary btn-sm" onClick={() => markPaid(r)}>
                  Mark paid
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
          ))}
        {data.recurringTransactions.length === 0 && (
          <div className="surface p-12 text-center text-text-subtle col-span-full">
            No recurring items yet.
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
          <Field label="Name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount £">
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

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete recurring"
        body="Remove this recurring item?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            recurringTransactions: prev.recurringTransactions.filter((r) => r.id !== deleteId),
          }))
        }}
      />
    </div>
  )
}
