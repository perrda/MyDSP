import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BudgetSparkline } from '../components/charts/BudgetSparkline'
import { PageHeader } from '../components/ui/PageHeader'
import { Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { formatMonthLabel, monthKey, parseMonthParam, shiftMonth } from '../domain/monthUtils'
import { formatGBP, formatGBPPrecise, pct, privacyClass } from '../utils/format'

export function BudgetsPage() {
  const { data, setData, privacy } = usePortfolio()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: '', limit: '' })
  const ym = parseMonthParam(searchParams.get('month'))

  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) {
      setForm({ category: cat, limit: String(data.budgetGoals[cat.toLowerCase()] ?? '') })
      setOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- open once from deep link

  const setYm = (next: string) => {
    const params: Record<string, string> = { month: next }
    const cat = searchParams.get('category')
    if (cat) params.category = cat
    setSearchParams(params, { replace: true })
  }

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of data.spending) {
      if (!s.date.startsWith(ym)) continue
      const cat = s.category.toLowerCase()
      map.set(cat, (map.get(cat) ?? 0) + Math.abs(s.amount))
    }
    return map
  }, [data.spending, ym])

  const rows = useMemo(() => {
    const cats = new Set([
      ...Object.keys(data.budgetGoals).map((c) => c.toLowerCase()),
      ...spentByCategory.keys(),
    ])
    return [...cats]
      .sort()
      .map((category) => {
        const limit = data.budgetGoals[category] ?? data.budgetGoals[category.toLowerCase()] ?? 0
        const spent = spentByCategory.get(category) ?? 0
        const progress = limit > 0 ? pct(spent, limit) : 0
        const over = limit > 0 && spent > limit
        const near = limit > 0 && !over && spent / limit >= 0.8
        return { category, limit, spent, progress, over, near }
      })
  }, [data.budgetGoals, spentByCategory])

  const alerts = rows.filter((r) => r.over || r.near)

  const save = () => {
    const category = form.category.trim().toLowerCase()
    const limit = parseNum(form.limit)
    if (!category || limit <= 0) return
    setData((prev) => ({
      ...prev,
      budgetGoals: { ...prev.budgetGoals, [category]: limit },
    }))
    setOpen(false)
    setForm({ category: '', limit: '' })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Spending"
        title="Budgets"
        description={`${formatMonthLabel(ym)} · category limits with live variance.`}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(shiftMonth(ym, -1))}>
              Prev
            </button>
            <span className="text-sm font-semibold tabular-nums px-1">{ym}</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(shiftMonth(ym, 1))}>
              Next
            </button>
            {ym !== monthKey() && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(monthKey())}>
                This month
              </button>
            )}
            <Link to={`/spending?month=${ym}`} className="btn-ghost btn-sm">
              Ledger
            </Link>
            <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
              Set limit
            </button>
          </div>
        }
      />

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-px mb-8">
          {alerts.map((a) => (
            <Link
              key={a.category}
              to={`/spending?category=${encodeURIComponent(a.category)}&month=${ym}`}
              className={`surface surface-interactive px-5 py-4 border-l-2 block ${
                a.over ? 'border-l-[var(--text-subtle)]' : 'border-l-accent'
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wider">
                {a.over ? 'Over budget' : 'Approaching limit'} · {a.category}
              </p>
              <p className={`text-sm text-text-muted mt-1 ${privacyClass(privacy)}`}>
                {formatGBPPrecise(a.spent)} of {formatGBPPrecise(a.limit)} ({a.progress}%)
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px">
        {rows.map((r) => (
          <div key={r.category} className="surface p-6 sm:p-8">
            <div className="flex justify-between gap-4 mb-4">
              <h3 className="font-bold tracking-tight uppercase text-sm tracking-widest">
                {r.category}
              </h3>
              <span
                className={`text-sm font-bold tabular-nums ${
                  r.over ? 'text-text-muted' : r.near ? 'text-accent' : 'text-text'
                }`}
              >
                {r.limit > 0 ? `${r.progress}%` : '—'}
              </span>
            </div>
            <p className={`text-sm text-text-subtle mb-4 ${privacyClass(privacy)}`}>
              {formatGBP(r.spent)}
              {r.limit > 0 ? ` of ${formatGBP(r.limit)}` : ' (no limit set)'}
            </p>
            {r.limit > 0 && (
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={r.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${r.category} budget ${r.progress}%`}
              >
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(r.progress, 100)}%`,
                    background: r.over ? 'var(--text-subtle)' : 'var(--accent)',
                  }}
                />
              </div>
            )}
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mb-1">
                6-month spend
              </p>
              <BudgetSparkline
                spending={data.spending}
                category={r.category}
                limit={r.limit}
                privacy={privacy}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                to={`/spending?category=${encodeURIComponent(r.category)}&month=${ym}`}
                className="btn-secondary btn-sm"
              >
                View transactions
              </Link>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  if (r.limit <= 0) return
                  setData((prev) => {
                    const next = { ...prev.budgetGoals }
                    delete next[r.category]
                    delete next[r.category.toLowerCase()]
                    return { ...prev, budgetGoals: next }
                  })
                }}
              >
                {r.limit > 0 ? 'Remove limit' : 'No limit set'}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="surface p-12 text-center text-text-subtle col-span-full">
            No budgets yet. Set a category limit to start tracking.
          </div>
        )}
      </div>

      <Modal open={open} title="Set budget limit" onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Category">
            <input
              type="text"
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="food"
            />
          </Field>
          <Field label="Monthly limit £">
            <input
              type="text"
              inputMode="decimal"
              required
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: e.target.value })}
            />
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
    </div>
  )
}
