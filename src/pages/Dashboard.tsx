import { Link } from 'react-router-dom'
import { ArrowRight, CandlestickChart, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { GettingStartedChecklist } from '../components/GettingStartedChecklist'
import { AllocationRing, NetWorthChart } from '../components/charts/LazyCharts'
import { BudgetSparkline } from '../components/charts/BudgetSparkline'
import { Sparkline } from '../components/charts/Sparkline'
import { SwipeBillRow } from '../components/ui/SwipeBillRow'
import { PageHeader } from '../components/ui/PageHeader'
import { RemindersPanel, useSmartReminders } from '../components/SmartReminders'
import { PortfolioShareCard } from '../components/SocialShare'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { evaluateAchievements } from '../domain/achievements'
import { buildAlerts } from '../domain/alerts'
import { worstBudgetOffenders } from '../domain/budgetChart'
import { calcFire } from '../domain/fire'
import { appendManualSnapshot } from '../domain/history'
import { nearestGoalProjection, formatGoalProjectionLine } from '../domain/goalProjectedDate'
import { formatMoneyPulseLine, moneyPulseDelta } from '../domain/moneyPulse'
import {
  buildNextActionStack,
  stackIncludesBill,
} from '../domain/nextActionStack'
import { ensureFinnhubSetupTodo } from '../domain/finnhubReminder'
import {
  netWorthSparkSeries,
  type NwSparkWindow,
} from '../domain/netWorthSparkline'
import { dueWithinDays } from '../domain/recurringDueStrip'
import { markRecurringPaid, skipRecurringOccurrence } from '../domain/recurringActions'
import { monthlyRecurringTotal } from '../domain/recurringHelpers'
import { isDueToday, isOverdue } from '../domain/todos'
import { snoozeDueDateOneDay } from '../domain/todoSnooze'
import { sparklineTrendFromSeries } from '../domain/sparklineSeries'
import {
  getAutoSyncStatus,
  getLastSyncLatencyKind,
  subscribeAutoSync,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'
import { loadOfflineQueue } from '../services/offlineQueue'
import { LAST_BACKUP_KEY } from '../storage/backupStore'
import { listMarketTickers, loadMarketQuotesCache } from '../storage/marketsStore'
import {
  getUiPanelOpenState,
  setUiPanelOpen,
  subscribeUiPanels,
} from '../storage/uiPanelsStore'
import { buildPriceAlertNotifications } from '../domain/priceAlerts'
import { formatDate, formatGBP, formatPct, privacyClass } from '../utils/format'
import {
  weekDeltaFromHistory,
  type WeeklyDigestInput,
} from '../domain/weeklyDigest'
import { WeeklyDigestModal } from '../components/WeeklyDigestModal'

function formatSyncLatencyMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${Math.round(ms / 1000)}s`
}

const ALERT_BORDER: Record<string, string> = {
  red: 'border-l-[var(--text-subtle)]',
  amber: 'border-l-accent',
  green: 'border-l-accent',
  info: 'border-l-border-strong',
}

const QUICK_PRIMARY = { to: '/markets', label: 'Markets', icon: CandlestickChart }
const QUICK_SECONDARY = [
  { to: '/todos', label: "To Do's" },
  { to: '/liabilities', label: 'Liabilities' },
  { to: '/goals', label: 'Goals' },
] as const

const ISA_ALLOWANCE_GBP = 20_000
const ISA_REMAINING_KEY = 'mydsp_isa_remaining_gbp'
const ISA_LOW_REMAINING_THRESHOLD_GBP = 2_000

function weekStartKey(now = new Date()): string {
  const d = new Date(now)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function loadIsaRemaining(): number | null {
  try {
    const raw = localStorage.getItem(ISA_REMAINING_KEY)
    if (!raw?.trim()) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.max(0, Math.min(ISA_ALLOWANCE_GBP, n))
  } catch {
    return null
  }
}

type TodayPanelId = 'today-next-action' | 'today-bills' | 'today-goals'

const TODAY_ACCORDION_QUERY = '(max-width: 639px), (orientation: portrait) and (max-width: 1023px)'

function readTodayPanelOpen(id: TodayPanelId, fallback: boolean): boolean {
  return getUiPanelOpenState(id) ?? fallback
}

function useTodayAccordionEnabled(): boolean {
  const [enabled, setEnabled] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(TODAY_ACCORDION_QUERY).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(TODAY_ACCORDION_QUERY)
    const sync = () => setEnabled(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return enabled
}

function TodayAccordionSection({
  id,
  title,
  action,
  enabled,
  defaultOpen = true,
  className = '',
  ariaLabel,
  children,
}: {
  id: TodayPanelId
  title: string
  action?: ReactNode
  enabled: boolean
  defaultOpen?: boolean
  className?: string
  ariaLabel?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => readTodayPanelOpen(id, defaultOpen))

  useEffect(
    () => subscribeUiPanels(() => setOpen(readTodayPanelOpen(id, defaultOpen))),
    [id, defaultOpen],
  )

  const expanded = enabled ? open : true
  const toggle = () => {
    if (!enabled) return
    const next = !open
    setOpen(next)
    setUiPanelOpen(id, next)
  }

  return (
    <section className={`today-accordion-section ${className}`} aria-label={ariaLabel}>
      <div className="today-accordion-header flex items-center justify-between gap-3 px-0.5 mb-2">
        <button
          type="button"
          className="today-accordion-toggle flex min-w-0 items-center gap-1.5 text-left"
          aria-expanded={expanded}
          aria-controls={`${id}-panel`}
          onClick={toggle}
        >
          <span className="text-xs uppercase tracking-wider text-text-subtle font-semibold">
            {title}
          </span>
          <span className="today-accordion-icon text-text-subtle" aria-hidden>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {action}
      </div>
      {expanded ? (
        <div id={`${id}-panel`} className="today-accordion-panel">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function Dashboard() {
  const { data, breakdown, privacy, fccDataPresent, setData, goalProgress } = usePortfolio()
  const { netWorth, assets, liabilities, crypto, equity, liability } = breakdown
  const { reminders } = useSmartReminders()
  const { success: toastSuccess } = useToasts()
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestInput, setDigestInput] = useState<WeeklyDigestInput | null>(null)
  const [syncStatus, setSyncStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)
  const [nwSparkDays, setNwSparkDays] = useState<NwSparkWindow>(7)
  /** iPad / wide Stage Manager: Today | Markets two-pane when ≥900px. */
  const [twoPane, setTwoPane] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 900px)').matches : false,
  )
  const todayAccordionEnabled = useTodayAccordionEnabled()

  useEffect(() => subscribeAutoSync(setSyncStatus), [])
  useEffect(() => {
    const refresh = () => setQueueLen(loadOfflineQueue().length)
    window.addEventListener('mydsp-offline-queue', refresh)
    return () => window.removeEventListener('mydsp-offline-queue', refresh)
  }, [])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const sync = () => setTwoPane(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  /** High-priority Finnhub API key reminder — once per browser session when no key. */
  useEffect(() => {
    try {
      if (sessionStorage.getItem('mydsp_finnhub_todo_prompted') === '1') return
      sessionStorage.setItem('mydsp_finnhub_todo_prompted', '1')
    } catch {
      /* ignore */
    }
    setData((prev) => ensureFinnhubSetupTodo(prev) ?? prev)
  }, [setData])

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

  /** Next-action stack: todo / bill / top mover (max 3). */
  const nextActions = useMemo(
    () =>
      buildNextActionStack({
        todoItems: data.todoItems,
        recurringTransactions: data.recurringTransactions,
        movers: todayMovers,
      }),
    [data.todoItems, data.recurringTransactions, todayMovers],
  )

  const focusTodoCard = nextActions.find((c) => c.kind === 'todo')
  const focusTodoItem = focusTodoCard?.kind === 'todo' ? focusTodoCard.todo : null

  const todayPriceAlerts = useMemo(() => buildPriceAlertNotifications().slice(0, 2), [syncStatus.lastAt, marketsCount])

  const syncCfg = loadSyncConfig()
  const syncEnabled = Boolean(syncCfg.enabled && syncCfg.remoteUrl.trim())

  const showBackupNudge = useMemo(() => {
    try {
      const last = localStorage.getItem(LAST_BACKUP_KEY)
      if (!last) return true
      const then = Date.parse(`${last}T00:00:00Z`)
      if (!Number.isFinite(then)) return true
      return Date.now() - then > 7 * 24 * 60 * 60 * 1000
    } catch {
      return false
    }
  }, [syncStatus.lastAt])

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

  const monthlyBudgetPulse = useMemo(() => {
    const totalBudget = Object.values(data.budgetGoals ?? {})
      .filter((v) => v > 0)
      .reduce((sum, v) => sum + v, 0)
    if (!(totalBudget > 0)) return null
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const spent = (data.spending ?? [])
      .filter((s) => (s.date ?? '').startsWith(ym))
      .reduce((sum, s) => sum + Math.abs(s.amount), 0)
    return {
      spent,
      totalBudget,
      ratio: totalBudget > 0 ? spent / totalBudget : 0,
    }
  }, [data.spending, data.budgetGoals])

  const weekToDateSpend = useMemo(() => {
    const start = weekStartKey()
    const spent = (data.spending ?? [])
      .filter((s) => (s.date ?? '').slice(0, 10) >= start)
      .reduce((sum, s) => sum + Math.abs(s.amount), 0)
    return { spent, start }
  }, [data.spending])

  const cashRunway = useMemo(() => {
    const monthlyRecurring = monthlyRecurringTotal(data.recurringTransactions ?? [])
    if (!(monthlyRecurring > 0)) return null
    const liquidishNetWorth = Math.max(0, assets - liabilities)
    return {
      months: liquidishNetWorth / monthlyRecurring,
      monthlyRecurring,
      liquidishNetWorth,
    }
  }, [data.recurringTransactions, assets, liabilities])

  const fireChip = useMemo(() => {
    if (!data.fireInputs) return null
    return calcFire(netWorth, data.fireInputs, 'regular')
  }, [data.fireInputs, netWorth])

  const isaRemainingLow = (() => {
    const remaining = loadIsaRemaining()
    if (remaining == null || remaining >= ISA_LOW_REMAINING_THRESHOLD_GBP) return null
    return remaining
  })()

  const digestHighlights = useMemo(() => {
    const lines = [
      todayTodos.length
        ? `${todayTodos.length} To Do${todayTodos.length === 1 ? '' : "'s"} due today`
        : "No To Do's due today",
      todayMovers[0]
        ? `Top mover ${todayMovers[0].symbol} ${formatPct(todayMovers[0].changePct)}`
        : 'No Markets movers cached',
    ]
    if (monthlyBudgetPulse) {
      lines.push(
        `Budget pulse ${formatGBP(monthlyBudgetPulse.spent)} / ${formatGBP(monthlyBudgetPulse.totalBudget)} (${Math.round(monthlyBudgetPulse.ratio * 100)}% used)`,
      )
    }
    if (weekToDateSpend.spent > 0) {
      lines.push(`Week-to-date spend ${formatGBP(weekToDateSpend.spent)}`)
    }
    if (cashRunway) {
      lines.push(
        `Cash runway ${cashRunway.months >= 99 ? '99+' : cashRunway.months.toFixed(cashRunway.months < 10 ? 1 : 0)} months`,
      )
    }
    if (fireChip) {
      lines.push(`FIRE ${Math.round(fireChip.progress)}% of target · age ${fireChip.ageAtFire}`)
    }
    if (isaRemainingLow != null) {
      lines.push(`ISA remaining low: ${formatGBP(isaRemainingLow)} left this tax year`)
    }
    return lines
  }, [
    cashRunway,
    fireChip,
    isaRemainingLow,
    monthlyBudgetPulse,
    todayMovers,
    todayTodos.length,
    weekToDateSpend.spent,
  ])

  const openWeeklyDigest = () => {
    setDigestInput({
      title: 'MyDSP weekly digest',
      netWorth,
      assets,
      liabilities,
      crypto: crypto.value,
      equity: equity.value,
      weekDelta: weekDeltaFromHistory(data.history ?? [], netWorth),
      privacy,
      highlights: digestHighlights,
    })
    setDigestOpen(true)
  }

  useEffect(() => {
    const open = () => openWeeklyDigest()
    window.addEventListener('mydsp-open-weekly-digest', open)
    return () => window.removeEventListener('mydsp-open-weekly-digest', open)
  })

  const onSnapshot = () => {
    setData((prev) => appendManualSnapshot(prev))
  }

  const markFocusDone = () => {
    if (!focusTodoItem) return
    const now = new Date().toISOString()
    const id = focusTodoItem.id
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === id
          ? { ...i, status: 'done' as const, completedAt: now, updatedAt: now }
          : i,
      ),
    }))
  }

  const snoozeFocus = () => {
    if (!focusTodoItem) return
    const dueDate = snoozeDueDateOneDay(focusTodoItem.dueDate)
    const now = new Date().toISOString()
    const id = focusTodoItem.id
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === id ? { ...i, dueDate, updatedAt: now } : i,
      ),
    }))
  }

  const markBillPaid = (id: number) => {
    setData((prev) => markRecurringPaid(prev, id))
  }

  const skipBill = (id: number) => {
    setData((prev) => skipRecurringOccurrence(prev, id))
  }

  /** Soonest active goal with deadline within 30 days (inclusive). */
  const soonGoal = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const horizon = new Date(now)
    horizon.setDate(horizon.getDate() + 30)
    let best: (typeof data.goals)[number] | null = null
    let bestDays = Infinity
    for (const g of data.goals ?? []) {
      if (!g.deadline) continue
      const dl = new Date(`${g.deadline.slice(0, 10)}T00:00:00`)
      if (!Number.isFinite(dl.getTime())) continue
      if (dl < now || dl > horizon) continue
      const days = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < bestDays) {
        bestDays = days
        best = g
      }
    }
    return best
  }, [data.goals])

  const soonGoalProgress = soonGoal ? goalProgress(soonGoal) : 0

  const moneyPulse = useMemo(() => {
    const hit = moneyPulseDelta(data.history, netWorth)
    if (!hit) return null
    return formatMoneyPulseLine(hit.delta, formatGBP)
  }, [data.history, netWorth])

  const nwSpark = useMemo(
    () => netWorthSparkSeries(data.history, netWorth, nwSparkDays),
    [data.history, netWorth, nwSparkDays],
  )
  const nwSparkTrend = useMemo(() => sparklineTrendFromSeries(nwSpark), [nwSpark])

  const billsDueSoon = useMemo(
    () => dueWithinDays(data.recurringTransactions, 7).slice(0, 4),
    [data.recurringTransactions],
  )
  /** Hide longer bills strip when next bill already sits in the action stack. */
  const showBillsStrip = billsDueSoon.length > 1 && stackIncludesBill(nextActions)
    ? billsDueSoon.slice(1)
    : stackIncludesBill(nextActions)
      ? []
      : billsDueSoon

  const goalProjection = useMemo(() => nearestGoalProjection(data), [data])

  const syncLine = !syncEnabled
    ? 'Cloud sync off — enable in Settings'
    : syncStatus.state === 'pulling' || syncStatus.state === 'pushing'
      ? syncStatus.state === 'pulling'
        ? 'Syncing from other devices…'
        : 'Pushing local changes…'
      : queueLen > 0
        ? `${queueLen} change(s) queued offline`
        : syncStatus.lastAt
          ? (() => {
              const kind = getLastSyncLatencyKind()
              if (kind === 'pull' && syncStatus.lastPullMs != null) {
                return `Synced · ${formatSyncLatencyMs(syncStatus.lastPullMs)} pull`
              }
              if (kind === 'push' && syncStatus.lastPushMs != null) {
                return `Synced · ${formatSyncLatencyMs(syncStatus.lastPushMs)} push`
              }
              if (syncStatus.lastPullMs != null) {
                return `Synced · ${formatSyncLatencyMs(syncStatus.lastPullMs)} pull`
              }
              if (syncStatus.lastPushMs != null) {
                return `Synced · ${formatSyncLatencyMs(syncStatus.lastPushMs)} push`
              }
              return `Last sync ${new Date(syncStatus.lastAt).toLocaleString()}`
            })()
          : 'Ready to sync'

  return (
    <div className="pb-8 md:pb-0">
      <WeeklyDigestModal
        open={digestOpen}
        input={digestInput}
        onClose={() => setDigestOpen(false)}
        onFlash={(msg) => toastSuccess(msg)}
      />
      <PageHeader
        eyebrow="MyDSP"
        title="Today"
        description="Net worth, tasks due now, sync health, and Markets — act first, explore below."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm weekly-digest-btn"
              onClick={openWeeklyDigest}
              title="Preview and share weekly HTML digest (not emailed)"
            >
              Digest Preview/Share
            </button>
            <Link to="/settings#sync" className="btn-secondary btn-sm inline-flex">
              Cloud Sync <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        }
      />

      {showBackupNudge ? (
        <div
          className="backup-nudge mb-3 px-3 py-2 text-xs text-text-muted border border-border/70 bg-surface/40 rounded-lg md:rounded-none"
          role="status"
        >
          Weekly backup overdue —{' '}
          <Link to="/settings#full-backup" className="text-accent hover:underline font-semibold">
            open Settings backups
          </Link>
        </div>
      ) : null}

      <div className={twoPane ? 'today-two-pane grid grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] gap-4 mb-4 items-start' : ''}>
        <div className={twoPane ? 'min-w-0' : ''}>
      <div className={`surface p-5 md:p-6 mb-4 rounded-xl md:rounded-none shadow-sm md:shadow-none ${privacyClass(privacy)}`}>
        <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Net worth</p>
        <p className="today-net-worth-value text-3xl md:text-4xl font-bold tabular-nums tracking-tight mb-1 break-words">
          {formatGBP(netWorth)}
        </p>
        {moneyPulse ? (
          <p className="today-money-pulse text-sm text-text-muted font-light mb-2 tabular-nums">
            {moneyPulse}
          </p>
        ) : null}
        {nwSpark.length >= 2 ? (
          <div className="today-nw-sparkline mb-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] uppercase tracking-wider text-text-subtle font-semibold">
                Trend
              </p>
              <div
                className="flex gap-1"
                role="group"
                aria-label="Net worth sparkline window"
              >
                {([7, 30] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`btn-ghost btn-sm !min-h-8 !px-2 text-[11px] ${
                      nwSparkDays === d ? 'text-accent font-bold' : ''
                    }`}
                    aria-pressed={nwSparkDays === d}
                    onClick={() => setNwSparkDays(d)}
                  >
                    {d === 7 ? '7d' : '30d'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-10 w-full max-w-xs" aria-hidden>
              <Sparkline data={nwSpark} height={40} trend={nwSparkTrend} showGradient />
            </div>
          </div>
        ) : null}
        <p className="text-sm text-text-muted font-light mb-4">
          Assets {formatGBP(assets)} · Debt {formatGBP(liabilities)}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-subtle">
          <span>{syncLine}</span>
          <Link to="/markets" className="hover:text-accent">
            {marketsCount} Markets ticker{marketsCount === 1 ? '' : 's'} →
          </Link>
        </div>
        {(monthlyBudgetPulse || weekToDateSpend.spent > 0 || cashRunway || fireChip) ? (
          <div className="today-pulse-chips mt-4 flex flex-wrap gap-2">
            {monthlyBudgetPulse ? (
              <Link
                to="/budgets"
                className={`today-budget-pulse border border-border bg-surface-hover/60 px-3 py-2 text-xs hover:border-accent ${privacyClass(privacy)}`}
                title="This month spent versus all budget goal limits"
              >
                <span className="block uppercase tracking-wider text-text-subtle font-semibold">
                  Budget pulse
                </span>
                <span className="block tabular-nums">
                  {formatGBP(monthlyBudgetPulse.spent)} / {formatGBP(monthlyBudgetPulse.totalBudget)}
                </span>
                <span className="block text-text-subtle">
                  {Math.round(monthlyBudgetPulse.ratio * 100)}% used →
                </span>
              </Link>
            ) : null}
            {weekToDateSpend.spent > 0 ? (
              <Link
                to="/spending"
                className={`today-week-to-date-spend border border-border bg-surface-hover/60 px-3 py-2 text-xs hover:border-accent ${privacyClass(privacy)}`}
                title={`Spend since ${weekToDateSpend.start}`}
              >
                <span className="block uppercase tracking-wider text-text-subtle font-semibold">
                  WTD spend
                </span>
                <span className="block tabular-nums">
                  {formatGBP(weekToDateSpend.spent)}
                </span>
                <span className="block text-text-subtle">This week →</span>
              </Link>
            ) : null}
            {cashRunway ? (
              <Link
                to="/recurring"
                className={`today-cash-runway border border-border bg-surface-hover/60 px-3 py-2 text-xs hover:border-accent ${privacyClass(privacy)}`}
                title="Liquid-ish net worth divided by monthly recurring bills"
              >
                <span className="block uppercase tracking-wider text-text-subtle font-semibold">
                  Cash runway
                </span>
                <span className="block tabular-nums">
                  {cashRunway.months >= 99 ? '99+' : cashRunway.months.toFixed(cashRunway.months < 10 ? 1 : 0)} mo
                </span>
                <span className="block text-text-subtle">
                  vs {formatGBP(cashRunway.monthlyRecurring)}/mo →
                </span>
              </Link>
            ) : null}
            {fireChip ? (
              <Link
                to="/fire"
                className={`today-fire-chip border border-border bg-surface-hover/60 px-3 py-2 text-xs hover:border-accent ${privacyClass(privacy)}`}
                title="Regular FIRE from saved FIRE inputs"
              >
                <span className="block uppercase tracking-wider text-text-subtle font-semibold">
                  FIRE
                </span>
                <span className="block tabular-nums">
                  {Math.round(fireChip.progress)}% of target
                </span>
                <span className="block text-text-subtle">
                  Age {fireChip.ageAtFire} →
                </span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Next-action stack — up to 3: todo / bill / top mover */}
      <TodayAccordionSection
        id="today-next-action"
        title="Next"
        enabled={todayAccordionEnabled}
        defaultOpen
        className="today-next-action-stack today-focus-card space-y-2 mb-3"
        ariaLabel="Next actions"
        action={
          <Link to="/todos" className="text-xs text-accent font-semibold">
            All To Do's
          </Link>
        }
      >
        {nextActions.length === 0 ? (
          <div className="surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <p className="text-sm text-text-muted font-light">Clear day — nothing due, no movers yet.</p>
          </div>
        ) : (
          nextActions.map((card) => {
            if (card.kind === 'todo') {
              return (
                <div
                  key={`todo-${card.todo.id}`}
                  className="today-next-action-card surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
                >
                  <Link to={`/todos?focus=${card.todo.id}`} className="block group">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                      {card.label}
                    </p>
                    <p className="text-lg md:text-xl font-bold tracking-tight text-text group-hover:text-accent line-clamp-2">
                      {card.todo.title}
                    </p>
                    {todayTodos.length > 1 ? (
                      <p className="text-xs text-text-muted mt-2 font-light">
                        +{todayTodos.length - 1} more due today
                      </p>
                    ) : null}
                  </Link>
                  <div className="today-focus-actions flex flex-wrap gap-2 mt-3">
                    <button type="button" className="btn-primary btn-sm" onClick={markFocusDone}>
                      Mark done
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={snoozeFocus}>
                      Snooze
                    </button>
                  </div>
                </div>
              )
            }
            if (card.kind === 'bill') {
              return (
                <div
                  key={`bill-${card.bill.id}`}
                  className="today-next-action-card today-bill-next-action surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
                >
                  <Link to="/recurring" className="block group">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                      Bill due
                    </p>
                    <p className="text-base md:text-lg font-bold tracking-tight group-hover:text-accent line-clamp-1">
                      {card.bill.name}
                    </p>
                    <p className={`text-xs text-text-muted mt-1 tabular-nums ${privacyClass(privacy)}`}>
                      {formatDate(card.bill.nextDue)} · {formatGBP(card.bill.amount)}
                    </p>
                  </Link>
                  <div className="today-bill-next-actions flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => markBillPaid(card.bill.id)}
                    >
                      Mark paid
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => skipBill(card.bill.id)}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <Link
                key={`mover-${card.symbol}`}
                to={`/markets?symbol=${encodeURIComponent(card.symbol)}`}
                className="today-next-action-card surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none block group"
              >
                <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                  Top mover
                </p>
                <p className="text-lg md:text-xl font-bold tracking-tight inline-flex items-baseline gap-2 flex-wrap">
                  <span className="group-hover:text-accent">{card.symbol}</span>
                  <span
                    className={`tabular-nums ${
                      card.changePct >= 0 ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {card.changePct >= 0 ? '+' : ''}
                    {card.changePct.toFixed(2)}%
                  </span>
                </p>
              </Link>
            )
          })
        )}
      </TodayAccordionSection>

      {showBillsStrip.length > 0 ? (
        <TodayAccordionSection
          id="today-bills"
          title="Bills · due in 7 days"
          enabled={todayAccordionEnabled}
          defaultOpen={false}
          className="mb-3"
          action={
            <Link to="/recurring" className="text-xs text-accent font-semibold">
              Recurring
            </Link>
          }
        >
          <div className="today-bills-strip surface p-3 md:p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <ul className="flex flex-col gap-1.5">
              {showBillsStrip.map((r) => (
                <li key={r.id}>
                  <SwipeBillRow
                    onMarkPaid={() => markBillPaid(r.id)}
                    onSkip={() => skipBill(r.id)}
                    className="rounded-lg md:rounded-none"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm py-1.5">
                      <div className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className={`text-xs text-text-muted tabular-nums ${privacyClass(privacy)}`}>
                          {formatDate(r.nextDue)} · {formatGBP(r.amount)}
                        </span>
                      </div>
                      <div className="hidden sm:flex shrink-0 gap-1">
                        <button type="button" className="btn-primary btn-sm" onClick={() => markBillPaid(r.id)}>
                          Mark paid
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => skipBill(r.id)}>
                          Skip
                        </button>
                      </div>
                    </div>
                  </SwipeBillRow>
                </li>
              ))}
            </ul>
          </div>
        </TodayAccordionSection>
      ) : null}

      {soonGoal || goalProjection ? (
        <TodayAccordionSection
          id="today-goals"
          title="Goals"
          enabled={todayAccordionEnabled}
          defaultOpen={false}
          className="mb-3"
          action={
            <Link to="/goals" className="text-xs text-accent font-semibold">
              Goals
            </Link>
          }
        >
          {soonGoal ? (
            <div
              className="today-goal-ring surface p-4 md:p-5 mb-3 rounded-xl md:rounded-none shadow-sm md:shadow-none flex items-center gap-4 group"
            >
              <div
                className="relative shrink-0 w-14 h-14"
                role="img"
                aria-label={`${Math.round(soonGoalProgress)}% toward ${soonGoal.name}`}
              >
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(Math.min(soonGoalProgress, 100) / 100) * 97.4} 97.4`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
                  {Math.round(soonGoalProgress)}%
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold mb-1">
                  Goal · within 30 days
                </p>
                <Link to="/goals" className="block">
                  <p className="text-base font-bold tracking-tight hover:text-accent line-clamp-1">
                    {soonGoal.name}
                  </p>
                </Link>
                <p className="text-xs text-text-muted font-light mt-0.5">
                  Due {formatDate(soonGoal.deadline)}
                </p>
              </div>
              <Link
                to={`/goals?note=${soonGoal.id}`}
                className="today-goal-log-note btn-secondary btn-sm shrink-0"
              >
                Log note
              </Link>
            </div>
          ) : null}

          {goalProjection ? (
            <Link
              to="/goals"
              className="today-goal-projection surface p-3 md:p-4 mb-3 rounded-xl md:rounded-none shadow-sm md:shadow-none block group"
            >
              <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold mb-1">
                Goal estimate
              </p>
              <p className="text-sm font-semibold tracking-tight group-hover:text-accent line-clamp-1">
                {goalProjection.goal.name}
              </p>
              <p className={`text-xs text-text-muted font-light mt-0.5 ${privacyClass(privacy)}`}>
                {formatGoalProjectionLine(goalProjection, formatDate)}
              </p>
            </Link>
          ) : null}
        </TodayAccordionSection>
      ) : null}

      <div className="surface p-4 md:p-5 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold">Jump in</p>
        </div>
        {todayPriceAlerts.length > 0 ? (
          <p className="text-sm mb-3">
            <Link to={todayPriceAlerts[0].actionUrl ?? '/markets'} className="font-medium text-accent hover:underline line-clamp-1">
              Alert · {todayPriceAlerts[0].title}
            </Link>
          </p>
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

        {twoPane ? (
          <aside
            className="today-markets-pane surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none sticky top-20"
            aria-label="Markets snapshot"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold">Markets</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="today-two-pane-digest-preview text-xs text-accent font-semibold"
                  onClick={openWeeklyDigest}
                  title="Preview and share weekly digest"
                >
                  Digest Preview
                </button>
                <Link to="/markets" className="text-xs text-accent font-semibold">
                  Open
                </Link>
              </div>
            </div>
            {todayMovers.length === 0 ? (
              <p className="text-sm text-text-muted font-light">No movers yet — open Markets to refresh.</p>
            ) : (
              <ul className="space-y-2">
                {todayMovers.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/markets?symbol=${encodeURIComponent(m.symbol)}`}
                      className="flex items-baseline justify-between gap-2 hover:text-accent"
                    >
                      <span className="font-semibold tracking-tight">{m.symbol}</span>
                      <span
                        className={`tabular-nums text-sm markets-quote-price ${
                          m.changePct >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {m.changePct >= 0 ? '+' : ''}
                        {m.changePct.toFixed(2)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-text-subtle mt-3 font-light">
              {marketsCount} ticker{marketsCount === 1 ? '' : 's'} watched
            </p>
          </aside>
        ) : null}
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
