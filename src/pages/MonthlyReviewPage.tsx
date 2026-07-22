import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { loadReviewMonthPref, saveReviewMonthPref } from '../domain/reviewMonthPref'
import { syncNow } from '../services/sync/autoSyncService'
import { formatGBP, formatPct, privacyClass } from '../utils/format'

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthKey(d)
}

export function MonthlyReviewPage() {
  const { data, breakdown, privacy } = usePortfolio()
  const { success } = useToasts()
  const [ym, setYm] = useState(() => loadReviewMonthPref(monthKey(new Date())))
  const setReviewYm = (next: string) => {
    setYm(next)
    saveReviewMonthPref(next)
  }

  const thisMonth = useMemo(() => {
    const spend = data.spending.filter((s) => s.date.startsWith(ym))
    const totalSpend = spend.reduce((s, x) => s + Math.abs(x.amount), 0)
    const byCat = new Map<string, number>()
    for (const s of spend) {
      byCat.set(s.category, (byCat.get(s.category) ?? 0) + Math.abs(s.amount))
    }
    const income = data.monthlyIncome
    return {
      totalSpend,
      income,
      surplus: income - totalSpend,
      byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]),
      count: spend.length,
    }
  }, [data.spending, data.monthlyIncome, ym])

  const prevYm = shiftMonth(ym, -1)
  const prevSpend = useMemo(
    () =>
      data.spending
        .filter((s) => s.date.startsWith(prevYm))
        .reduce((s, x) => s + Math.abs(x.amount), 0),
    [data.spending, prevYm],
  )

  const mom =
    prevSpend > 0 ? ((thisMonth.totalSpend - prevSpend) / prevSpend) * 100 : 0

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Monthly review"
        description="Income, spend by category, and month-over-month change."
        action={
          <div className="review-sticky-month flex flex-wrap gap-2">
            <Link to="/budgets" className="btn-ghost btn-sm">
              Budgets
            </Link>
            <Link to="/recurring" className="btn-ghost btn-sm">
              Recurring
            </Link>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setReviewYm(shiftMonth(ym, -1))}
            >
              Prev
            </button>
            <span className="text-sm font-semibold tabular-nums self-center px-2">{ym}</span>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setReviewYm(shiftMonth(ym, 1))}
            >
              Next
            </button>
          </div>
        }
      />

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
        <StatCard label="Income (monthly)" value={formatGBP(thisMonth.income)} />
        <StatCard label="Spent" value={formatGBP(thisMonth.totalSpend)} hint={`${thisMonth.count} txs`} />
        <StatCard
          label="Surplus"
          value={formatGBP(thisMonth.surplus, { signed: true })}
          tone={thisMonth.surplus >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="vs last month"
          value={formatPct(mom)}
          hint={`Prior spend ${formatGBP(prevSpend)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px">
        <div className="surface p-6 sm:p-8">
          <p className="label-uppercase mb-4">Spend by category</p>
          {thisMonth.byCat.length === 0 ? (
            <p className="text-sm text-text-subtle">No spending this month.</p>
          ) : (
            <ul className="space-y-3">
              {thisMonth.byCat.map(([cat, amount]) => (
                <li key={cat} className="flex justify-between gap-4 text-sm">
                  <span className="uppercase tracking-wider text-xs font-bold text-text-subtle">
                    {cat}
                  </span>
                  <span className={`font-semibold tabular-nums ${privacyClass(privacy)}`}>
                    {formatGBP(amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface p-6 sm:p-8">
          <p className="label-uppercase mb-4">Portfolio snapshot</p>
          <p className={`text-2xl font-bold tabular-nums mb-2 ${privacyClass(privacy)}`}>
            {formatGBP(breakdown.netWorth)}
          </p>
          <p className="text-sm text-text-muted font-light">
            Assets {formatGBP(breakdown.assets)} · Debt {formatGBP(breakdown.liabilities)}
          </p>
          <p className="text-sm text-text-subtle mt-6 font-light">
            Set monthly income in Settings to improve surplus accuracy for this view.
          </p>
        </div>
      </div>

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary monthly review actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/budgets" className="btn-secondary btn-sm">
          Budgets
        </Link>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            void syncNow().then(() => success('Sync now finished'))
          }}
        >
          Sync now
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
