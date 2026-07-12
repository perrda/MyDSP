import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SpendingSeriesChart } from '../components/charts/SpendingSeriesChart'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { formatMonthLabel, monthKey, parseMonthParam, shiftMonth } from '../domain/monthUtils'
import type { SpendingEntry } from '../domain/types'
import { formatDate, formatGBPPrecise, privacyClass } from '../utils/format'

const CATEGORIES = [
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

const FILTERS_KEY = 'mydsp_spend_filters'

function loadFilters(): { query: string; category: string } {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return { query: '', category: 'All' }
    const parsed = JSON.parse(raw) as { query?: string; category?: string }
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      category: typeof parsed.category === 'string' ? parsed.category : 'All',
    }
  } catch {
    return { query: '', category: 'All' }
  }
}

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  description: '',
  amount: '',
  category: 'other',
  method: 'debit',
  location: '',
  tripId: '',
  paidBy: 'person1',
  split: 'no',
  notes: '',
}

export function SpendingPage() {
  const { data, privacy, setData } = usePortfolio()
  const [searchParams, setSearchParams] = useSearchParams()
  const saved = useMemo(() => loadFilters(), [])
  const categoryFromUrl = searchParams.get('category')
  const monthFromUrl = searchParams.get('month')
  const [query, setQuery] = useState(saved.query)
  const [category, setCategory] = useState(
    categoryFromUrl ? categoryFromUrl.toLowerCase() : saved.category,
  )
  const [ym, setYm] = useState(() => parseMonthParam(monthFromUrl))
  const [customDraft, setCustomDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SpendingEntry | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (categoryFromUrl) setCategory(categoryFromUrl.toLowerCase())
  }, [categoryFromUrl])

  useEffect(() => {
    if (monthFromUrl) setYm(parseMonthParam(monthFromUrl))
  }, [monthFromUrl])

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ query, category }))
    } catch {
      /* ignore */
    }
  }, [query, category])

  useEffect(() => {
    const params: Record<string, string> = { month: ym }
    if (category !== 'All') params.category = category.toLowerCase()
    setSearchParams(params, { replace: true })
  }, [category, ym, setSearchParams])

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set([...CATEGORIES, ...data.customCategories, ...data.spending.map((t) => t.category)]),
      ).sort(),
    [data.customCategories, data.spending],
  )

  const categories = useMemo(() => ['All', ...allCategories], [allCategories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...data.spending]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((tx) => {
        const matchMonth = tx.date.startsWith(ym)
        const matchCat =
          category === 'All' || tx.category.toLowerCase() === category.toLowerCase()
        const matchQ =
          !q ||
          tx.description.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q)
        return matchMonth && matchCat && matchQ
      })
  }, [data.spending, query, category, ym])

  const addCustomCategory = () => {
    const name = customDraft.trim().toLowerCase()
    if (!name) return
    setData((prev) => {
      if (prev.customCategories.includes(name) || CATEGORIES.includes(name)) return prev
      return { ...prev, customCategories: [...prev.customCategories, name] }
    })
    setCustomDraft('')
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) })
    setOpen(true)
  }

  const openEdit = (tx: SpendingEntry) => {
    setEditing(tx)
    setForm({
      date: tx.date.slice(0, 10),
      description: tx.description,
      amount: String(Math.abs(tx.amount)),
      category: tx.category,
      method: tx.method,
      location: tx.location ?? '',
      tripId: tx.tripId != null ? String(tx.tripId) : '',
      paidBy: tx.paidBy === 'person2' ? 'person2' : 'person1',
      split: tx.split || 'no',
      notes: tx.notes ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const entry: SpendingEntry = {
      id: editing?.id ?? nextId(data.spending),
      date: form.date,
      description: form.description.trim() || 'Expense',
      amount: Math.abs(parseNum(form.amount)),
      category: form.category,
      method: form.method,
      location: form.location.trim() || undefined,
      tripId: form.tripId ? Number(form.tripId) : null,
      paidBy: form.paidBy,
      split: form.split,
      notes: form.notes.trim() || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    }
    setData((prev) => ({
      ...prev,
      spending: editing
        ? prev.spending.map((s) => (s.id === editing.id ? entry : s))
        : [...prev.spending, entry],
    }))
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Spending ledger"
        description={`${formatMonthLabel(ym)} · filter by category, search, or jump to budgets.`}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(shiftMonth(ym, -1))}>
              Prev
            </button>
            <span className="text-sm font-semibold tabular-nums">{ym}</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(shiftMonth(ym, 1))}>
              Next
            </button>
            {ym !== monthKey() && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(monthKey())}>
                Now
              </button>
            )}
            {category !== 'All' && (
              <Link
                to={`/budgets?category=${encodeURIComponent(category)}&month=${ym}`}
                className="btn-secondary btn-sm"
              >
                Set budget
              </Link>
            )}
            <Link to={`/budgets?month=${ym}`} className="btn-ghost btn-sm">
              Budgets
            </Link>
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              Add expense
            </button>
          </div>
        }
      />

      <SpendingSeriesChart spending={data.spending} privacy={privacy} />

      <div className="surface p-5 sm:p-6 mb-px">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            placeholder="New custom category…"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            className="flex-1"
          />
          <button type="button" className="btn-secondary btn-sm" onClick={addCustomCategory}>
            Add category
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label
              htmlFor="sp-search"
              className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2"
            >
              Search
            </label>
            <input
              id="sp-search"
              type="search"
              placeholder="Description or category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sm:w-56">
            <label
              htmlFor="sp-cat"
              className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2"
            >
              Category
            </label>
            <select id="sp-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              {['Date', 'Description', 'Category', 'Method', 'Amount', ''].map((h) => (
                <th key={h || 'actions'} className="px-5 sm:px-6 py-4 label-uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                <td className="px-5 sm:px-6 py-4 text-sm text-text-muted whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>
                <td className="px-5 sm:px-6 py-4 text-sm font-medium">{tx.description}</td>
                <td className="px-5 sm:px-6 py-4">
                  <span className="bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                    {tx.category}
                  </span>
                </td>
                <td className="px-5 sm:px-6 py-4 text-sm text-text-subtle">{tx.method}</td>
                <td
                  className={`px-5 sm:px-6 py-4 text-sm font-semibold tabular-nums text-right ${privacyClass(privacy)}`}
                >
                  {formatGBPPrecise(-Math.abs(tx.amount))}
                </td>
                <td className="px-5 sm:px-6 py-4 whitespace-nowrap">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(tx)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setDeleteId(tx.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-subtle font-light">
                  {data.spending.length === 0
                    ? 'No spending yet — click Add expense.'
                    : 'No transactions match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={editing ? 'Edit expense' : 'Add expense'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Date">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Amount (GBP)">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Method">
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {['debit', 'credit', 'cash', 'transfer'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Trip">
              <select
                value={form.tripId}
                onChange={(e) => setForm({ ...form, tripId: e.target.value })}
              >
                <option value="">None</option>
                {data.trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Paid by">
              <select
                value={form.paidBy}
                onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
              >
                <option value="person1">{data.splitSettings.person1.name}</option>
                <option value="person2">{data.splitSettings.person2.name}</option>
              </select>
            </Field>
            <Field label="Split">
              <select
                value={form.split}
                onChange={(e) => setForm({ ...form, split: e.target.value })}
              >
                <option value="no">No split</option>
                <option value="50">50 / 50</option>
                <option value="60">60 / 40</option>
                <option value="70">70 / 30</option>
              </select>
            </Field>
          </div>
          <Field label="Location">
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={3}
              className="w-full"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
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
        title="Delete expense"
        body="Remove this spending entry?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            spending: prev.spending.filter((s) => s.id !== deleteId),
          }))
        }}
      />
    </div>
  )
}
