import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, TrendingDown, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { BudgetSparkline } from '../components/charts/BudgetSparkline'
import { PageHeader } from '../components/ui/PageHeader'
import { Field, Modal, ConfirmDialog, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { formatMonthLabel, monthKey, parseMonthParam, shiftMonth, daysElapsedInMonth, daysInMonth } from '../domain/monthUtils'
import { formatGBP, formatGBPPrecise, pct, privacyClass } from '../utils/format'

export function BudgetsPage() {
  const { data, setData, privacy } = usePortfolio()
  const { success } = useToasts()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: '', limit: '', rollover: false })
  const [removeCategory, setRemoveCategory] = useState<string | null>(null)
  const ym = parseMonthParam(searchParams.get('month'))

  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) {
      const budget = data.budgetGoals[cat.toLowerCase()]
      setForm({ 
        category: cat, 
        limit: String(budget ?? ''),
        rollover: false
      })
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
        const remaining = limit - spent
        const dim = daysInMonth(ym)
        const daysElapsed = daysElapsedInMonth(ym)
        const dailyAvg = spent / daysElapsed
        const projectedTotal = dailyAvg * dim
        const onTrack = limit > 0 && projectedTotal <= limit
        return { category, limit, spent, progress, over, near, remaining, dailyAvg, projectedTotal, onTrack }
      })
  }, [data.budgetGoals, spentByCategory, ym])

  const alerts = rows.filter((r) => r.over || r.near)
  
  const totalBudget = rows.reduce((sum, r) => sum + r.limit, 0)
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0)
  const totalRemaining = totalBudget - totalSpent
  const overallProgress = totalBudget > 0 ? pct(totalSpent, totalBudget) : 0

  const save = () => {
    const category = form.category.trim().toLowerCase()
    const limit = parseNum(form.limit)
    if (!category || limit <= 0) return
    setData((prev) => ({
      ...prev,
      budgetGoals: { ...prev.budgetGoals, [category]: limit },
    }))
    setOpen(false)
    setForm({ category: '', limit: '', rollover: false })
    success('Budget saved', `${category}: ${formatGBP(limit)}/month`)
  }

  const exportBudgetReport = () => {
    const report = [
      `Budget Report - ${formatMonthLabel(ym)}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      `Overall: ${formatGBP(totalSpent)} / ${formatGBP(totalBudget)} (${overallProgress}%)`,
      `Remaining: ${formatGBP(totalRemaining)}`,
      '',
      'Category Breakdown:',
      ...rows.map((r) => 
        `  ${r.category.padEnd(20)} ${formatGBP(r.spent).padStart(12)} / ${formatGBP(r.limit).padStart(12)} (${r.progress}%)${r.over ? ' OVER BUDGET' : r.near ? ' NEAR LIMIT' : ''}`
      ),
    ].join('\n')
    
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-report-${ym}.txt`
    a.click()
    URL.revokeObjectURL(url)
    success('Report exported', `Budget report for ${formatMonthLabel(ym)}`)
  }

  const applyBudgetTemplate = (template: 'conservative' | 'balanced' | 'flexible') => {
    const templates = {
      conservative: {
        food: 300,
        transport: 150,
        entertainment: 100,
        shopping: 200,
        bills: 500,
      },
      balanced: {
        food: 400,
        transport: 200,
        entertainment: 150,
        shopping: 300,
        bills: 500,
      },
      flexible: {
        food: 500,
        transport: 250,
        entertainment: 250,
        shopping: 400,
        bills: 500,
      },
    }
    
    setData((prev) => ({
      ...prev,
      budgetGoals: { ...prev.budgetGoals, ...templates[template] },
    }))
    success('Template applied', `${template} budget template`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Spending"
        title="Budgets"
        description={`${formatMonthLabel(ym)} · ${rows.length} categories tracked`}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="btn-ghost btn-sm min-h-11"
              aria-label="Previous month"
              onClick={() => setYm(shiftMonth(ym, -1))}
            >
              Prev
            </button>
            <span className="text-sm font-semibold tabular-nums px-1">{ym}</span>
            <button
              type="button"
              className="btn-ghost btn-sm min-h-11"
              aria-label="Next month"
              onClick={() => setYm(shiftMonth(ym, 1))}
            >
              Next
            </button>
            {ym !== monthKey() && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setYm(monthKey())}>
                This month
              </button>
            )}
            <button type="button" className="btn-ghost btn-sm" onClick={exportBudgetReport}>
              <Download size={14} /> Export
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
              Set limit
            </button>
          </div>
        }
      />

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Total Budget</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            {formatGBP(totalBudget)}
          </p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Spent</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            {formatGBP(totalSpent)}
          </p>
          <p className="text-xs text-text-muted mt-1">{overallProgress}% of budget</p>
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Remaining</p>
          <p className={`text-2xl font-bold tabular-nums ${totalRemaining < 0 ? 'text-red-500' : 'text-green-500'} ${privacyClass(privacy)}`}>
            {formatGBP(Math.abs(totalRemaining))}
          </p>
          {totalRemaining < 0 && <p className="text-xs text-red-500 mt-1">Over budget</p>}
        </div>
        <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Categories</p>
          <p className="text-2xl font-bold tabular-nums">{rows.length}</p>
          <p className="text-xs text-text-muted mt-1">{alerts.length} need attention</p>
        </div>
      </div>

      {/* Quick Actions */}
      {rows.length === 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold mb-3">Quick Start Templates</h3>
          <p className="text-sm text-text-muted mb-4">Choose a budget template to get started:</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyBudgetTemplate('conservative')} className="btn-secondary btn-sm">
              Conservative (£1,250/mo)
            </button>
            <button type="button" onClick={() => applyBudgetTemplate('balanced')} className="btn-secondary btn-sm">
              Balanced (£1,550/mo)
            </button>
            <button type="button" onClick={() => applyBudgetTemplate('flexible')} className="btn-secondary btn-sm">
              Flexible (£1,900/mo)
            </button>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 mb-6">
          {alerts.map((a) => (
            <Link
              key={a.category}
              to={`/spending?category=${encodeURIComponent(a.category)}&month=${ym}`}
              className={`surface surface-interactive px-5 py-4 border-l-4 block rounded-xl md:rounded-none shadow-sm md:shadow-none ${
                a.over ? 'border-l-red-500' : 'border-l-amber-500'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {a.over ? (
                    <AlertCircle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <TrendingUp size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold uppercase tracking-wider">
                      {a.over ? 'Over budget' : 'Approaching limit'} · {a.category}
                    </p>
                    <p className={`text-sm text-text-muted mt-1 ${privacyClass(privacy)}`}>
                      {formatGBPPrecise(a.spent)} of {formatGBPPrecise(a.limit)} ({a.progress}%)
                    </p>
                    {a.over && (
                      <p className="text-xs text-red-500 mt-1">
                        {formatGBP(a.spent - a.limit)} over budget
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-px">
        {rows.map((r) => (
          <div key={r.category} className="surface p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex justify-between gap-4 mb-2">
              <h3 className="font-bold tracking-tight uppercase text-sm tracking-widest">
                {r.category}
              </h3>
              <div className="flex items-center gap-2">
                {r.limit > 0 && (
                  r.onTrack ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <TrendingDown size={16} className="text-amber-500" />
                  )
                )}
                <span
                  className={`text-sm font-bold tabular-nums ${
                    r.over ? 'text-red-500' : r.near ? 'text-amber-500' : 'text-text'
                  }`}
                >
                  {r.limit > 0 ? `${r.progress}%` : '—'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mb-1">
                  Spent
                </p>
                <p className={`text-lg font-bold ${privacyClass(privacy)}`}>
                  {formatGBP(r.spent)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mb-1">
                  {r.remaining >= 0 ? 'Remaining' : 'Over'}
                </p>
                <p className={`text-lg font-bold ${r.remaining < 0 ? 'text-red-500' : 'text-green-500'} ${privacyClass(privacy)}`}>
                  {formatGBP(Math.abs(r.remaining))}
                </p>
              </div>
            </div>

            {r.limit > 0 && (
              <>
                <div
                  className="progress-track mb-3"
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
                      background: r.over ? '#ef4444' : r.near ? '#f59e0b' : 'var(--accent)',
                    }}
                  />
                </div>
                
                <div className="text-xs text-text-muted mb-3 space-y-1">
                  <p className={privacyClass(privacy)}>
                    Daily avg: {formatGBP(r.dailyAvg)}
                  </p>
                  <p className={privacyClass(privacy)}>
                    Projected: {formatGBP(r.projectedTotal)} {!r.onTrack && '· Over projection'}
                  </p>
                </div>
              </>
            )}

            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mb-1">
                6-month trend
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
                className="btn-secondary btn-sm text-xs"
              >
                View transactions
              </Link>
              <button
                type="button"
                className="btn-ghost btn-sm text-xs"
                onClick={() => {
                  setForm({ category: r.category, limit: String(r.limit), rollover: false })
                  setOpen(true)
                }}
              >
                Edit limit
              </button>
              {r.limit > 0 && (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-xs text-red-500"
                  onClick={() => setRemoveCategory(r.category)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="surface p-12 text-center text-text-muted col-span-full rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <p className="mb-4">No budgets yet. Set a category limit to start tracking.</p>
            <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
              Create First Budget
            </button>
          </div>
        )}
      </div>

      <Modal open={open} title={form.category ? 'Edit budget limit' : 'Set budget limit'} onClose={() => setOpen(false)}>
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
              placeholder="food, transport, entertainment..."
            />
          </Field>
          <Field label="Monthly limit £">
            <input
              type="text"
              inputMode="decimal"
              required
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: e.target.value })}
              placeholder="0.00"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {form.category && data.budgetGoals[form.category.toLowerCase()] ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={removeCategory !== null}
        title="Remove budget"
        body={
          removeCategory
            ? `Remove budget for ${removeCategory}? Spending history is kept; only the limit is cleared.`
            : ''
        }
        confirmLabel="Remove budget"
        onClose={() => setRemoveCategory(null)}
        onConfirm={() => {
          if (!removeCategory) return
          const category = removeCategory
          setData((prev) => {
            const next = { ...prev.budgetGoals }
            delete next[category]
            delete next[category.toLowerCase()]
            return { ...prev, budgetGoals: next }
          })
          success('Budget removed', category)
        }}
      />
    </div>
  )
}
