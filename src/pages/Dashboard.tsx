import { Link } from 'react-router-dom'
import { ArrowRight, CandlestickChart, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { getTaxPack } from '../domain/taxPacks'
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
import {
  loadNwSparkWindowPref,
  saveNwSparkWindowPref,
} from '../domain/nwSparkWindowPref'
import {
  loadWhatArrivedDismissPref,
  saveWhatArrivedDismissPref,
} from '../domain/whatArrivedDismissPref'
import { dueWithinDays } from '../domain/recurringDueStrip'
import { markRecurringPaid, skipRecurringOccurrence } from '../domain/recurringActions'
import { monthlyRecurringTotal } from '../domain/recurringHelpers'
import { needsFollowUp } from '../domain/jobs'
import { isDueToday, isOverdue } from '../domain/todos'
import { snoozeDueDateOneDay } from '../domain/todoSnooze'
import { sparklineTrendFromSeries } from '../domain/sparklineSeries'
import {
  getAutoSyncStatus,
  getLastSyncLatencyKind,
  subscribeAutoSync,
  syncNow,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig, pushSync } from '../services/sync/syncService'
import {
  firstSyncHighlightHref,
  peekSyncHighlights,
  type SyncHighlightMap,
} from '../services/sync/syncHighlights'
import {
  loadOfflineQueue,
  removeOfflineJob,
  retryOfflineJobNow,
} from '../services/offlineQueue'
import { getSessionSyncPassphrase } from '../services/sync/sessionPassphrase'
import { LAST_BACKUP_KEY } from '../storage/backupStore'
import { hasFinnhubKey } from '../domain/finnhubReminder'
import { isSyncedRemoteQuote } from '../domain/marketQuotesSync'
import {
  formatSlaAge,
  hasStaleSyncedQuotes,
  quoteAgeMs as quoteSlaAgeMs,
  QUOTE_FRESHNESS_SLA_MS,
} from '../domain/quoteFreshnessSla'
import { listMarketTickers, loadMarketQuotesCache } from '../storage/marketsStore'
import {
  getNewsSeenAt,
  loadNewsArticlesCache,
  newsUnreadFromCache,
  setNewsSeenAt,
} from '../storage/newsStore'
import {
  getYoutubeSeenAt,
  loadYoutubeVideosCache,
  setYoutubeSeenAt,
  youtubeUnreadFromCache,
} from '../storage/youtubeStore'
import { getMarketsProviderHealth } from '../services/marketsProviderHealth'
import type { MarketQuote } from '../domain/markets'
import type { RecurringTransaction } from '../domain/types'

/** Today movers ignore prints older than this (ms). */
const MOVER_MAX_AGE_MS = 24 * 60 * 60 * 1000

function quoteAgeMs(updatedAt: string | undefined): number | null {
  if (!updatedAt) return null
  const t = Date.parse(updatedAt)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Date.now() - t)
}

function formatQuoteAgeShort(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function todayQuoteAvailabilityLabel(q: MarketQuote | undefined): string | null {
  if (!q) return null
  const src = (q.source || '').toLowerCase()
  if (q.last > 0) {
    if (src.includes('yahoo') || src.includes('finnhub') || src.includes('coingecko') || src.includes('frankfurter')) {
      return 'Live'
    }
    if (src.includes('exchangerate')) return 'Live · spot'
    if (src.startsWith('sync:')) return 'Live'
    return 'Live'
  }
  if (src === 'none' || src === 'error' || src === 'invalid' || src.startsWith('stale:')) {
    return 'Unavailable'
  }
  return null
}

function latestRecurringCommentary(r: RecurringTransaction): string | null {
  const list = r.commentaries
  if (!list?.length) return null
  const newest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const text = newest?.text?.trim()
  return text || null
}
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
  { to: '/todos', label: "To Do's", badge: 'todos' as const },
  { to: '/jobs', label: 'Jobs', badge: 'jobs' as const },
  { to: '/liabilities', label: 'Liabilities', badge: null },
  { to: '/goals', label: 'Goals', badge: null },
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
  const { data, breakdown, privacy, fccDataPresent, setData, goalProgress, refreshPrices } =
    usePortfolio()
  const { netWorth, assets, liabilities, crypto, equity, liability } = breakdown
  const { reminders } = useSmartReminders()
  const { success: toastSuccess } = useToasts()
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestInput, setDigestInput] = useState<WeeklyDigestInput | null>(null)
  const [syncStatus, setSyncStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)
  const [nwSparkDays, setNwSparkDays] = useState<NwSparkWindow>(() => loadNwSparkWindowPref())
  /** iPad / wide Stage Manager: Today | Markets two-pane when ≥900px. */
  const [twoPane, setTwoPane] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 900px)').matches : false,
  )
  const todayAccordionEnabled = useTodayAccordionEnabled()
  const [youtubeUnread, setYoutubeUnread] = useState(() => youtubeUnreadFromCache())
  const [newsUnread, setNewsUnread] = useState(() => newsUnreadFromCache())
  const [relativeTick, setRelativeTick] = useState(0)
  const [newsFetchedAt, setNewsFetchedAt] = useState(
    () => loadNewsArticlesCache().fetchedAt ?? null,
  )
  const [youtubeFetchedAt, setYoutubeFetchedAt] = useState(
    () => loadYoutubeVideosCache().fetchedAt ?? null,
  )
  const [whatArrivedChip, setWhatArrivedChip] = useState<string | null>(null)
  const [whatArrivedOpenHref, setWhatArrivedOpenHref] = useState<string | null>(null)
  const [focusUndo, setFocusUndo] = useState<{
    id: number
    status: string
    completedAt?: string
    updatedAt: string
  } | null>(null)
  const focusUndoTimer = useRef<number | null>(null)
  const [billUndo, setBillUndo] = useState<{
    id: number
    nextDue: string
    lastPaidAt?: string
    spendId: number
  } | null>(null)
  const billUndoTimer = useRef<number | null>(null)
  const [interviewUndo, setInterviewUndo] = useState<{
    jobId: number
    interviews: Array<{ id: number; outcome?: string; completedAt?: string }>
    updatedAt: string
  } | null>(null)
  const interviewUndoTimer = useRef<number | null>(null)
  const [followupUndo, setFollowupUndo] = useState<{
    jobId: number
    updatedAt: string
  } | null>(null)
  const followupUndoTimer = useRef<number | null>(null)
  const [focusSnoozeUndo, setFocusSnoozeUndo] = useState<{
    id: number
    dueDate?: string
    updatedAt: string
  } | null>(null)
  const focusSnoozeUndoTimer = useRef<number | null>(null)
  const [newsMarkAllUndo, setNewsMarkAllUndo] = useState<{
    previousSeenAt: string
    previousUnread: number
  } | null>(null)
  const newsMarkAllUndoTimer = useRef<number | null>(null)
  const [youtubeMarkAllUndo, setYoutubeMarkAllUndo] = useState<{
    previousSeenAt: string
    previousUnread: number
  } | null>(null)
  const youtubeMarkAllUndoTimer = useRef<number | null>(null)
  const [activeJumpSection, setActiveJumpSection] = useState<string | null>(null)

  useEffect(() => subscribeAutoSync(setSyncStatus), [])
  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const refreshYoutubeUnread = () => {
      setYoutubeUnread(youtubeUnreadFromCache())
      setYoutubeFetchedAt(loadYoutubeVideosCache().fetchedAt ?? null)
    }
    refreshYoutubeUnread()
    window.addEventListener('mydsp-youtube-videos', refreshYoutubeUnread)
    window.addEventListener('mydsp-youtube-changed', refreshYoutubeUnread)
    return () => {
      window.removeEventListener('mydsp-youtube-videos', refreshYoutubeUnread)
      window.removeEventListener('mydsp-youtube-changed', refreshYoutubeUnread)
    }
  }, [])
  useEffect(() => {
    const refreshNewsUnread = () => {
      setNewsUnread(newsUnreadFromCache())
      setNewsFetchedAt(loadNewsArticlesCache().fetchedAt ?? null)
    }
    refreshNewsUnread()
    window.addEventListener('mydsp-news-articles', refreshNewsUnread)
    window.addEventListener('mydsp-news-changed', refreshNewsUnread)
    return () => {
      window.removeEventListener('mydsp-news-articles', refreshNewsUnread)
      window.removeEventListener('mydsp-news-changed', refreshNewsUnread)
    }
  }, [])
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

  const todayTodosDueCount = useMemo(
    () =>
      (data.todoItems ?? []).filter(
        (t) => t.status !== 'done' && t.status !== 'archived' && (isDueToday(t) || isOverdue(t)),
      ).length,
    [data.todoItems],
  )

  const jobsFollowUpCount = useMemo(
    () => (data.jobApplications ?? []).filter((a) => needsFollowUp(a)).length,
    [data.jobApplications],
  )

  const marketsCount = useMemo(() => listMarketTickers().length, [syncStatus.lastAt])

  const todayMovers = useMemo(() => {
    const quotes = loadMarketQuotesCache()
    const tickers = listMarketTickers()
    return tickers
      .map((t) => {
        const q = quotes.get(t.id)
        if (!q || !(q.last > 0) || !Number.isFinite(q.changePct)) return null
        const src = (q.source || '').toLowerCase()
        // Drop Unavailable / error prints from Today movers
        if (src === 'none' || src === 'error' || src === 'invalid' || src.startsWith('stale:')) {
          return null
        }
        const age = quoteAgeMs(q.updatedAt)
        if (age == null || age > MOVER_MAX_AGE_MS) return null
        return {
          id: t.id,
          symbol: t.symbol,
          kind: t.kind,
          changePct: q.changePct,
          fromSync: isSyncedRemoteQuote(q),
          ageMs: age,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 3)
  }, [syncStatus.lastAt, marketsCount])

  /** Cross-device quote lag — when last-good prints arrived via sync before this device refreshed. */
  const priceLagChip = useMemo(() => {
    const quotes = loadMarketQuotesCache()
    let newest = 0
    let count = 0
    for (const q of quotes.values()) {
      if (!isSyncedRemoteQuote(q) || !(q.last > 0)) continue
      count += 1
      const t = Date.parse(q.updatedAt) || 0
      if (t > newest) newest = t
    }
    if (count === 0 || newest <= 0) return null
    const age = Math.max(0, Date.now() - newest)
    return {
      count,
      label: `Prices from other device · ${formatQuoteAgeShort(age)}`,
    }
  }, [syncStatus.lastAt, marketsCount])

  const providerHealth = useMemo(() => getMarketsProviderHealth(), [syncStatus.lastAt, marketsCount])

  const finnhubQuotaLimited = useMemo(() => {
    const fh = providerHealth.find((p) => p.id === 'finnhub')
    if (!fh?.lastError || !/429|quota/i.test(fh.lastError)) return false
    return true
  }, [providerHealth])

  const quoteSlaChip = useMemo(() => {
    const quotes = loadMarketQuotesCache()
    const list = [...quotes.values()].filter((q) => q.last > 0)
    if (!hasStaleSyncedQuotes(list)) return null
    let oldest = 0
    for (const q of list) {
      if (!isSyncedRemoteQuote(q)) continue
      const age = quoteSlaAgeMs(q)
      if (age != null && age > oldest) oldest = age
    }
    if (oldest <= QUOTE_FRESHNESS_SLA_MS) return null
    return `Synced quotes past ${formatSlaAge(QUOTE_FRESHNESS_SLA_MS)} SLA · oldest ${formatSlaAge(oldest)}`
  }, [syncStatus.lastAt, marketsCount])

  const quotePartialChip = useMemo(() => {
    const quotes = loadMarketQuotesCache()
    const tickers = listMarketTickers()
    let live = 0
    let unavailable = 0
    for (const t of tickers) {
      const label = todayQuoteAvailabilityLabel(quotes.get(t.id))
      if (label === 'Live' || label === 'Live · spot') live++
      else if (label === 'Unavailable') unavailable++
    }
    if (unavailable <= 0) return null
    return `${live} live · ${unavailable} unavailable`
  }, [syncStatus.lastAt, marketsCount])

  const budgetPulse = useMemo(
    () => worstBudgetOffenders(data.spending, data.budgetGoals).slice(0, 3),
    [data.spending, data.budgetGoals],
  )

  const todayTaxStrip = useMemo(() => {
    const taxPack = getTaxPack(data.settings.taxResidency || 'GB')
    const disposalCount = (data.disposals ?? []).length
    const detail =
      disposalCount > 0
        ? `${taxPack.label} · ${disposalCount} disposal${disposalCount === 1 ? '' : 's'}`
        : taxPack.hasCgt
          ? `${taxPack.label} · CGT pack`
          : `${taxPack.label} · open capital gains`
    return { detail }
  }, [data.settings.taxResidency, data.disposals])

  /** Next-action stack: todo / bill / interview / goal / budget / top mover (max 3). */
  const nextActions = useMemo(
    () =>
      buildNextActionStack({
        todoItems: data.todoItems,
        recurringTransactions: data.recurringTransactions,
        jobApplications: data.jobApplications,
        goals: data.goals,
        budgetOffenders: budgetPulse,
        movers: todayMovers,
      }),
    [
      data.todoItems,
      data.recurringTransactions,
      data.jobApplications,
      data.goals,
      budgetPulse,
      todayMovers,
    ],
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
        ? `Top mover ${todayMovers[0].symbol}${
            todayMovers[0].kind === 'commodity' ? ' (commodity)' : ''
          } ${formatPct(todayMovers[0].changePct)}${
            todayMovers[0].fromSync ? ' (from other device)' : ''
          }`
        : 'No fresh Markets movers (open Markets to refresh)',
      ...(todayMovers.some((m) => m.kind === 'commodity')
        ? [
            `Commodity mover ${
              todayMovers.find((m) => m.kind === 'commodity')!.symbol
            } ${formatPct(todayMovers.find((m) => m.kind === 'commodity')!.changePct)}`,
          ]
        : []),
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
    setFocusUndo({
      id,
      status: focusTodoItem.status,
      completedAt: focusTodoItem.completedAt,
      updatedAt: focusTodoItem.updatedAt,
    })
    if (focusUndoTimer.current) window.clearTimeout(focusUndoTimer.current)
    focusUndoTimer.current = window.setTimeout(() => setFocusUndo(null), 5_000)
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === id
          ? { ...i, status: 'done' as const, completedAt: now, updatedAt: now }
          : i,
      ),
    }))
  }

  const undoFocusDone = () => {
    if (!focusUndo) return
    const snap = focusUndo
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === snap.id
          ? {
              ...i,
              status: snap.status as typeof i.status,
              completedAt: snap.completedAt,
              updatedAt: snap.updatedAt,
            }
          : i,
      ),
    }))
    setFocusUndo(null)
    if (focusUndoTimer.current) {
      window.clearTimeout(focusUndoTimer.current)
      focusUndoTimer.current = null
    }
  }

  const retryOfflineQueue = () => {
    const queue = loadOfflineQueue()
    for (const j of queue) retryOfflineJobNow(j.id)
    for (const job of loadOfflineQueue()) {
      if (job.type === 'quote_refresh') {
        void refreshPrices().then(() => removeOfflineJob(job.id))
        continue
      }
      if (job.type === 'sync_push' && job.remoteUrl) {
        const pass = getSessionSyncPassphrase()
        if (!pass) continue
        void pushSync(job.remoteUrl, pass)
          .then(() => removeOfflineJob(job.id))
          .catch(() => {
            /* keep queued */
          })
      }
    }
    void syncNow().then(() => toastSuccess('Offline queue retry started'))
  }

  const snoozeFocus = () => {
    if (!focusTodoItem) return
    const dueDate = snoozeDueDateOneDay(focusTodoItem.dueDate)
    const now = new Date().toISOString()
    const id = focusTodoItem.id
    setFocusSnoozeUndo({
      id,
      dueDate: focusTodoItem.dueDate,
      updatedAt: focusTodoItem.updatedAt,
    })
    if (focusSnoozeUndoTimer.current) window.clearTimeout(focusSnoozeUndoTimer.current)
    focusSnoozeUndoTimer.current = window.setTimeout(() => setFocusSnoozeUndo(null), 5_000)
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === id ? { ...i, dueDate, updatedAt: now } : i,
      ),
    }))
  }

  const undoFocusSnooze = () => {
    if (!focusSnoozeUndo) return
    const snap = focusSnoozeUndo
    setData((prev) => ({
      ...prev,
      todoItems: (prev.todoItems ?? []).map((i) =>
        i.id === snap.id
          ? { ...i, dueDate: snap.dueDate, updatedAt: snap.updatedAt }
          : i,
      ),
    }))
    setFocusSnoozeUndo(null)
    if (focusSnoozeUndoTimer.current) {
      window.clearTimeout(focusSnoozeUndoTimer.current)
      focusSnoozeUndoTimer.current = null
    }
  }

  const markFollowUpDone = (jobId: number) => {
    const app = (data.jobApplications ?? []).find((a) => a.id === jobId)
    if (!app) return
    const now = new Date().toISOString()
    setFollowupUndo({
      jobId,
      updatedAt: app.updatedAt,
    })
    if (followupUndoTimer.current) window.clearTimeout(followupUndoTimer.current)
    followupUndoTimer.current = window.setTimeout(() => setFollowupUndo(null), 5_000)
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((a) => {
        if (a.id !== jobId) return a
        const nextId = (a.notes ?? []).reduce((m, n) => Math.max(m, n.id), 0) + 1
        return {
          ...a,
          notes: [
            ...(a.notes ?? []),
            {
              id: nextId,
              content: 'Follow-up logged from Today',
              type: 'follow-up' as const,
              createdAt: now,
              updatedAt: now,
            },
          ],
          updatedAt: now,
        }
      }),
    }))
  }

  const undoFollowUpDone = () => {
    if (!followupUndo) return
    const snap = followupUndo
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((a) => {
        if (a.id !== snap.jobId) return a
        let removed = false
        const nextNotes = [...(a.notes ?? [])]
          .reverse()
          .filter((n) => {
            if (
              !removed &&
              n.type === 'follow-up' &&
              n.content === 'Follow-up logged from Today'
            ) {
              removed = true
              return false
            }
            return true
          })
          .reverse()
        return { ...a, notes: nextNotes, updatedAt: snap.updatedAt }
      }),
    }))
    setFollowupUndo(null)
    if (followupUndoTimer.current) {
      window.clearTimeout(followupUndoTimer.current)
      followupUndoTimer.current = null
    }
  }

  const markInterviewDone = (jobId: number) => {
    const app = (data.jobApplications ?? []).find((a) => a.id === jobId)
    if (!app) return
    const pending = (app.interviews ?? []).filter(
      (iv) => !iv.completedAt && (!iv.outcome || iv.outcome === 'pending'),
    )
    if (pending.length === 0) return
    setInterviewUndo({
      jobId,
      interviews: pending.map((iv) => ({
        id: iv.id,
        outcome: iv.outcome,
        completedAt: iv.completedAt,
      })),
      updatedAt: app.updatedAt,
    })
    if (interviewUndoTimer.current) window.clearTimeout(interviewUndoTimer.current)
    interviewUndoTimer.current = window.setTimeout(() => setInterviewUndo(null), 5_000)
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((a) => {
        if (a.id !== jobId) return a
        const interviews = (a.interviews ?? []).map((iv) => {
          if (iv.completedAt || (iv.outcome && iv.outcome !== 'pending')) return iv
          return { ...iv, outcome: 'passed' as const, completedAt: now }
        })
        return { ...a, interviews, updatedAt: now }
      }),
    }))
  }

  const undoInterviewDone = () => {
    if (!interviewUndo) return
    const snap = interviewUndo
    const byId = new Map(snap.interviews.map((iv) => [iv.id, iv]))
    setData((prev) => ({
      ...prev,
      jobApplications: (prev.jobApplications ?? []).map((a) => {
        if (a.id !== snap.jobId) return a
        const interviews = (a.interviews ?? []).map((iv) => {
          const prior = byId.get(iv.id)
          if (!prior) return iv
          return {
            ...iv,
            outcome: (prior.outcome as typeof iv.outcome) ?? 'pending',
            completedAt: prior.completedAt,
          }
        })
        return { ...a, interviews, updatedAt: snap.updatedAt }
      }),
    }))
    setInterviewUndo(null)
    if (interviewUndoTimer.current) {
      window.clearTimeout(interviewUndoTimer.current)
      interviewUndoTimer.current = null
    }
  }

  const markBillPaid = (id: number) => {
    const bill = (data.recurringTransactions ?? []).find((r) => r.id === id)
    if (!bill) return
    const spendId = (data.spending ?? []).reduce((m, s) => Math.max(m, s.id), 0) + 1
    setBillUndo({
      id,
      nextDue: bill.nextDue,
      lastPaidAt: bill.lastPaidAt,
      spendId,
    })
    if (billUndoTimer.current) window.clearTimeout(billUndoTimer.current)
    billUndoTimer.current = window.setTimeout(() => setBillUndo(null), 5_000)
    setData((prev) => markRecurringPaid(prev, id))
    toastSuccess('Bill marked paid')
  }

  const undoBillPaid = () => {
    if (!billUndo) return
    const snap = billUndo
    setData((prev) => ({
      ...prev,
      spending: (prev.spending ?? []).filter((s) => s.id !== snap.spendId),
      recurringTransactions: (prev.recurringTransactions ?? []).map((r) =>
        r.id === snap.id
          ? { ...r, nextDue: snap.nextDue, lastPaidAt: snap.lastPaidAt }
          : r,
      ),
    }))
    setBillUndo(null)
    if (billUndoTimer.current) {
      window.clearTimeout(billUndoTimer.current)
      billUndoTimer.current = null
    }
  }

  const skipBill = (id: number) => {
    setData((prev) => skipRecurringOccurrence(prev, id))
    toastSuccess('Bill skipped')
  }

  useEffect(() => {
    const onArrived = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        summary?: string | null
        extrasSummary?: string | null
        highlights?: SyncHighlightMap | null
      }>).detail
      const summary = detail?.summary || detail?.extrasSummary || null
      const highlights = detail?.highlights ?? peekSyncHighlights()
      const openHref = firstSyncHighlightHref(highlights)
      if (summary) {
        if (loadWhatArrivedDismissPref() !== summary) {
          setWhatArrivedChip(summary)
          setWhatArrivedOpenHref(openHref)
        }
      }
      setNwSparkDays(loadNwSparkWindowPref())
    }
    window.addEventListener('mydsp-sync-applied', onArrived)
    return () => window.removeEventListener('mydsp-sync-applied', onArrived)
  }, [])

  useEffect(() => {
    return () => {
      if (focusUndoTimer.current) window.clearTimeout(focusUndoTimer.current)
      if (billUndoTimer.current) window.clearTimeout(billUndoTimer.current)
      if (interviewUndoTimer.current) window.clearTimeout(interviewUndoTimer.current)
      if (followupUndoTimer.current) window.clearTimeout(followupUndoTimer.current)
      if (focusSnoozeUndoTimer.current) window.clearTimeout(focusSnoozeUndoTimer.current)
      if (newsMarkAllUndoTimer.current) window.clearTimeout(newsMarkAllUndoTimer.current)
      if (youtubeMarkAllUndoTimer.current) window.clearTimeout(youtubeMarkAllUndoTimer.current)
    }
  }, [])

  /** Highlight the jump chip for the Today section currently in view. */
  useEffect(() => {
    const sectionIds = [
      'today-next-action',
      'today-bills',
      'today-goals',
      'today-tax',
      'today-debt',
      'today-media',
      'today-markets',
    ]
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) return

    const ratios = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let best: string | null = null
        let bestRatio = 0
        for (const id of sectionIds) {
          const ratio = ratios.get(id) ?? 0
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        }
        if (best) setActiveJumpSection(best)
      },
      {
        root: null,
        rootMargin: '-15% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    )
    for (const el of elements) io.observe(el)
    return () => io.disconnect()
  }, [liabilities, nextActions.length])

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

      <nav
        className="today-section-jump-chips mb-3 flex flex-wrap gap-1.5"
        aria-label="Jump to Today section"
      >
        {(
          [
            ['today-next-action', 'Next', 'today-section-jump-next'],
            ['today-bills', 'Bills', 'today-section-jump-bills'],
            ['today-goals', 'Goals', 'today-section-jump-goals'],
            ['today-tax', 'Tax', 'today-section-jump-tax'],
            ...(liabilities > 0
              ? ([['today-debt', 'Debt', 'today-section-jump-debt']] as const)
              : []),
            ['today-media', 'Media', 'today-section-jump-media'],
            ['today-markets', 'Markets', 'today-section-jump-markets'],
          ] as const
        ).map(([id, label, chipClass]) => {
          const active = activeJumpSection === id
          return (
            <a
              key={id}
              href={`#${id}`}
              className={`today-section-jump-chip ${chipClass} btn-ghost btn-sm text-xs${
                active ? ' today-section-jump-chip--active border-accent text-accent' : ''
              }`}
              aria-current={active ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveJumpSection(id)
              }}
            >
              {label}
            </a>
          )
        })}
      </nav>

      {queueLen > 0 ? (
        <p className="today-offline-queue-chip mb-3 text-xs text-accent font-medium" role="status">
          Offline queue · {queueLen} —{' '}
          <Link to="/settings#sync" className="hover:underline">
            open Sync
          </Link>{' '}
          <button
            type="button"
            className="btn-ghost btn-sm text-[11px] min-h-8 today-offline-queue-retry"
            onClick={retryOfflineQueue}
            aria-label="Retry offline queue now"
          >
            Retry now
          </button>
        </p>
      ) : null}

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
                    onClick={() => {
                      setNwSparkDays(d)
                      saveNwSparkWindowPref(d)
                    }}
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
        {priceLagChip ||
        !hasFinnhubKey(data) ||
        finnhubQuotaLimited ||
        quoteSlaChip ||
        quotePartialChip ? (
          <div
            className="today-prices-trust mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"
            role="status"
            aria-label="Prices trust"
          >
            {priceLagChip ? (
              <Link
                to="/markets"
                className="today-price-lag-chip text-accent hover:underline font-medium"
                title="Last-good Markets quotes arrived from another device via sync"
              >
                {priceLagChip.label}
              </Link>
            ) : null}
            {!hasFinnhubKey(data) ? (
              <Link
                to="/settings#prices"
                className="today-finnhub-missing-chip text-amber-700 dark:text-amber-300 hover:underline font-medium"
                title="Finnhub API key is not saved on this device"
              >
                Finnhub missing here
              </Link>
            ) : null}
            {finnhubQuotaLimited ? (
              <Link
                to="/markets"
                className="today-finnhub-quota-chip text-amber-700 dark:text-amber-300 hover:underline font-medium"
                title="Finnhub rate-limited — using Yahoo until quota resets"
              >
                Finnhub rate-limited (429)
              </Link>
            ) : null}
            {quoteSlaChip ? (
              <Link
                to="/markets"
                className="today-quote-sla-chip text-text-muted hover:text-accent font-medium"
                title={quoteSlaChip}
              >
                {quoteSlaChip}
              </Link>
            ) : null}
            {quotePartialChip ? (
              <Link
                to="/markets"
                className="today-quote-partial-chip text-amber-700 dark:text-amber-300 hover:underline font-medium"
                title="Some Markets quotes are unavailable after last sync"
              >
                {quotePartialChip}
              </Link>
            ) : null}
          </div>
        ) : null}
        {(monthlyBudgetPulse || weekToDateSpend.spent > 0 || cashRunway || fireChip || liabilities > 0) ? (
          <div className="today-pulse-chips mt-4 flex flex-wrap gap-2">
            {monthlyBudgetPulse ? (
              <Link
                to="/budgets"
                data-testid="today-budget-pulse"
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
                to="/budgets"
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
            {liabilities > 0 ? (
              <Link
                id="today-debt"
                to="/liabilities"
                className={`today-debt-pulse border border-border bg-surface-hover/60 px-3 py-2 text-xs hover:border-accent ${privacyClass(privacy)}`}
                title="Total liabilities"
              >
                <span className="block uppercase tracking-wider text-text-subtle font-semibold">
                  Debt
                </span>
                <span className="block tabular-nums">{formatGBP(liabilities)}</span>
                <span className="block text-text-subtle">Liabilities →</span>
              </Link>
            ) : null}
            {cashRunway ? (
              <Link
                to="/recurring"
                data-testid="today-cash-runway"
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
                data-testid="today-fire-chip"
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
                  className="today-next-action-card today-focus-pulse surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
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
                    <Link
                      to={`/todos?focus=${card.todo.id}`}
                      className="btn-ghost btn-sm inline-flex items-center"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              )
            }
            if (card.kind === 'interview') {
              return (
                <div
                  key={`interview-${card.jobId}`}
                  className="today-next-action-card today-interview-next-action surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
                >
                  <Link to={`/jobs/${card.jobId}`} className="block group">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                      Interview due
                    </p>
                    <p className="text-base md:text-lg font-bold tracking-tight group-hover:text-accent line-clamp-1">
                      {card.companyName}
                    </p>
                    <p className="text-xs text-text-muted mt-1 font-light line-clamp-1">
                      {card.jobTitle} · {formatDate(card.scheduledDate)}
                    </p>
                  </Link>
                  <div className="today-interview-actions today-focus-actions flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => markInterviewDone(card.jobId)}
                    >
                      Mark done
                    </button>
                    <Link
                      to={`/jobs/${card.jobId}`}
                      className="btn-ghost btn-sm inline-flex items-center"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              )
            }
            if (card.kind === 'followup') {
              return (
                <div
                  key={`followup-${card.jobId}`}
                  className="today-next-action-card today-followup-next-action today-focus-pulse surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
                >
                  <Link to={`/jobs/${card.jobId}`} className="block group">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                      {card.label}
                    </p>
                    <p className="text-base md:text-lg font-bold tracking-tight group-hover:text-accent line-clamp-1">
                      {card.companyName}
                    </p>
                    <p className="text-xs text-text-muted mt-1 font-light line-clamp-1">
                      {card.jobTitle}
                    </p>
                  </Link>
                  <div className="today-followup-actions today-focus-actions flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => markFollowUpDone(card.jobId)}
                    >
                      Mark done
                    </button>
                    <Link
                      to={`/jobs/${card.jobId}`}
                      className="btn-ghost btn-sm inline-flex items-center"
                    >
                      Open job
                    </Link>
                  </div>
                </div>
              )
            }
            if (card.kind === 'goal') {
              return (
                <div
                  key={`goal-${card.goalId}`}
                  className="today-next-action-card goal-next-action surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
                >
                  <Link to="/goals" className="block group">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                      {card.label}
                    </p>
                    <p className="text-base md:text-lg font-bold tracking-tight group-hover:text-accent line-clamp-1">
                      {card.name}
                    </p>
                    {card.deadline ? (
                      <p className="text-xs text-text-muted mt-1 font-light">
                        Due {formatDate(card.deadline)}
                      </p>
                    ) : null}
                  </Link>
                  <div className="today-goal-next-actions flex flex-wrap gap-2 mt-3">
                    <Link
                      to="/goals"
                      className="btn-primary btn-sm inline-flex items-center"
                    >
                      Open
                    </Link>
                    <Link
                      to={`/goals?note=${card.goalId}`}
                      className="btn-secondary btn-sm inline-flex items-center"
                    >
                      Log note
                    </Link>
                  </div>
                </div>
              )
            }
            if (card.kind === 'bill') {
              const billNote = latestRecurringCommentary(card.bill)
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
                    {billNote ? (
                      <span className="today-bill-commentary block text-xs text-text-subtle font-light mt-0.5 line-clamp-1 group-hover:text-accent">
                        {billNote}
                      </span>
                    ) : null}
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
                    <Link
                      to="/recurring"
                      className="btn-ghost btn-sm inline-flex items-center today-bill-open-recurring"
                    >
                      Open recurring
                    </Link>
                  </div>
                </div>
              )
            }
            if (card.kind === 'budget') {
              return (
                <div
                  key={`budget-${card.category}`}
                  className="today-next-action-card budget-next-action surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
                >
                  <Link to="/budgets" className="block group">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-1">
                      {card.label}
                    </p>
                    <p className="text-base md:text-lg font-bold tracking-tight group-hover:text-accent line-clamp-1 capitalize">
                      {card.category}
                    </p>
                    <p className={`text-xs text-text-muted mt-1 tabular-nums ${privacyClass(privacy)}`}>
                      {formatGBP(card.spent)} / {formatGBP(card.limit)} · {Math.round(card.ratio * 100)}%
                    </p>
                  </Link>
                  <div className="today-budget-next-actions flex flex-wrap gap-2 mt-3">
                    <Link
                      to="/budgets"
                      className="btn-primary btn-sm inline-flex items-center"
                    >
                      Open budgets
                    </Link>
                    <Link
                      to={`/spending?category=${encodeURIComponent(card.category)}`}
                      className="btn-ghost btn-sm inline-flex items-center"
                    >
                      Spending
                    </Link>
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
        {focusUndo ? (
          <div
            className="today-focus-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
            role="status"
          >
            <p className="text-sm text-text-muted">Focus task marked done</p>
            <button
              type="button"
              className="btn-secondary btn-sm today-focus-undo"
              data-testid="today-focus-undo"
              onClick={undoFocusDone}
            >
              Undo
            </button>
          </div>
        ) : null}
        {billUndo ? (
          <div
            className="today-bill-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
            role="status"
          >
            <p className="text-sm text-text-muted">Bill marked paid</p>
            <button
              type="button"
              className="btn-secondary btn-sm today-bill-undo"
              data-testid="today-bill-undo"
              onClick={undoBillPaid}
            >
              Undo
            </button>
          </div>
        ) : null}
        {interviewUndo ? (
          <div
            className="today-interview-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
            role="status"
          >
            <p className="text-sm text-text-muted">Interview marked done</p>
            <button
              type="button"
              className="btn-secondary btn-sm today-interview-undo"
              data-testid="today-interview-undo"
              onClick={undoInterviewDone}
            >
              Undo
            </button>
          </div>
        ) : null}
        {followupUndo ? (
          <div
            className="today-followup-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
            role="status"
          >
            <p className="text-sm text-text-muted">Follow-up marked done</p>
            <button
              type="button"
              className="btn-secondary btn-sm today-followup-undo"
              data-testid="today-followup-undo"
              onClick={undoFollowUpDone}
            >
              Undo
            </button>
          </div>
        ) : null}
        {focusSnoozeUndo ? (
          <div
            className="today-focus-snooze-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
            role="status"
          >
            <p className="text-sm text-text-muted">Focus task snoozed</p>
            <button
              type="button"
              className="btn-secondary btn-sm today-focus-snooze-undo"
              data-testid="today-focus-snooze-undo"
              onClick={undoFocusSnooze}
            >
              Undo
            </button>
          </div>
        ) : null}
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
              {showBillsStrip.map((r) => {
                const billNote = latestRecurringCommentary(r)
                return (
                <li key={r.id}>
                  <SwipeBillRow
                    onMarkPaid={() => markBillPaid(r.id)}
                    onSkip={() => skipBill(r.id)}
                    className="rounded-lg md:rounded-none"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm py-1.5">
                      <Link to="/recurring" className="min-w-0 group">
                        <span className="block truncate font-medium group-hover:text-accent">{r.name}</span>
                        <span className={`text-xs text-text-muted tabular-nums ${privacyClass(privacy)}`}>
                          {formatDate(r.nextDue)} · {formatGBP(r.amount)}
                        </span>
                        {billNote ? (
                          <span className="today-bill-commentary block text-xs text-text-subtle font-light mt-0.5 line-clamp-1 group-hover:text-accent">
                            {billNote}
                          </span>
                        ) : null}
                      </Link>
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
                )
              })}
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

      <div
        id="today-tax"
        className="today-tax-strip surface p-3 md:p-4 mb-3 rounded-xl md:rounded-none shadow-sm md:shadow-none flex flex-wrap items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold mb-0.5">
            Tax
          </p>
          <p className="text-sm text-text-muted font-light">
            {todayTaxStrip.detail}
          </p>
        </div>
        <Link to="/tax" className="btn-secondary btn-sm shrink-0">
          Open Tax
        </Link>
      </div>

      <div
        id="today-media"
        className="surface p-4 md:p-5 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none"
      >
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
              className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1.5"
            >
              {l.label} →
              {l.badge === 'todos' && todayTodosDueCount > 0 ? (
                <span className="today-todos-due-badge inline-flex items-center text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full">
                  {todayTodosDueCount}
                </span>
              ) : null}
              {l.badge === 'jobs' && jobsFollowUpCount > 0 ? (
                <span className="today-jobs-follow-up-badge inline-flex items-center text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full">
                  {jobsFollowUpCount}
                </span>
              ) : null}
            </Link>
          ))}
          <div className="inline-flex flex-wrap items-center gap-1.5">
            <Link
              to="/news"
              className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1.5"
            >
              News →
              {newsUnread > 0 ? (
                <span className="today-news-unread inline-flex items-center text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full">
                  {newsUnread} new
                </span>
              ) : null}
            </Link>
            <Link
              to="/news?refresh=1"
              className="btn-ghost btn-sm text-xs min-h-9 today-news-refresh-open"
            >
              Refresh & open
            </Link>
            {newsUnread > 0 ? (
              <button
                type="button"
                className="btn-ghost btn-sm text-xs min-h-9 today-news-mark-all-read"
                onClick={() => {
                  const previousSeenAt = getNewsSeenAt()
                  const previousUnread = newsUnread
                  const now = new Date().toISOString()
                  setNewsSeenAt(now)
                  setNewsUnread(0)
                  setNewsMarkAllUndo({ previousSeenAt, previousUnread })
                  if (newsMarkAllUndoTimer.current) window.clearTimeout(newsMarkAllUndoTimer.current)
                  newsMarkAllUndoTimer.current = window.setTimeout(
                    () => setNewsMarkAllUndo(null),
                    5_000,
                  )
                  toastSuccess('News marked all read')
                }}
              >
                Mark all read
              </button>
            ) : (
              <span className="today-news-all-caught-up text-[11px] text-text-subtle font-medium">
                All caught up
              </span>
            )}
          </div>
          {newsMarkAllUndo ? (
            <div
              className="today-news-mark-all-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
              role="status"
            >
              <p className="text-sm text-text-muted">News marked all read</p>
              <button
                type="button"
                className="btn-secondary btn-sm today-news-mark-all-undo"
                data-testid="today-news-mark-all-undo"
                onClick={() => {
                  setNewsSeenAt(newsMarkAllUndo.previousSeenAt)
                  setNewsUnread(newsMarkAllUndo.previousUnread)
                  setNewsMarkAllUndo(null)
                  if (newsMarkAllUndoTimer.current) {
                    window.clearTimeout(newsMarkAllUndoTimer.current)
                    newsMarkAllUndoTimer.current = null
                  }
                }}
              >
                Undo
              </button>
            </div>
          ) : null}
          <div className="inline-flex flex-wrap items-center gap-1.5">
            <Link
              to="/youtube"
              className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1.5"
            >
              YouTube →
              {youtubeUnread > 0 ? (
                <span className="today-youtube-unread inline-flex items-center text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full">
                  {youtubeUnread} new
                </span>
              ) : null}
            </Link>
            <Link
              to="/youtube?refresh=1"
              className="btn-ghost btn-sm text-xs min-h-9 today-youtube-refresh-open"
            >
              Refresh & open
            </Link>
            {youtubeUnread > 0 ? (
              <button
                type="button"
                className="btn-ghost btn-sm text-xs min-h-9 today-youtube-mark-all-read"
                onClick={() => {
                  const previousSeenAt = getYoutubeSeenAt()
                  const previousUnread = youtubeUnread
                  const now = new Date().toISOString()
                  setYoutubeSeenAt(now)
                  setYoutubeUnread(0)
                  setYoutubeMarkAllUndo({ previousSeenAt, previousUnread })
                  if (youtubeMarkAllUndoTimer.current)
                    window.clearTimeout(youtubeMarkAllUndoTimer.current)
                  youtubeMarkAllUndoTimer.current = window.setTimeout(
                    () => setYoutubeMarkAllUndo(null),
                    5_000,
                  )
                  toastSuccess('YouTube marked all read')
                }}
              >
                Mark all read
              </button>
            ) : (
              <span className="today-youtube-all-caught-up text-[11px] text-text-subtle font-medium">
                All caught up
              </span>
            )}
          </div>
          {youtubeMarkAllUndo ? (
            <div
              className="today-youtube-mark-all-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
              role="status"
            >
              <p className="text-sm text-text-muted">YouTube marked all read</p>
              <button
                type="button"
                className="btn-secondary btn-sm today-youtube-mark-all-undo"
                data-testid="today-youtube-mark-all-undo"
                onClick={() => {
                  setYoutubeSeenAt(youtubeMarkAllUndo.previousSeenAt)
                  setYoutubeUnread(youtubeMarkAllUndo.previousUnread)
                  setYoutubeMarkAllUndo(null)
                  if (youtubeMarkAllUndoTimer.current) {
                    window.clearTimeout(youtubeMarkAllUndoTimer.current)
                    youtubeMarkAllUndoTimer.current = null
                  }
                }}
              >
                Undo
              </button>
            </div>
          ) : null}
        </div>
        {whatArrivedChip ? (
          <div
            className="today-what-arrived-chip mt-3 flex flex-wrap items-center gap-2 text-xs text-accent font-medium"
            role="status"
          >
            <Link to="/settings#sync" className="hover:underline">
              What arrived · {whatArrivedChip}
            </Link>
            {whatArrivedOpenHref ? (
              <Link
                to={whatArrivedOpenHref}
                className="btn-secondary btn-sm text-[11px] min-h-8 today-what-arrived-open"
              >
                Open first
              </Link>
            ) : null}
            <button
              type="button"
              className="btn-ghost btn-sm text-[11px] min-h-8 today-what-arrived-dismiss"
              onClick={() => {
                if (whatArrivedChip) {
                  saveWhatArrivedDismissPref(whatArrivedChip)
                }
                setWhatArrivedChip(null)
                setWhatArrivedOpenHref(null)
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {(newsFetchedAt || youtubeFetchedAt) && relativeTick >= 0 ? (
          <p
            className="today-media-trust mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-subtle"
            role="status"
          >
            {newsFetchedAt ? (
              <span className="today-news-trust">
                News updated {formatQuoteAgeShort(Date.now() - Date.parse(newsFetchedAt))}
              </span>
            ) : null}
            {youtubeFetchedAt ? (
              <span className="today-youtube-trust">
                YouTube updated {formatQuoteAgeShort(Date.now() - Date.parse(youtubeFetchedAt))}
              </span>
            ) : null}
          </p>
        ) : null}
        {fccDataPresent ? null : (
          <p className="text-xs text-text-subtle mt-3 font-light">
            Sample portfolio — import live data in Settings anytime.
          </p>
        )}
      </div>
        </div>

        {twoPane ? (
          <aside
            id="today-markets"
            className="today-markets-pane surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none sticky"
            aria-label="Markets snapshot"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold">Markets</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="today-two-pane-digest-preview text-xs text-accent font-semibold"
                  onClick={openWeeklyDigest}
                  title="Preview and share weekly HTML digest (not emailed)"
                >
                  Digest Preview
                </button>
                <Link to="/markets" className="text-xs text-accent font-semibold">
                  Open
                </Link>
              </div>
            </div>
            {priceLagChip || finnhubQuotaLimited || quoteSlaChip || quotePartialChip ? (
              <div
                className="today-prices-trust mb-2 space-y-1.5"
                role="status"
                aria-label="Prices trust"
              >
                {priceLagChip ? (
                  <p className="today-price-lag-chip text-[11px] text-accent font-medium">
                    {priceLagChip.label}
                  </p>
                ) : null}
                {finnhubQuotaLimited ? (
                  <div className="today-finnhub-quota-chip px-2.5 py-1.5 text-[11px] border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg">
                    Finnhub rate-limited (429) — using Yahoo until quota resets
                  </div>
                ) : null}
                {quoteSlaChip ? (
                  <div className="today-quote-sla-chip px-2.5 py-1.5 text-[11px] border border-border bg-surface/50 rounded-lg">
                    {quoteSlaChip}
                  </div>
                ) : null}
                {quotePartialChip ? (
                  <div className="today-quote-partial-chip px-2.5 py-1.5 text-[11px] border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg">
                    {quotePartialChip}
                  </div>
                ) : null}
              </div>
            ) : null}
            {todayMovers.length === 0 ? (
              <p className="text-sm text-text-muted font-light">
                No fresh movers (last 24h) — open Markets to refresh.
              </p>
            ) : (
              <ul className="space-y-2">
                {todayMovers.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/markets?symbol=${encodeURIComponent(m.symbol)}`}
                      className="flex items-baseline justify-between gap-2 hover:text-accent"
                    >
                      <span className="font-semibold tracking-tight">
                        {m.symbol}
                        {m.fromSync ? (
                          <span className="ml-1 text-[10px] font-medium text-text-subtle">sync</span>
                        ) : null}
                      </span>
                      <span
                        className={`tabular-nums text-sm markets-quote-price ${privacyClass(privacy)} ${
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
              {marketsCount} ticker{marketsCount === 1 ? '' : 's'} watched · movers use quotes from the last 24h
            </p>
          </aside>
        ) : (
          <section
            id="today-markets"
            className="today-markets-pane surface p-4 mb-6 rounded-xl shadow-sm"
            aria-label="Markets snapshot"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold">Markets</p>
              <Link to="/markets" className="text-xs text-accent font-semibold">
                Open
              </Link>
            </div>
            {todayMovers.length === 0 ? (
              <p className="text-sm text-text-muted font-light">
                No fresh movers (last 24h) — open Markets to refresh.
              </p>
            ) : (
              <ul className="space-y-2">
                {todayMovers.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/markets?symbol=${encodeURIComponent(m.symbol)}`}
                      className="flex items-baseline justify-between gap-2 hover:text-accent"
                    >
                      <span className="font-semibold tracking-tight">{m.symbol}</span>
                      <span
                        className={`tabular-nums text-sm markets-quote-price ${privacyClass(privacy)} ${
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
              {marketsCount} ticker{marketsCount === 1 ? '' : 's'} watched · movers use quotes from the last 24h
            </p>
          </section>
        )}
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

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary today actions">
        <button
          type="button"
          className="btn-primary btn-sm inline-flex items-center gap-1.5 today-sync-thumb"
          onClick={() => {
            void syncNow().then(() => toastSuccess('Sync now finished'))
          }}
        >
          Sync now
        </button>
        <Link to="/markets" className="btn-secondary btn-sm inline-flex items-center">
          Markets
        </Link>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center today-digest-thumb"
          onClick={openWeeklyDigest}
        >
          Digest
        </button>
        <Link to="/todos" className="btn-ghost btn-sm inline-flex items-center">
          To Do&apos;s
        </Link>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
