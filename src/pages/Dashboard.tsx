import { Link } from 'react-router-dom'
import { ArrowRight, CandlestickChart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GettingStartedChecklist } from '../components/GettingStartedChecklist'
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
import { isDueToday, isOverdue } from '../domain/todos'
import {
  getAutoSyncStatus,
  subscribeAutoSync,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'
import { loadOfflineQueue } from '../services/offlineQueue'
import { listMarketTickers, loadMarketQuotesCache } from '../storage/marketsStore'
import { buildPriceAlertNotifications } from '../domain/priceAlerts'
import { formatDate, formatGBP, formatPct, privacyClass } from '../utils/format'

const ALERT_BORDER: Record<string, string> = {
  red: 'border-l-[var(--text-subtle)]',
  amber: 'border-l-accent',
  green: 'border-l-accent',
  info: 'border-l-border-strong',
}

const QUICK_PRIMARY = { to: '/markets', label: 'Markets', icon: CandlestickChart }
const QUICK_SECONDARY = [
  { to: '/todos', label: 'To Do' },
  { to: '/liabilities', label: 'Liabilities' },
  { to: '/goals', label: 'Goals' },
] as const

export function Dashboard() {
  const { data, breakdown, privacy, fccDataPresent, setData, goalProgress } = usePortfolio()
  const { netWorth, assets, liabilities, crypto, equity, liability } = breakdown
  const { reminders } = useSmartReminders()
  const [syncStatus, setSyncStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)

  useEffect(() => subscribeAutoSync(setSyncStatus), [])
  useEffect(() => {
    const refresh = () => setQueueLen(loadOfflineQueue().length)
    window.addEventListener('mydsp-offline-queue', refresh)
    return () => window.removeEventListener('mydsp-offline-queue', refresh)
  }, [])

  const todayTodos = useMemo(() => {
    return (data.todoItems ?? [])
      .filter((t) => t.status !== 'done' && t.status !== 'archived')
      .filter((t) => isDueToday(t) || isOverdue(t))
      .slice(0, 4)
  }, [data.todoItems])

  const marketsCount = useMemo(() => listMarketTickers().length, [syncStatus.lastAt])

  const todayMovers = useMemo(() => {
    const quotes = loadMarketQuotesCache()
    const tickers = listMarketTickers()
    return tickers
      .map((t) => {
        const q = quotes.get(t.id)
        if (!q || !(q.last > 0) || !Number.isFinite(q.changePct)) return null
        return { id: t.id, symbol: t.symbol, changePct: q.changePct }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 3)
  }, [syncStatus.lastAt, marketsCount])

  const todayPriceAlerts = useMemo(() => buildPriceAlertNotifications().slice(0, 2), [syncStatus.lastAt, marketsCount])

  const syncCfg = loadSyncConfig()
  const syncEnabled = Boolean(syncCfg.enabled && syncCfg.remoteUrl.trim())

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

  const syncLine = !syncEnabled
    ? 'Cloud sync off — enable in Settings'
    : syncStatus.state === 'pulling' || syncStatus.state === 'pushing'
      ? syncStatus.state === 'pulling'
        ? 'Syncing from other devices…'
        : 'Pushing local changes…'
      : queueLen > 0
        ? `${queueLen} change(s) queued offline`
        : syncStatus.lastAt
          ? `Last sync ${new Date(syncStatus.lastAt).toLocaleString()}`
          : 'Ready to sync'

  return (
    <div className="pb-8 md:pb-0">
      <PageHeader
        eyebrow="MyDSP"
        title="Today"
        description="Net worth, tasks due now, sync health, and Markets — act first, explore below."
        action={
          <Link to="/settings#sync" className="btn-secondary btn-sm inline-flex">
            Cloud Sync <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        }
      />

      {/* First viewport: one composition — brand pulse + act */}
      <div className={`surface p-5 md:p-6 mb-4 rounded-xl md:rounded-none shadow-sm md:shadow-none ${privacyClass(privacy)}`}>
        <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Net worth</p>
        <p className="text-3xl md:text-4xl font-bold tabular-nums tracking-tight mb-1 break-words">
          {formatGBP(netWorth)}
        </p>
        <p className="text-sm text-text-muted font-light mb-4">
          Assets {formatGBP(assets)} · Debt {formatGBP(liabilities)}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-subtle">
          <span>{syncLine}</span>
          <Link to="/markets" className="hover:text-accent">
            {marketsCount} Markets ticker{marketsCount === 1 ? '' : 's'} →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold">Due today</p>
            <Link to="/todos" className="text-xs text-accent font-semibold">
              All todos
            </Link>
          </div>
          {todayTodos.length === 0 ? (
            <p className="text-sm text-text-muted font-light">Nothing due — clear day.</p>
          ) : (
            <ul className="space-y-2">
              {todayTodos.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/todos?focus=${t.id}`}
                    className="text-sm font-medium text-text hover:text-accent line-clamp-1"
                  >
                    {isOverdue(t) ? 'Overdue · ' : ''}
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold">Jump in</p>
          </div>
          {todayPriceAlerts.length > 0 ? (
            <ul className="space-y-1.5 mb-3">
              {todayPriceAlerts.map((a) => (
                <li key={a.id}>
                  <Link to={a.actionUrl ?? '/markets'} className="text-sm font-medium text-accent hover:underline line-clamp-1">
                    Alert · {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {todayMovers.length > 0 ? (
            <ul className="space-y-1.5 mb-3">
              {todayMovers.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/markets?symbol=${encodeURIComponent(m.symbol)}`}
                    className="text-sm text-text hover:text-accent inline-flex items-center gap-2"
                  >
                    <span className="font-semibold">{m.symbol}</span>
                    <span className={m.changePct >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {m.changePct >= 0 ? '+' : ''}
                      {m.changePct.toFixed(2)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={QUICK_PRIMARY.to}
              className="btn-primary btn-sm inline-flex items-center gap-2"
            >
              <QUICK_PRIMARY.icon size={16} strokeWidth={1.5} /> {QUICK_PRIMARY.label}
            </Link>
            {QUICK_SECONDARY.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-semibold text-accent hover:underline"
              >
                {l.label} →
              </Link>
            ))}
          </div>
          {fccDataPresent ? null : (
            <p className="text-xs text-text-subtle mt-3 font-light">
              Sample portfolio — import live data in Settings anytime.
            </p>
          )}
        </div>
      </div>

      <GettingStartedChecklist />

      {/* Secondary stats — Assets / Debt / allocation (net worth lives in Today pulse above) */}
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-px mb-6 ${privacyClass(privacy)}`}>
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
