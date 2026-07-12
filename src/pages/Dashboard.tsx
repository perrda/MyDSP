import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, Target, Landmark, ListChecks } from 'lucide-react'
import { useMemo } from 'react'
import { AllocationRing } from '../components/charts/AllocationRing'
import { BudgetSparkline } from '../components/charts/BudgetSparkline'
import { NetWorthChart } from '../components/charts/NetWorthChart'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { RemindersPanel, useSmartReminders } from '../components/SmartReminders'
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

  const recentJournal = [...data.journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const recentSpend = [...data.spending].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

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
    <div>
      <PageHeader
        eyebrow="Net worth"
        title="Financial overview"
        description={
          fccDataPresent
            ? 'Live portfolio data loaded from your FCC storage (dfc_data_v3).'
            : 'Showing FCC sample portfolio. Import your live FCC backup in Settings anytime.'
        }
        action={
          <Link to="/settings" className="btn-secondary btn-sm">
            Data & settings <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px mb-4">
        {alerts.slice(0, 4).map((a) => (
          <Link
            key={a.id}
            to={a.to}
            className={`surface surface-interactive px-5 py-4 border-l-2 block ${ALERT_BORDER[a.severity] ?? 'border-l-border-strong'}`}
          >
            <p className="text-sm font-semibold uppercase tracking-wider">{a.title}</p>
            <p className="text-sm text-text-muted mt-1 font-light">{a.detail}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="btn-ghost btn-sm inline-flex items-center gap-1.5">
            <l.icon size={14} strokeWidth={1.5} /> {l.label}
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
        <div className="surface p-5 sm:p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="label-uppercase mb-1">Budget pulse</p>
              <p className="text-sm text-text-muted font-light">
                Worst category utilisation this month
              </p>
            </div>
            <Link to="/budgets" className="btn-ghost btn-sm">
              Budgets <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {budgetPulse.map((b) => (
              <div key={b.category}>
                <div className="flex justify-between text-sm mb-1">
                  <Link
                    to={`/spending?category=${encodeURIComponent(b.category)}`}
                    className="uppercase tracking-wider text-xs font-bold text-text-subtle hover:text-accent"
                  >
                    {b.category}
                  </Link>
                  <span className={`tabular-nums ${privacyClass(privacy)}`}>
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

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
        <StatCard label="Net worth" value={formatGBP(netWorth)} hint="Assets − liabilities" />
        <StatCard
          label="Total assets"
          value={formatGBP(assets)}
          hint={`Crypto ${formatGBP(crypto.value)} · Equity ${formatGBP(equity.value)}`}
        />
        <StatCard
          label="Liabilities"
          value={formatGBP(liabilities)}
          hint={`CC ${formatGBP(liability.cc)} · Loans ${formatGBP(liability.loans)}`}
          tone="negative"
        />
        <StatCard
          label="Monthly debt service"
          value={formatGBP(liability.monthly)}
          hint="Min payments (CC + loans)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px mb-8">
        <AllocationRing
          className="lg:col-span-1"
          data={[
            { name: 'Crypto', value: crypto.value },
            { name: 'Equities', value: equity.value },
          ].filter((s) => s.value > 0)}
          privacy={privacy}
          eyebrow="Mix"
          title="Assets"
          donut
        />
        <div className="lg:col-span-2">
          <NetWorthChart history={data.history} privacy={privacy} onSnapshot={onSnapshot} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px mb-8">
        <Link to="/achievements" className="surface surface-interactive p-6 sm:p-8 block">
          <p className="label-uppercase mb-2">Financial score</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            {achievements.score}
          </p>
          <p className="mt-2 text-sm text-text-subtle font-light">0–1000 composite</p>
        </Link>
        <Link to="/achievements" className="surface surface-interactive p-6 sm:p-8 block">
          <p className="label-uppercase mb-2">Level</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            L{achievements.level}
          </p>
          <p className="mt-2 text-sm text-accent font-light">
            {achievements.xp} XP · {achievements.unlocked.length} unlocked
          </p>
        </Link>
        <Link to="/liabilities" className="surface surface-interactive p-6 sm:p-8 block">
          <p className="label-uppercase mb-2">Debt</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            {formatGBP(liabilities)}
          </p>
          <p className="mt-2 text-sm text-text-subtle font-light">
            {data.creditCards.length} cards · {data.loans.length} loans
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px mb-8">
        <Link to="/crypto" className="surface surface-interactive p-6 sm:p-8 block">
          <p className="label-uppercase mb-2">Crypto</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            {formatGBP(crypto.value)}
          </p>
          <p className={`mt-2 text-sm font-light ${crypto.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
            {formatPct(crypto.pct)} P&amp;L
          </p>
        </Link>
        <Link to="/equities" className="surface surface-interactive p-6 sm:p-8 block">
          <p className="label-uppercase mb-2">Equities</p>
          <p className={`text-2xl font-bold tabular-nums ${privacyClass(privacy)}`}>
            {formatGBP(equity.value)}
          </p>
          <p className={`mt-2 text-sm font-light ${equity.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
            {formatPct(equity.pct)} P&amp;L
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-px">
        <div className="surface p-6 sm:p-8 lg:col-span-2 lg:col-start-4">
          <p className="label-uppercase mb-2">Recent</p>
          <h3 className="text-lg font-bold tracking-tight mb-6">Activity</h3>
          {recentJournal.length === 0 && recentSpend.length === 0 ? (
            <p className="text-sm text-text-subtle font-light">
              No journal or spending entries yet. Import from FCC or add data as features land.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentJournal.map((j) => (
                <li key={`j-${j.id}`} className="py-3 flex justify-between gap-3">
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
                <li key={`s-${s.id}`} className="py-3 flex justify-between gap-3">
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
    </div>
  )
}
