import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, Target, Landmark, ListChecks } from 'lucide-react'
import { useMemo } from 'react'
import { AllocationRing } from '../components/charts/AllocationRing'
import { BudgetSparkline } from '../components/charts/BudgetSparkline'
import { NetWorthChart } from '../components/charts/NetWorthChart'
import { PageHeader } from '../components/ui/PageHeader'
import { RemindersPanel, useSmartReminders } from '../components/SmartReminders'
import { PortfolioShareCard } from '../components/SocialShare'
import { usePortfolio } from '../context/PortfolioContext'
import { evaluateAchievements } from '../domain/achievements'
import { buildAlerts } from '../domain/alerts'
import { worstBudgetOffenders } from '../domain/budgetChart'
import { appendManualSnapshot } from '../domain/history'
import { formatDate, formatGBP, formatPct, privacyClass } from '../utils/format'

const ALERT_BORDER: Record<string, string> = {
  red: 'border-l-[var(--text-subtle)]',
  amber: 'border-l-accent',
  green: 'border-l-accent',
  info: 'border-l-border-strong',
}

const QUICK_LINKS = [
  { to: '/liabilities', label: 'Liabilities', icon: Landmark },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/budgets', label: 'Budgets', icon: ListChecks },
  { to: '/settings#sync', label: 'Sync settings', icon: RefreshCw },
]

export function Dashboard() {
  const { data, breakdown, privacy, fccDataPresent, setData, goalProgress } = usePortfolio()
  const { netWorth, assets, liabilities, crypto, equity, liability } = breakdown
  const { reminders } = useSmartReminders()

  const recentJournal = [...(data.journal ?? [])]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 5)
  const recentSpend = [...(data.spending ?? [])]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 5)

  const achievements = useMemo(
    () => evaluateAchievements({ data, breakdown, goalProgress }),
    [data, breakdown, goalProgress],
  )

  const alerts = useMemo(() => buildAlerts(data), [data])

  const budgetPulse = useMemo(
    () => worstBudgetOffenders(data.spending, data.budgetGoals).slice(0, 3),
    [data.spending, data.budgetGoals],
  )

  const onSnapshot = () => {
    setData((prev) => appendManualSnapshot(prev))
  }

  return (
    <div className="pb-8 md:pb-0">
      <PageHeader
        eyebrow="Net worth"
        title="Financial overview"
        description={
          fccDataPresent
            ? 'Live portfolio data loaded from your FCC storage (dfc_data_v3).'
            : 'Showing FCC sample portfolio. Import your live FCC backup in Settings anytime.'
        }
        action={
          <Link to="/settings#sync" className="btn-secondary btn-sm inline-flex">
            Cloud Sync <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        }
      />

      {/* Mobile: Stacked stat cards with better spacing */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-px mb-6 ${privacyClass(privacy)}`}>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 md:mb-1 font-semibold">Net worth</p>
          <p className="text-2xl md:text-2xl font-bold tabular-nums mb-1 break-words">{formatGBP(netWorth)}</p>
          <p className="text-xs text-text-muted font-light leading-tight">Assets − debt</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 md:mb-1 font-semibold">Assets</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums mb-1 break-words">{formatGBP(assets)}</p>
          <p className="text-xs text-text-muted font-light leading-tight">Crypto + Equity</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 md:mb-1 font-semibold">Debt</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums mb-1 text-text-muted break-words">{formatGBP(liabilities)}</p>
          <p className="text-xs text-text-muted font-light leading-tight">Total owed</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 md:mb-1 font-semibold">Monthly</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums mb-1 break-words">{formatGBP(liability.monthly)}</p>
          <p className="text-xs text-text-muted font-light leading-tight">Min payments</p>
        </div>
      </div>

      {/* Alerts - mobile optimized */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:gap-px mb-6">
          {alerts.slice(0, 3).map((a) => (
            <Link
              key={a.id}
              to={a.to}
              className={`surface surface-interactive p-4 md:px-5 md:py-4 border-l-4 md:border-l-2 block rounded-r-xl md:rounded-none shadow-sm md:shadow-none ${ALERT_BORDER[a.severity] ?? 'border-l-border-strong'}`}
            >
              <p className="text-sm font-semibold uppercase tracking-wider mb-1">{a.title}</p>
              <p className="text-sm text-text-muted font-light leading-snug">{a.detail}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Quick links - horizontal scroll on mobile */}
      <div className="flex gap-2 mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0 scrollbar-hide">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="btn-ghost btn-sm inline-flex items-center gap-2 whitespace-nowrap flex-shrink-0"
          >
            <l.icon size={16} strokeWidth={1.5} /> {l.label}
          </Link>
        ))}
      </div>

      {/* Smart Reminders */}
      {reminders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="label-uppercase mb-1">Smart Reminders</p>
              <p className="text-sm text-text-muted font-light">
                {reminders.length} item{reminders.length !== 1 ? 's' : ''} need your attention
              </p>
            </div>
          </div>
          <RemindersPanel />
        </div>
      )}

      {budgetPulse.length > 0 && (
        <div className="surface p-5 md:p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Budget pulse</p>
              <p className="text-sm text-text-muted font-light leading-snug">
                Worst category utilisation this month
              </p>
            </div>
            <Link to="/budgets" className="btn-ghost btn-sm flex-shrink-0">
              Budgets <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
            {budgetPulse.map((b) => (
              <div key={b.category} className="pb-4 border-b border-border md:pb-0 md:border-0 last:pb-0 last:border-0">
                <div className="flex justify-between text-sm mb-2">
                  <Link
                    to={`/spending?category=${encodeURIComponent(b.category)}`}
                    className="uppercase tracking-wider text-xs font-bold text-text-subtle hover:text-accent"
                  >
                    {b.category}
                  </Link>
                  <span className={`tabular-nums font-semibold ${privacyClass(privacy)}`}>
                    {Math.round(b.ratio * 100)}%
                  </span>
                </div>
                <BudgetSparkline
                  spending={data.spending}
                  category={b.category}
                  limit={b.limit}
                  privacy={privacy}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asset allocation and net worth chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-px mb-6">
        <div className="surface p-5 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <AllocationRing
            data={[
              { name: 'Crypto', value: crypto.value },
              { name: 'Equities', value: equity.value },
            ].filter((s) => s.value > 0)}
            privacy={privacy}
            eyebrow="Mix"
            title="Assets"
            donut
          />
        </div>
        <div className="lg:col-span-2 surface p-5 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <NetWorthChart history={data.history} privacy={privacy} onSnapshot={onSnapshot} />
        </div>
      </div>

      {/* Score, Level, Debt cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-px mb-6">
        <Link to="/achievements" className="surface surface-interactive p-5 md:p-8 block rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Financial score</p>
          <p className={`text-3xl md:text-2xl font-bold tabular-nums mb-1 ${privacyClass(privacy)}`}>
            {achievements.score}
          </p>
          <p className="text-xs text-text-subtle font-light">0–1000 composite</p>
        </Link>
        <Link to="/achievements" className="surface surface-interactive p-5 md:p-8 block rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Level</p>
          <p className={`text-3xl md:text-2xl font-bold tabular-nums mb-1 ${privacyClass(privacy)}`}>
            L{achievements.level}
          </p>
          <p className="text-xs text-accent font-light">
            {achievements.xp} XP · {achievements.unlocked.length} unlocked
          </p>
        </Link>
        <Link to="/liabilities" className="surface surface-interactive p-5 md:p-8 block rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Debt</p>
          <p className={`text-3xl md:text-2xl font-bold tabular-nums mb-1 ${privacyClass(privacy)}`}>
            {formatGBP(liabilities)}
          </p>
          <p className="text-xs text-text-subtle font-light">
            {data.creditCards.length} cards · {data.loans.length} loans
          </p>
        </Link>
      </div>

      {/* Crypto and Equities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-px mb-6">
        <Link to="/crypto" className="surface surface-interactive p-5 md:p-8 block rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Crypto</p>
          <p className={`text-3xl md:text-2xl font-bold tabular-nums mb-1 ${privacyClass(privacy)}`}>
            {formatGBP(crypto.value)}
          </p>
          <p className={`text-sm font-light ${crypto.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
            {formatPct(crypto.pct)} P&amp;L
          </p>
        </Link>
        <Link to="/equities" className="surface surface-interactive p-5 md:p-8 block rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Equities</p>
          <p className={`text-3xl md:text-2xl font-bold tabular-nums mb-1 ${privacyClass(privacy)}`}>
            {formatGBP(equity.value)}
          </p>
          <p className={`text-sm font-light ${equity.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
            {formatPct(equity.pct)} P&amp;L
          </p>
        </Link>
      </div>

      {/* Share Card */}
      <div className="mb-8">
        <PortfolioShareCard
          data={{
            netWorth,
            monthlyGrowth: (crypto.pct + equity.pct) / 2,
            portfolioSize: data.crypto.length + data.equities.length,
          }}
        />
      </div>

      {/* Recent Activity */}
      <div className="surface p-5 md:p-8 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Recent</p>
          <h3 className="text-lg font-bold tracking-tight">Activity</h3>
        </div>
        {recentJournal.length === 0 && recentSpend.length === 0 ? (
          <p className="text-sm text-text-muted font-light py-4">
            No journal or spending entries yet. Import a bank CSV or add spending to get started.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentJournal.map((j) => (
              <li key={`j-${j.id}`} className="py-3.5 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {j.type} {j.asset}
                  </p>
                  <p className="text-xs text-text-subtle mt-1">{formatDate(j.date)}</p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${privacyClass(privacy)}`}>
                  {formatGBP(j.total)}
                </p>
              </li>
            ))}
            {recentSpend.map((s) => (
              <li key={`s-${s.id}`} className="py-3.5 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.description}</p>
                  <p className="text-xs text-text-subtle mt-1">
                    {formatDate(s.date)} · {s.category}
                  </p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${privacyClass(privacy)}`}>
                  {formatGBP(-Math.abs(s.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
