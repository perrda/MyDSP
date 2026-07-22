import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { simulateDebt, type DebtStrategy } from '../domain/debt'
import { syncNow } from '../services/sync/autoSyncService'
import { formatGBP, privacyClass } from '../utils/format'

const STRATEGIES: { id: DebtStrategy; name: string; desc: string }[] = [
  { id: 'avalanche', name: 'Avalanche', desc: 'Highest APR first — minimises interest.' },
  { id: 'snowball', name: 'Snowball', desc: 'Smallest balance first — quick wins.' },
  { id: 'hybrid', name: 'Hybrid', desc: 'Credit cards first by APR, then loans.' },
]

export function OptimizerPage() {
  const { data, privacy } = usePortfolio()
  const { success } = useToasts()
  const [strategy, setStrategy] = useState<DebtStrategy>('avalanche')
  const [extra, setExtra] = useState(500)

  const result = useMemo(
    () => simulateDebt(data.creditCards, data.loans, strategy, extra),
    [data.creditCards, data.loans, strategy, extra],
  )

  const minOnly = useMemo(
    () => simulateDebt(data.creditCards, data.loans, strategy, 0),
    [data.creditCards, data.loans, strategy],
  )

  const monthsSaved = Math.max(0, minOnly.months - result.months)
  const interestSaved = Math.max(0, minOnly.totalInt - result.totalInt)

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Debt optimizer"
        description="Avalanche, snowball, or hybrid payoff strategies with extra monthly payments."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px mb-8">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStrategy(s.id)}
            className={`surface p-6 text-left border ${
              strategy === s.id ? 'border-accent' : 'border-transparent'
            }`}
          >
            <p className="eyebrow mb-2">{s.id}</p>
            <h3 className="font-bold mb-2">{s.name}</h3>
            <p className="text-sm text-text-muted font-light">{s.desc}</p>
          </button>
        ))}
      </div>

      <div className="surface p-6 sm:p-8 mb-px">
        <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
          Extra monthly payment: {formatGBP(extra)}
        </label>
        <input
          type="range"
          className="range-accent"
          min={0}
          max={3000}
          step={50}
          value={extra}
          onChange={(e) => setExtra(Number(e.target.value))}
        />
        <p className="mt-3 text-sm text-text-subtle">
          Base minimums {formatGBP(result.baseMin)} / mo · Total payment{' '}
          {formatGBP(result.baseMin + extra)} / mo
        </p>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Payoff</p>
          <p className="text-2xl font-bold">{result.months} mo</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Total interest</p>
          <p className="text-2xl font-bold">{formatGBP(result.totalInt)}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Months saved</p>
          <p className="text-2xl font-bold text-accent">{monthsSaved}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Interest saved</p>
          <p className="text-2xl font-bold text-accent">{formatGBP(interestSaved)}</p>
        </div>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              {['Month', 'Payment', 'Principal', 'Interest', 'Remaining', 'Payoffs'].map((h) => (
                <th key={h} className="px-5 py-4 label-uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.schedule.slice(0, 36).map((m) => (
              <tr key={m.month} className="border-b border-border last:border-0">
                <td className="px-5 py-3 text-sm">{m.month}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{formatGBP(m.payment)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{formatGBP(m.principal)}</td>
                <td className="px-5 py-3 text-sm tabular-nums">{formatGBP(m.interest)}</td>
                <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                  {formatGBP(m.remaining)}
                </td>
                <td className="px-5 py-3 text-sm text-accent">{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.schedule.length > 36 && (
          <p className="px-5 py-4 text-sm text-text-subtle">
            Showing first 36 of {result.schedule.length} months.
          </p>
        )}
      </div>

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary optimizer actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/liabilities" className="btn-secondary btn-sm">
          Liabilities
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
