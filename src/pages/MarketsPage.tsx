import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
} from 'lucide-react'
import { Sparkline } from '../components/charts/Sparkline'
import { useToasts } from '../components/ToastProvider'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyStateInline } from '../components/ui/EmptyState'
import { MarketsHoldingsSkeleton } from '../components/ui/MarketsHoldingsSkeleton'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
import { saveNewsFilterTag } from '../domain/newsFilterPrefs'
import {
  loadPriceAlertThresholds,
  savePriceAlertThresholds,
} from '../domain/priceAlerts'
import { applyLastSyncedQuotesToHoldings } from '../domain/lastSyncedHoldings'
import { includedPortfolioHoldingValue } from '../domain/portfolioConcentration'
import { equityUnitPriceGbp } from '../domain/migrateEquityGbp'
import {
  defaultNameForPair,
  formatMarketChangeAbs,
  formatMarketLast,
  MARKET_TICKER_TAGS,
  parseRatePair,
  rateDecimals,
  type MarketAssetKind,
  type MarketQuote,
  type MarketTicker,
  type MarketTickerTag,
  type MarketsDensity,
  type MarketsSectionKey,
} from '../domain/markets'
import { addHoldingsMissingFromWatchlist, holdingsMissingFromWatchlist } from '../domain/addHoldingsToWatchlist'
import {
  checkFxTriangles,
  formatFxTriangleSuggestedRate,
  formatFxTriangleWarning,
  type FxTriangleHit,
} from '../domain/fxTriangle'
import { marketSessionStatus } from '../domain/marketSession'
import { ensureFinnhubSetupTodo, hasFinnhubKey } from '../domain/finnhubReminder'
import {
  formatSlaAge,
  hasStaleSyncedQuotes,
  isPastQuoteFreshnessSla,
  quoteAgeMs,
  QUOTE_FRESHNESS_SLA_MS,
} from '../domain/quoteFreshnessSla'
import { normalizeCommoditySymbol } from '../domain/commodities'
import { shouldShowCachedMode } from '../domain/marketsCachedMode'
import {
  loadShowMarketsTagYieldChips,
  subscribeShowMarketsTagYieldChips,
} from '../domain/marketsTagYieldPref'
import { mergeMarketQuotes } from '../domain/marketQuotesCache'
import { isOnline } from '../services/offlineQueue'
import { sparklineTrendFromSeries } from '../domain/sparklineSeries'
import { refreshMarketQuotes } from '../services/marketsQuotes'
import { getMarketsProviderHealth } from '../services/marketsProviderHealth'
import { syncNow } from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'
import { KNOWN_CRYPTO_SYMBOLS } from '../services/prices'
import { MARKET_TIMEFRAMES, type MarketTimeframe } from '../domain/marketTimeframe'
import {
  addMarketTicker,
  getMarketSectionOrder,
  listMarketTickers,
  loadMarketQuotesCache,
  loadMarketsState,
  removeMarketTicker,
  reorderMarketSections,
  reorderMarketTickersInKind,
  saveMarketQuotesCache,
  setMarketsCollapsed,
  setMarketsDensity,
  getMarketsDensity,
  setMarketsTimeframe,
  getMarketsTimeframe,
  getMarketsTagFilter,
  setMarketsTagFilter,
  getMarketsYieldSort,
  setMarketsYieldSort,
  setMarketsLastRefresh,
  updateMarketTicker,
} from '../storage/marketsStore'
import { loadCachedFxRates } from '../services/fx'
import {
  formatGBP,
  formatGBPMarket,
  formatGBPPrecise,
  formatPct,
  getDisplayCurrency,
  privacyClass,
} from '../utils/format'
import { sortBySortOrder } from '../utils/reorder'
import type { PortfolioData } from '../domain/types'

type FormState = {
  kind: MarketAssetKind
  symbol: string
  name: string
  coingeckoId: string
  notes: string
  tag: MarketTickerTag | ''
  yieldPct: string
  quantity: string
  avgCostGbp: string
  includeInNetWorth: boolean
}

const emptyForm: FormState = {
  kind: 'equity',
  symbol: '',
  name: '',
  coingeckoId: '',
  notes: '',
  tag: '',
  yieldPct: '',
  quantity: '',
  avgCostGbp: '',
  includeInNetWorth: false,
}

function unavailableReason(q: MarketQuote | undefined): string {
  const src = (q?.source || '').toLowerCase()
  if (src === 'none') return 'no print'
  if (src === 'error') return 'provider error'
  if (src === 'invalid') return 'invalid'
  if (src.startsWith('stale:')) return 'stale'
  if (!q) return 'missing'
  if (!(q.last > 0)) return 'empty'
  return 'unavailable'
}

type SectionKey = MarketsSectionKey

const SECTION_META: Record<
  SectionKey,
  { title: string; kind: MarketAssetKind; detailsHref?: string; emptyLabel: string; addLabel: string }
> = {
  crypto: {
    title: 'My Crypto',
    kind: 'crypto',
    detailsHref: '/crypto',
    emptyLabel: 'crypto',
    addLabel: 'Add crypto',
  },
  equities: {
    title: 'My Equities',
    kind: 'equity',
    detailsHref: '/equities',
    emptyLabel: 'equity',
    addLabel: 'Add equity',
  },
  commodities: {
    title: 'My Commodities',
    kind: 'commodity',
    emptyLabel: 'commodity',
    addLabel: 'Add commodity',
  },
  indices: {
    title: 'Indices',
    kind: 'index',
    emptyLabel: 'index',
    addLabel: 'Add index',
  },
  fx: {
    title: 'FX Rates',
    kind: 'fx',
    emptyLabel: 'FX',
    addLabel: 'Add FX rate',
  },
  crosses: {
    title: 'Crypto Crosses',
    kind: 'cross',
    emptyLabel: 'crypto cross',
    addLabel: 'Add cross',
  },
}

const SECTION_JUMP_LABEL: Record<SectionKey, string> = {
  crypto: 'Crypto',
  equities: 'Equities',
  commodities: 'Commodities',
  indices: 'Indices',
  fx: 'FX',
  crosses: 'Crosses',
}

function ChangeBadge({ pct }: { pct: number }) {
  const up = pct > 0
  const flat = Math.abs(pct) < 0.005
  const cls = flat
    ? 'bg-surface-hover text-text-muted'
    : up
      ? 'bg-emerald-600/90 text-white'
      : 'bg-red-600/90 text-white'
  return (
    <span
      className={`inline-flex min-w-[4.25rem] justify-center px-2 py-1 text-xs font-semibold tabular-nums rounded-md ${cls}`}
    >
      {formatPct(pct, 2)}
    </span>
  )
}

function formatLastDisplay(q: MarketQuote | undefined): string {
  if (!q || !(q.last > 0)) return '—'
  // Indices stay in native points; FX/crosses stay in quote units
  if (q.kind === 'index' || q.kind === 'fx' || q.kind === 'cross') {
    return formatMarketLast(q)
  }
  // Crypto + equity quotes are stored in GBP — convert to the toolbar display CCY
  return formatGBPMarket(q.last)
}

function matchesMarketsSearch(t: MarketTicker, query: string): boolean {
  if (!query) return true
  const haystack = `${t.symbol} ${t.name}`.toLowerCase()
  return haystack.includes(query)
}

function normPortfolioSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^\^/, '')
}

function sortByYieldDesc(tickers: MarketTicker[]): MarketTicker[] {
  return [...tickers].sort((a, b) => {
    const ay = a.yieldPct != null && a.yieldPct > 0 ? a.yieldPct : -1
    const by = b.yieldPct != null && b.yieldPct > 0 ? b.yieldPct : -1
    if (by !== ay) return by - ay
    return a.sortOrder - b.sortOrder
  })
}

function fxTriangleSuggestion(
  hit: FxTriangleHit,
  tickers: MarketTicker[],
): { ticker: MarketTicker; rate: number; pair: string } | null {
  const target = parseRatePair(hit.pairs[2])
  if (!target || !(hit.implied > 0)) return null
  for (const ticker of tickers) {
    const pair = parseRatePair(ticker.symbol)
    if (!pair) continue
    if (pair.base === target.base && pair.quote === target.quote) {
      return { ticker, rate: hit.implied, pair: hit.pairs[2] }
    }
    if (pair.base === target.quote && pair.quote === target.base) {
      return { ticker, rate: 1 / hit.implied, pair: `${target.quote}/${target.base}` }
    }
  }
  return null
}

/** Freshest quote `updatedAt` in the section, else Markets `lastRefreshAt`. */
function sectionAsOfIso(
  tickers: MarketTicker[],
  quotes: Map<string, MarketQuote>,
  lastRefreshAt?: string,
): string | null {
  let freshest = 0
  for (const t of tickers) {
    const at = quotes.get(t.id)?.updatedAt
    if (!at) continue
    const ms = Date.parse(at)
    if (Number.isFinite(ms) && ms > freshest) freshest = ms
  }
  if (!freshest && lastRefreshAt) {
    const ms = Date.parse(lastRefreshAt)
    if (Number.isFinite(ms)) freshest = ms
  }
  if (!freshest) return null
  return new Date(freshest).toISOString()
}

function formatMarketsRelative(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function formatMarketsAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sectionTotals(
  tickers: MarketTicker[],
  quotes: Map<string, MarketQuote>,
  holdingsValueBySymbol: Map<string, number>,
) {
  let value = 0
  let prevValue = 0
  let matched = 0
  let avgPct = 0
  let pctCount = 0

  for (const t of tickers) {
    const q = quotes.get(t.id)
    if (!q || !(q.last > 0)) continue
    pctCount++
    avgPct += q.changePct

    if (t.kind === 'fx' || t.kind === 'cross' || t.kind === 'index') continue

    const held = holdingsValueBySymbol.get(t.symbol.toUpperCase())
    if (held != null && held > 0) {
      matched++
      const qtyImplied = held / q.last
      value += held
      prevValue += held - q.changeAbs * qtyImplied
    }
  }

  const changeAbs = value - prevValue
  const changePct = prevValue > 0 ? (changeAbs / prevValue) * 100 : pctCount ? avgPct / pctCount : 0
  return { value, changeAbs, changePct, matched, avgPct: pctCount ? avgPct / pctCount : 0 }
}

function symbolPlaceholder(kind: MarketAssetKind): string {
  if (kind === 'crypto') return 'BTC'
  if (kind === 'equity') return 'TSLA'
  if (kind === 'commodity') return 'GC=F'
  if (kind === 'index') return 'SPX'
  if (kind === 'fx') return 'GBP/USD'
  return 'ADA/BTC'
}

function namePlaceholder(kind: MarketAssetKind): string {
  if (kind === 'crypto') return 'Bitcoin'
  if (kind === 'equity') return 'Tesla, Inc.'
  if (kind === 'commodity') return 'Gold'
  if (kind === 'index') return 'S&P 500'
  if (kind === 'fx') return 'British Pound / US Dollar'
  return 'Cardano / Bitcoin'
}

/** Seed missing watchlist prints from portfolio / FX cache so first paint is never blank. */
function seedQuotesFromPortfolio(
  tickers: MarketTicker[],
  data: PortfolioData,
  base: Map<string, MarketQuote>,
): Map<string, MarketQuote> {
  const now = new Date().toISOString()
  const out = new Map(base)
  const fxRates = loadCachedFxRates()
  for (const t of tickers) {
    if (out.get(t.id)?.last && (out.get(t.id)?.last ?? 0) > 0) continue
    if (t.kind === 'crypto') {
      const h = data.crypto.find((c) => c.symbol.toUpperCase() === t.symbol.toUpperCase())
      if (h && h.price > 0) {
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'crypto',
          last: h.price,
          changeAbs: 0,
          changePct: 0,
          sparkline: [],
          unit: 'GBP',
          decimals: h.price < 1 ? 4 : 2,
          source: 'portfolio',
          updatedAt: now,
        })
      }
    } else if (t.kind === 'equity') {
      const h = data.equities.find((e) => e.symbol.toUpperCase() === t.symbol.toUpperCase())
      const px = h && h.livePrice > 0 ? h.livePrice : h && h.avgCost > 0 ? h.avgCost : 0
      if (h && px > 0) {
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'equity',
          last: px,
          changeAbs: 0,
          changePct: 0,
          sparkline: [],
          unit: 'GBP',
          decimals: 2,
          source: 'portfolio',
          updatedAt: now,
        })
      }
    } else if (t.kind === 'fx') {
      const pair = parseRatePair(t.symbol)
      if (!pair) continue
      let rate = 0
      if (pair.base === 'GBP' && (fxRates[pair.quote] ?? 0) > 0) {
        rate = fxRates[pair.quote]!
      } else if (pair.quote === 'GBP' && (fxRates[pair.base] ?? 0) > 0) {
        rate = 1 / fxRates[pair.base]!
      }
      if (rate > 0) {
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'fx',
          last: rate,
          changeAbs: 0,
          changePct: 0,
          sparkline: [],
          unit: pair.quote,
          decimals: rateDecimals(pair.quote),
          source: 'fx-cache',
          updatedAt: now,
        })
      }
    }
  }
  return out
}

function ageLabel(iso: string): string | null {
  try {
    const t = new Date(iso).getTime()
    if (!Number.isFinite(t)) return null
    const mins = Math.round((Date.now() - t) / 60_000)
    if (mins < 2) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 48) return `${hrs}h ago`
  } catch {
    /* ignore */
  }
  return null
}

function isStaleQuote(q: MarketQuote | undefined): boolean {
  if (!q) return false
  if (
    q.source.startsWith('stale:') ||
    q.source.startsWith('sync:') ||
    q.source === 'portfolio' ||
    q.source === 'fx-cache'
  ) {
    return true
  }
  try {
    const t = new Date(q.updatedAt).getTime()
    if (Number.isFinite(t) && Date.now() - t > 4 * 60 * 60 * 1000) return true
  } catch {
    /* ignore */
  }
  return false
}

function freshnessLabel(q: MarketQuote | undefined): string | null {
  if (!q || !(q.last > 0)) return null
  const src = (q.source || '').toLowerCase()
  if (src.startsWith('sync:')) {
    const age = ageLabel(q.updatedAt)
    return age ? `From other device · ${age}` : 'From other device'
  }
  if (isStaleQuote(q)) {
    const age = ageLabel(q.updatedAt)
    return age ? `Last synced · ${age}` : 'Last synced'
  }
  if (src.includes('yahoo') || src.includes('finnhub') || src.includes('coingecko') || src.includes('frankfurter')) {
    return 'Live'
  }
  if (src.includes('exchangerate')) return 'Live · spot'
  return null
}

/** Row status under price — avoid eternal “Fetching…” when Yahoo returned empty. */
function quoteAvailabilityLabel(
  q: MarketQuote | undefined,
  opts: { refreshing: boolean },
): string | null {
  const live = freshnessLabel(q)
  if (live) return live
  if (q && !(q.last > 0)) {
    const src = (q.source || '').toLowerCase()
    if (src === 'none' || src === 'error' || src === 'invalid' || src.startsWith('stale:')) {
      return 'Unavailable'
    }
    if (opts.refreshing) return 'Fetching…'
    return 'Unavailable'
  }
  if (opts.refreshing) return 'Fetching…'
  return null
}

export function MarketsPage() {
  const { data, privacy, setData } = usePortfolio()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError, showToast } = useToasts()
  const [searchParams, setSearchParams] = useSearchParams()
  const [undoRemove, setUndoRemove] = useState<MarketTicker | null>(null)
  const undoTimer = useRef<number | null>(null)
  const [undoRetag, setUndoRetag] = useState<{
    ticker: MarketTicker
    previousTag: MarketTicker['tag']
  } | null>(null)
  const undoRetagTimer = useRef<number | null>(null)
  const [tickers, setTickers] = useState(() => listMarketTickers())
  const [collapsed, setCollapsed] = useState(() => loadMarketsState().collapsed)
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => getMarketSectionOrder())
  const [showMarketsTagYieldChips, setShowMarketsTagYieldChips] = useState(() =>
    loadShowMarketsTagYieldChips(),
  )
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(() => {
    const cached = loadMarketQuotesCache()
    return seedQuotesFromPortfolio(listMarketTickers(), data, cached)
  })
  const [refreshing, setRefreshing] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [error, setError] = useState<string | null>(() => {
    try {
      const raw = sessionStorage.getItem('mydsp_markets_sync_prices_report_v1')
      return raw && raw.trim() ? raw : null
    } catch {
      return null
    }
  })
  const persistSyncPricesReport = useCallback((msg: string | null) => {
    setError(msg)
    try {
      if (msg && msg.startsWith('Sync prices:')) {
        sessionStorage.setItem('mydsp_markets_sync_prices_report_v1', msg)
      } else {
        sessionStorage.removeItem('mydsp_markets_sync_prices_report_v1')
      }
    } catch {
      /* ignore */
    }
  }, [])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MarketTicker | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [addKind, setAddKind] = useState<MarketAssetKind | null>(null)
  const [sorting, setSorting] = useState(false)
  const [sectionSorting, setSectionSorting] = useState(false)
  const [density, setDensity] = useState<MarketsDensity>(() => getMarketsDensity())
  const [timeframe, setTimeframe] = useState<MarketTimeframe>(() => getMarketsTimeframe())
  const [sectionRefreshing, setSectionRefreshing] = useState<SectionKey | null>(null)
  const [syncingPrices, setSyncingPrices] = useState(false)
  const [justSyncedPulse, setJustSyncedPulse] = useState(false)
  const [focusSymbol, setFocusSymbol] = useState<string | null>(null)
  const [quoteDetail, setQuoteDetail] = useState<{ ticker: MarketTicker; quote?: MarketQuote } | null>(
    null,
  )
  const [priceAlertEdit, setPriceAlertEdit] = useState<{
    key: string
    changePct: string
  } | null>(null)
  const [retagTicker, setRetagTicker] = useState<MarketTicker | null>(null)
  const [fxExplainerOpen, setFxExplainerOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<MarketTickerTag | 'All'>(() => getMarketsTagFilter())
  const [searchText, setSearchText] = useState('')
  const [yieldSort, setYieldSort] = useState(() => getMarketsYieldSort())
  const [online, setOnline] = useState(() => isOnline())
  const [relativeTick, setRelativeTick] = useState(0)
  const [activeJumpSection, setActiveJumpSection] = useState<SectionKey | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const applyYieldSort = useCallback((next: boolean) => {
    setYieldSort(next)
    setMarketsYieldSort(next)
  }, [])
  const longPressTimer = useRef<number | null>(null)
  const sectionLongPressTimer = useRef<number | null>(null)
  const refreshInFlight = useRef(false)
  const pendingRetryOnline = useRef(false)
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes
  const tickersRef = useRef(tickers)
  tickersRef.current = tickers
  const providerHealth = useMemo(() => getMarketsProviderHealth(), [quotes, refreshing])
  const finnhubQuotaLimited = useMemo(() => {
    const fh = providerHealth.find((p) => p.id === 'finnhub')
    if (!fh?.lastError || !/429|quota/i.test(fh.lastError)) return false
    // Show when lastError is a 429/quota hit (including consecutiveFailures >= 1 with that error).
    return true
  }, [providerHealth])

  useEffect(() => {
    return subscribeShowMarketsTagYieldChips(() => {
      setShowMarketsTagYieldChips(loadShowMarketsTagYieldChips())
    })
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

  /** Highlight the jump chip for the section currently in view. */
  useEffect(() => {
    const elements = sectionOrder
      .map((section) => document.getElementById(`markets-section-${section}`))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) return

    const ratios = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let best: SectionKey | null = null
        let bestRatio = 0
        for (const section of sectionOrder) {
          const ratio = ratios.get(`markets-section-${section}`) ?? 0
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = section
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
  }, [sectionOrder, tickers.length, sectionSorting])

  const cachedMode = useMemo(
    () => shouldShowCachedMode(online, quotes.values()),
    [online, quotes],
  )

  // Deep-link: /markets?symbol=BTC expands section + scrolls to row
  useEffect(() => {
    const raw = searchParams.get('symbol')
    if (!raw) return
    const want = raw.trim().toUpperCase()
    const wantCommodity = normalizeCommoditySymbol(want)
    const hit = tickers.find((t) => {
      const sym = t.symbol.toUpperCase()
      if (sym === want || sym.replace('^', '') === want.replace('^', '')) return true
      if (t.kind === 'commodity' && wantCommodity && normalizeCommoditySymbol(sym) === wantCommodity) {
        return true
      }
      return false
    })
    setSearchParams({}, { replace: true })
    if (!hit) return
    const section =
      hit.kind === 'crypto'
        ? 'crypto'
        : hit.kind === 'equity'
          ? 'equities'
          : hit.kind === 'commodity'
            ? 'commodities'
            : hit.kind === 'index'
              ? 'indices'
              : hit.kind === 'fx'
                ? 'fx'
                : 'crosses'
    setCollapsed((prev) => {
      if (!prev[section]) return prev
      const next = { ...prev, [section]: false }
      setMarketsCollapsed(section, false)
      return next
    })
    setFocusSymbol(hit.symbol)
  }, [searchParams, tickers, setSearchParams])

  useEffect(() => {
    if (!focusSymbol) return
    const id = `market-${focusSymbol.replace(/[^a-zA-Z0-9]/g, '_')}`
    const tryScroll = () => {
      const el = document.getElementById(id)
      if (!el) return false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
    if (tryScroll()) {
      const clear = window.setTimeout(() => setFocusSymbol(null), 2500)
      return () => window.clearTimeout(clear)
    }
    const retry = window.setTimeout(() => {
      tryScroll()
      window.setTimeout(() => setFocusSymbol(null), 2500)
    }, 120)
    return () => window.clearTimeout(retry)
  }, [focusSymbol, collapsed, tickers])

  const searchQuery = searchText.trim().toLowerCase()

  const activeTagFilter = showMarketsTagYieldChips ? tagFilter : 'All'
  const activeYieldSort = showMarketsTagYieldChips ? yieldSort : false

  /** Search → expand section and scroll/select the first match. */
  useEffect(() => {
    if (!searchQuery) return
    const tagged =
      activeTagFilter === 'All'
        ? tickers
        : tickers.filter((t) => t.tag === activeTagFilter)
    const hit = tagged.find((t) => matchesMarketsSearch(t, searchQuery))
    if (!hit) return
    const section: SectionKey =
      hit.kind === 'crypto'
        ? 'crypto'
        : hit.kind === 'equity'
          ? 'equities'
          : hit.kind === 'commodity'
            ? 'commodities'
            : hit.kind === 'index'
              ? 'indices'
              : hit.kind === 'fx'
                ? 'fx'
                : 'crosses'
    setCollapsed((prev) => {
      if (!prev[section]) return prev
      const next = { ...prev, [section]: false }
      setMarketsCollapsed(section, false)
      return next
    })
    setFocusSymbol(hit.symbol)
    setQuoteDetail((prev) => {
      const q = loadMarketQuotesCache().get(hit.id)
      if (prev?.ticker.id === hit.id) return { ticker: hit, quote: q ?? prev.quote }
      return { ticker: hit, quote: q }
    })
  }, [searchQuery, activeTagFilter, tickers])

  const bySection = useMemo(
    () => {
      const tagged =
        activeTagFilter === 'All'
          ? tickers
          : tickers.filter((t) => t.tag === activeTagFilter)
      const filtered = searchQuery
        ? tagged.filter((t) => matchesMarketsSearch(t, searchQuery))
        : tagged
      const equities = filtered.filter((t) => t.kind === 'equity')
      return {
        crypto: filtered.filter((t) => t.kind === 'crypto'),
        equities: activeYieldSort ? sortByYieldDesc(equities) : equities,
        commodities: filtered.filter((t) => t.kind === 'commodity'),
        indices: filtered.filter((t) => t.kind === 'index'),
        fx: filtered.filter((t) => t.kind === 'fx'),
        crosses: filtered.filter((t) => t.kind === 'cross'),
      }
    },
    [tickers, activeTagFilter, searchQuery, activeYieldSort],
  )

  const fxTriangleHits = useMemo(() => {
    const fxQuotes = bySection.fx
      .map((t) => {
        const q = quotes.get(t.id)
        return q && q.last > 0 ? { symbol: t.symbol, last: q.last } : null
      })
      .filter((x): x is { symbol: string; last: number } => x != null)
    return checkFxTriangles(fxQuotes)
  }, [bySection.fx, quotes])

  const firstFxTriangleSuggestion = useMemo(
    () => (fxTriangleHits[0] ? fxTriangleSuggestion(fxTriangleHits[0], bySection.fx) : null),
    [fxTriangleHits, bySection.fx],
  )

  const statusHint = useMemo(() => {
    if (error) return error
    if (sectionSorting) {
      return 'Drag ⋮⋮ on section headers to reorder My Crypto / Equities / …'
    }
    if (sorting) {
      return 'Drag ⋮⋮ to reorder tickers within each section.'
    }
    return null
  }, [error, sorting, sectionSorting])

  const cryptoHoldingsValue = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of data.crypto) {
      if (c.includeInPortfolio === false) continue
      const sym = c.symbol.toUpperCase()
      map.set(sym, (map.get(sym) ?? 0) + c.qty * c.price)
    }
    return map
  }, [data.crypto])

  const equityHoldingsValue = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data.equities) {
      if (e.includeInPortfolio === false) continue
      const sym = e.symbol.toUpperCase()
      map.set(sym, (map.get(sym) ?? 0) + e.shares * e.livePrice)
    }
    return map
  }, [data.equities])

  /** Paper commodity holdings from Markets ticker quantity × last quote (GBP). */
  const commodityHoldingsValue = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tickers) {
      if (t.kind !== 'commodity') continue
      if (!(t.quantity != null && t.quantity > 0)) continue
      const q = quotes.get(t.id)
      if (!q || !(q.last > 0)) continue
      map.set(t.symbol.toUpperCase(), t.quantity * q.last)
    }
    return map
  }, [tickers, quotes])

  const includedPortfolioValue = useMemo(() => includedPortfolioHoldingValue(data), [data])

  const ownedHoldingWeightByKey = useMemo(() => {
    const map = new Map<string, number>()
    if (!(includedPortfolioValue > 0)) return map
    for (const c of data.crypto) {
      if (c.includeInPortfolio === false) continue
      const key = `crypto:${normPortfolioSymbol(c.symbol)}`
      map.set(key, (map.get(key) ?? 0) + c.qty * c.price)
    }
    for (const e of data.equities) {
      if (e.includeInPortfolio === false) continue
      const key = `equity:${normPortfolioSymbol(e.symbol)}`
      map.set(key, (map.get(key) ?? 0) + e.shares * equityUnitPriceGbp(e))
    }
    for (const [key, value] of map) {
      map.set(key, value / includedPortfolioValue)
    }
    return map
  }, [data.crypto, data.equities, includedPortfolioValue])

  const ownedHoldingRouteByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of sortBySortOrder(data.crypto)) {
      const key = `crypto:${normPortfolioSymbol(c.symbol)}`
      if (!map.has(key)) map.set(key, `/crypto/${c.id}`)
    }
    for (const e of sortBySortOrder(data.equities)) {
      const key = `equity:${normPortfolioSymbol(e.symbol)}`
      if (!map.has(key)) map.set(key, `/equities/${e.id}`)
    }
    return map
  }, [data.crypto, data.equities])

  const reloadList = useCallback(() => {
    setTickers(listMarketTickers())
    const state = loadMarketsState()
    setCollapsed(state.collapsed)
    setSectionOrder(getMarketSectionOrder())
  }, [])

  const refresh = useCallback(async (kind?: MarketAssetKind) => {
    const list = kind ? listMarketTickers(kind) : listMarketTickers()
    if (!kind && list.length === 0) {
      setQuotes(new Map())
      saveMarketQuotesCache(new Map())
      return
    }
    if (list.length === 0) return
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    setRefreshing(true)
    setError(null)
    try {
      const finnhubKey =
        data.settings.finnhubKey || localStorage.getItem('finnhub_key') || ''
      const next = await refreshMarketQuotes(list, {
        finnhubKey,
        manualCryptoPrices: data.settings.manualCryptoPrices,
        timeframe,
      })
      const allTickers = listMarketTickers()
      const previous = seedQuotesFromPortfolio(allTickers, data, quotesRef.current)
      const merged = mergeMarketQuotes(previous, next)
      setQuotes(merged)
      // Mark workspace dirty so quote cache + holdings push to other devices promptly
      saveMarketQuotesCache(merged, { markDirty: true })
      // Push live Markets prints into holdings so Equities / net worth stay real-time
      setData((prev) => applyLastSyncedQuotesToHoldings(prev, { overwrite: true }).data)
      const at = new Date().toISOString()
      setMarketsLastRefresh(at)
      const liveCount = [...merged.values()].filter((q) => q.last > 0 && !isStaleQuote(q)).length
      const shown = [...merged.values()].filter((q) => q.last > 0).length
      if (!kind && shown < allTickers.length) {
        setError(
          `Showing ${shown}/${allTickers.length} prices` +
            (liveCount < shown ? ` (${shown - liveCount} cached)` : '') +
            ' — retrying sources shortly.',
        )
      }
    } catch (e) {
      // Keep last-good quotes on total failure
      setError(e instanceof Error ? e.message : 'Price refresh failed — showing last synced prices')
    } finally {
      refreshInFlight.current = false
      setRefreshing(false)
      setInitialLoad(false)
    }
  }, [data, setData, timeframe])

  const refreshSection = useCallback(
    async (section: SectionKey) => {
      const kind = SECTION_META[section].kind
      setSectionRefreshing(section)
      try {
        await refresh(kind)
      } finally {
        setSectionRefreshing(null)
      }
    },
    [refresh],
  )

  /** Refresh quotes, mark dirty, and push immediately when cloud sync is configured. */
  const syncPricesNow = useCallback(async () => {
    if (syncingPrices) return
    setSyncingPrices(true)
    try {
      await refresh()
      if (!isOnline()) {
        setError('Offline — quotes refreshed from cache only; cloud sync skipped')
        setJustSyncedPulse(true)
        window.setTimeout(() => setJustSyncedPulse(false), 2800)
        return
      }
      const list = listMarketTickers()
      const latest = loadMarketQuotesCache()
      let live = 0
      let failed = 0
      for (const t of list) {
        const q = latest.get(t.id) ?? quotesRef.current.get(t.id)
        if (q && q.last > 0) live++
        if (quoteAvailabilityLabel(q, { refreshing: false }) === 'Unavailable') failed++
      }
      const cfg = loadSyncConfig()
      if (cfg.enabled && cfg.remoteUrl.trim()) {
        await syncNow()
      }
      if (failed > 0) {
        persistSyncPricesReport(`Sync prices: ${live} live · ${failed} failed`)
      } else if (!cfg.enabled || !cfg.remoteUrl.trim()) {
        persistSyncPricesReport(null)
        setError('Prices refreshed locally — enable Cloud Sync in Settings to push to other devices')
      } else {
        persistSyncPricesReport(null)
      }
      setJustSyncedPulse(true)
      window.setTimeout(() => setJustSyncedPulse(false), 2800)
    } finally {
      setSyncingPrices(false)
    }
  }, [refresh, syncingPrices, persistSyncPricesReport])

  const retryUnavailable = useCallback(async () => {
    if (!isOnline()) {
      pendingRetryOnline.current = true
      setError('You are offline — retry unavailable quotes when back online')
      return
    }
    pendingRetryOnline.current = false
    const unavailableKinds = new Set<MarketAssetKind>()
    for (const t of tickers) {
      const q = quotes.get(t.id)
      if (quoteAvailabilityLabel(q, { refreshing: false }) === 'Unavailable') {
        unavailableKinds.add(t.kind)
      }
    }
    if (unavailableKinds.size === 0) {
      await refresh()
      return
    }
    for (const kind of unavailableKinds) {
      await refresh(kind)
    }
  }, [tickers, quotes, refresh])

  const quoteNeedsStaleRetry = useCallback((q: MarketQuote | undefined) => {
    if (quoteAvailabilityLabel(q, { refreshing: false }) === 'Unavailable') return true
    if (isStaleQuote(q)) return true
    if (q && (q.source || '').startsWith('sync:') && isPastQuoteFreshnessSla(q)) return true
    return false
  }, [])

  const hasStaleOrUnavailable = useMemo(() => {
    for (const t of tickers) {
      if (quoteNeedsStaleRetry(quotes.get(t.id))) return true
    }
    return false
  }, [tickers, quotes, quoteNeedsStaleRetry])

  const retryAllStale = useCallback(async () => {
    if (!isOnline()) {
      pendingRetryOnline.current = true
      setError('You are offline — retry stale quotes when back online')
      return
    }
    pendingRetryOnline.current = false
    const kinds = new Set<MarketAssetKind>()
    for (const t of tickers) {
      if (quoteNeedsStaleRetry(quotes.get(t.id))) kinds.add(t.kind)
    }
    if (kinds.size === 0) {
      await refresh()
      return
    }
    for (const kind of kinds) {
      await refresh(kind)
    }
  }, [tickers, quotes, refresh, quoteNeedsStaleRetry])

  /** Keep quote modal / detail panel in sync with live quotes + ticker edits. */
  useEffect(() => {
    setQuoteDetail((prev) => {
      if (!prev) return prev
      const t = tickers.find((x) => x.id === prev.ticker.id)
      if (!t) return null
      return { ticker: t, quote: quotes.get(t.id) ?? prev.quote }
    })
  }, [tickers, quotes])

  const densityTrust = useMemo(() => {
    let collapsedCount = 0
    let hiddenSparklines = 0
    if (!searchQuery) {
      for (const section of sectionOrder) {
        if (!collapsed[section]) continue
        collapsedCount += 1
        for (const t of bySection[section]) {
          const q = quotes.get(t.id)
          if (q && q.sparkline.length > 1) hiddenSparklines += 1
        }
      }
    }
    return { collapsedCount, hiddenSparklines }
  }, [searchQuery, sectionOrder, collapsed, bySection, quotes])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      const wasPendingRetry = pendingRetryOnline.current
      const hasUnavailable = tickersRef.current.some(
        (t) =>
          quoteAvailabilityLabel(quotesRef.current.get(t.id), { refreshing: false }) ===
          'Unavailable',
      )
      if (hasUnavailable || wasPendingRetry) {
        pendingRetryOnline.current = false
        if (wasPendingRetry) {
          setError(null)
          showToast({
            type: 'success',
            title: 'Back online',
            message: 'Retrying unavailable quotes',
            className: 'markets-back-online-toast',
          })
        }
        void retryUnavailable()
      }
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [retryUnavailable, showToast])

  useEffect(() => {
    const onQuotes = () => {
      const map = loadMarketQuotesCache()
      const hasSync = [...map.values()].some((q) => (q.source || '').startsWith('sync:'))
      if (hasSync) {
        setJustSyncedPulse(true)
        window.setTimeout(() => setJustSyncedPulse(false), 2800)
      }
    }
    const onRefresh = () => {
      void refresh()
    }
    window.addEventListener('mydsp-markets-quotes', onQuotes)
    window.addEventListener('mydsp-markets-refresh', onRefresh)
    return () => {
      window.removeEventListener('mydsp-markets-quotes', onQuotes)
      window.removeEventListener('mydsp-markets-refresh', onRefresh)
    }
  }, [refresh])

  const slaChip = useMemo(() => {
    const list = [...quotes.values()].filter((q) => q.last > 0)
    if (!hasStaleSyncedQuotes(list)) return null
    let oldest = 0
    for (const q of list) {
      if (!(q.source || '').startsWith('sync:')) continue
      const age = quoteAgeMs(q)
      if (age != null && age > oldest) oldest = age
    }
    if (oldest <= QUOTE_FRESHNESS_SLA_MS) return null
    return `Synced quotes past ${formatSlaAge(QUOTE_FRESHNESS_SLA_MS)} SLA · oldest ${formatSlaAge(oldest)}`
  }, [quotes])

  const finnhubMissing = !hasFinnhubKey(data)

  const applySuggestedFxRate = useCallback(
    (suggestion: { ticker: MarketTicker; rate: number }) => {
      const now = new Date().toISOString()
      setQuotes((prev) => {
        const pair = parseRatePair(suggestion.ticker.symbol)
        const current = prev.get(suggestion.ticker.id)
        const next = new Map(prev)
        next.set(suggestion.ticker.id, {
          symbol: suggestion.ticker.symbol,
          kind: 'fx',
          last: suggestion.rate,
          changeAbs: current?.changeAbs ?? 0,
          changePct: current?.changePct ?? 0,
          sparkline: current?.sparkline ?? [],
          unit: pair?.quote ?? suggestion.ticker.symbol.split('/')[1] ?? '',
          decimals: pair ? rateDecimals(pair.quote) : current?.decimals ?? 4,
          source: 'fx-triangle-suggested',
          updatedAt: now,
        })
        saveMarketQuotesCache(next)
        return next
      })
      setMarketsLastRefresh(now)
      setError(`Suggested cross applied to ${suggestion.ticker.symbol}`)
    },
    [],
  )

  const addFromHoldings = useCallback(
    (kind: 'equity' | 'crypto') => {
      const holdings =
        kind === 'crypto'
          ? data.crypto.map((c) => ({ symbol: c.symbol, name: c.name }))
          : data.equities.map((e) => ({ symbol: e.symbol, name: e.name }))
      const result = addHoldingsMissingFromWatchlist(holdings, kind)
      reloadList()
      if (result.added.length > 0) void refresh(kind)
      else if (result.errors.length > 0) setError(result.errors[0] ?? 'Could not add holdings')
      else setError('All portfolio symbols are already on this watchlist')
    },
    [data.crypto, data.equities, refresh, reloadList],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  // If holdings load after first paint, seed any still-blank rows from portfolio prices
  useEffect(() => {
    setQuotes((prev) => {
      const seeded = seedQuotesFromPortfolio(tickers, data, prev)
      let changed = false
      for (const [id, q] of seeded) {
        const old = prev.get(id)
        if ((!old || !(old.last > 0)) && q.last > 0) {
          changed = true
          break
        }
      }
      if (!changed) return prev
      saveMarketQuotesCache(seeded)
      return seeded
    })
  }, [data, tickers])

  useEffect(() => {
    const onChanged = () => reloadList()
    window.addEventListener('mydsp-markets-changed', onChanged)
    return () => window.removeEventListener('mydsp-markets-changed', onChanged)
  }, [reloadList])

  useEffect(() => {
    const onGlobal = () => void refresh()
    window.addEventListener('mydsp-global-refresh', onGlobal)
    return () => window.removeEventListener('mydsp-global-refresh', onGlobal)
  }, [refresh])

  useEffect(() => {
    // Back off slightly vs 30s to reduce Yahoo CORS-proxy hammering while tabs stay open
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 45_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const openCreate = (kind: MarketAssetKind) => {
    setEditing(null)
    setAddKind(kind)
    setForm({ ...emptyForm, kind })
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (t: MarketTicker) => {
    setEditing(t)
    setAddKind(null)
    setForm({
      kind: t.kind,
      symbol: t.symbol,
      name: t.name,
      coingeckoId: t.coingeckoId ?? '',
      notes: t.notes ?? '',
      tag: t.tag ?? '',
      yieldPct: t.yieldPct != null && t.yieldPct > 0 ? String(t.yieldPct) : '',
      quantity: t.quantity != null && t.quantity > 0 ? String(t.quantity) : '',
      avgCostGbp: t.avgCostGbp != null && t.avgCostGbp >= 0 ? String(t.avgCostGbp) : '',
      includeInNetWorth: Boolean(t.includeInNetWorth),
    })
    setFormError(null)
    setModalOpen(true)
  }

  const save = () => {
    try {
      const name =
        form.name.trim() || defaultNameForPair(form.kind, form.symbol)
      const yieldNum =
        form.yieldPct.trim() === '' ? null : Number(form.yieldPct)
      const qtyNum =
        form.quantity.trim() === '' ? null : Number(form.quantity)
      const costNum =
        form.avgCostGbp.trim() === '' ? null : Number(form.avgCostGbp)
      if (form.kind === 'equity' && form.yieldPct.trim() !== '' && !(yieldNum != null && yieldNum > 0)) {
        setFormError('Yield % must be a positive number.')
        return
      }
      if (form.kind === 'commodity' && form.quantity.trim() !== '' && !(qtyNum != null && qtyNum > 0)) {
        setFormError('Quantity must be a positive number.')
        return
      }
      if (form.kind === 'commodity' && form.avgCostGbp.trim() !== '' && !(costNum != null && costNum >= 0)) {
        setFormError('Avg cost must be zero or a positive number.')
        return
      }
      if (
        form.kind === 'commodity' &&
        form.avgCostGbp.trim() !== '' &&
        form.quantity.trim() === ''
      ) {
        setFormError('Add a paper quantity when setting avg cost.')
        return
      }
      const origYieldStr =
        editing && editing.yieldPct != null && editing.yieldPct > 0
          ? String(editing.yieldPct)
          : ''
      const yieldTouched =
        form.kind === 'equity' &&
        (editing ? form.yieldPct.trim() !== origYieldStr : form.yieldPct.trim() !== '')
      const yieldManualPatch =
        form.kind === 'equity'
          ? yieldTouched
            ? true
            : editing?.yieldManual
          : undefined
      if (editing) {
        updateMarketTicker(editing.id, {
          kind: form.kind,
          symbol: form.symbol,
          name,
          coingeckoId: form.coingeckoId,
          notes: form.notes,
          tag: form.tag,
          yieldPct: form.kind === 'equity' ? yieldNum : null,
          yieldManual: yieldManualPatch,
          quantity: form.kind === 'commodity' ? qtyNum : null,
          avgCostGbp: form.kind === 'commodity' ? costNum : null,
          includeInNetWorth: form.kind === 'commodity' ? form.includeInNetWorth : null,
        })
      } else {
        addMarketTicker({
          kind: form.kind,
          symbol: form.symbol,
          name,
          coingeckoId: form.coingeckoId || undefined,
          notes: form.notes || undefined,
          tag: form.tag,
          yieldPct: form.kind === 'equity' ? yieldNum : null,
          yieldManual: form.kind === 'equity' ? yieldManualPatch : undefined,
          quantity: form.kind === 'commodity' ? qtyNum ?? undefined : undefined,
          avgCostGbp: form.kind === 'commodity' ? costNum ?? undefined : undefined,
          includeInNetWorth: form.kind === 'commodity' ? form.includeInNetWorth : undefined,
        })
      }
      setModalOpen(false)
      reloadList()
      void refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save')
    }
  }

  const toggleSection = (section: SectionKey) => {
    const next = !collapsed[section]
    setMarketsCollapsed(section, next)
    setCollapsed((c) => ({ ...c, [section]: next }))
  }

  const setAllSectionsCollapsed = useCallback((value: boolean) => {
    const next = {
      crypto: value,
      equities: value,
      commodities: value,
      indices: value,
      fx: value,
      crosses: value,
    } as const
    for (const section of Object.keys(next) as SectionKey[]) {
      setMarketsCollapsed(section, value)
    }
    setCollapsed({ ...next })
  }, [])

  const openPriceAlertForSymbol = useCallback((symbol: string) => {
    const key = symbol.trim()
    if (!key) return
    const existing = loadPriceAlertThresholds().find(
      (th) =>
        th.key.toUpperCase() === key.toUpperCase() ||
        th.key.replace('^', '').toUpperCase() === key.replace('^', '').toUpperCase(),
    )
    setPriceAlertEdit({
      key: existing?.key ?? key,
      changePct: String(existing?.changePct ?? 3),
    })
  }, [])

  const applyTickerTag = useCallback(
    (ticker: MarketTicker, tag: MarketTickerTag | '') => {
      const previousTag = ticker.tag
      updateMarketTicker(ticker.id, { tag })
      reloadList()
      setQuoteDetail((prev) =>
        prev && prev.ticker.id === ticker.id
          ? { ...prev, ticker: { ...prev.ticker, tag: tag || undefined } }
          : prev,
      )
      setRetagTicker(null)
      setUndoRetag({ ticker, previousTag })
      if (undoRetagTimer.current) window.clearTimeout(undoRetagTimer.current)
      undoRetagTimer.current = window.setTimeout(() => setUndoRetag(null), 8_000)
      toastSuccess(
        tag ? `Tagged ${ticker.symbol}` : `Cleared tag on ${ticker.symbol}`,
        tag ? tag : 'No folder tag',
      )
    },
    [reloadList, toastSuccess],
  )

  const renderSection = (section: SectionKey) => {
    const meta = SECTION_META[section]
    const items = bySection[section]
    const holdings =
      section === 'crypto'
        ? cryptoHoldingsValue
        : section === 'equities'
          ? equityHoldingsValue
          : section === 'commodities'
            ? commodityHoldingsValue
            : new Map<string, number>()
    const totals = sectionTotals(items, quotes, holdings)
    const isCollapsed = searchQuery ? false : collapsed[section]
    const isRateSection = section === 'fx' || section === 'crosses' || section === 'indices'
    const asOfIso = sectionAsOfIso(items, quotes, loadMarketsState().lastRefreshAt)
    const asOf = asOfIso
      ? `Updated ${formatMarketsRelative(asOfIso)}${relativeTick >= 0 ? '' : ''} · ${formatMarketsAbsolute(asOfIso)}`
      : null
    const sectionBusy = sectionRefreshing === section || refreshing

    return (
      <section
        key={section}
        id={`markets-section-${section}`}
        role="tabpanel"
        aria-labelledby={`markets-jump-${section}`}
        className={`border border-border bg-bg-elevated overflow-hidden ${sectionSorting ? '' : 'mb-6'}`}
      >
        <div
          className={`markets-section-sticky sticky z-[5] bg-bg-elevated px-4 sm:px-5 flex items-start justify-between gap-3 border-b border-border ${density === 'compact' ? 'pt-3 pb-2' : 'pt-4 pb-3'}`}
          onContextMenu={(e) => {
            if (sectionSorting) return
            e.preventDefault()
            setSorting(false)
            applyYieldSort(false)
            setSectionSorting(true)
          }}
          onTouchStart={() => {
            if (sectionSorting) return
            if (sectionLongPressTimer.current) window.clearTimeout(sectionLongPressTimer.current)
            sectionLongPressTimer.current = window.setTimeout(() => {
              setSorting(false)
              applyYieldSort(false)
              setSectionSorting(true)
            }, 520)
          }}
          onTouchMove={() => {
            if (sectionLongPressTimer.current) {
              window.clearTimeout(sectionLongPressTimer.current)
              sectionLongPressTimer.current = null
            }
          }}
          onTouchEnd={() => {
            if (sectionLongPressTimer.current) {
              window.clearTimeout(sectionLongPressTimer.current)
              sectionLongPressTimer.current = null
            }
          }}
          onTouchCancel={() => {
            if (sectionLongPressTimer.current) {
              window.clearTimeout(sectionLongPressTimer.current)
              sectionLongPressTimer.current = null
            }
          }}
        >
          <div className="min-w-0 flex items-start gap-2">
            {sectionSorting ? (
              <ReorderHandle label={`Reorder ${meta.title} section`} />
            ) : null}
            <div className="min-w-0">
            <p className={`font-bold tracking-tight text-text mb-1 ${density === 'compact' ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>{meta.title}</p>
            <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${privacyClass(privacy)}`}>
              <p className="label-uppercase text-[11px] text-text-subtle tabular-nums">
                {isRateSection
                  ? items.length > 0
                    ? `${items.length} ${section === 'indices' ? 'index' : 'rate'}${items.length === 1 ? '' : section === 'indices' ? 'es' : 's'}`
                    : '—'
                  : totals.matched > 0
                    ? formatGBPPrecise(totals.value)
                    : items.length > 0
                      ? `${items.length} ticker${items.length === 1 ? '' : 's'}`
                      : '—'}
              </p>
              <p
                className={`text-[11px] font-medium tabular-nums ${
                  totals.changePct > 0
                    ? 'text-emerald-500'
                    : totals.changePct < 0
                      ? 'text-red-500'
                      : 'text-text-muted'
                }`}
              >
                {isRateSection
                  ? formatPct(totals.avgPct, 2)
                  : totals.matched > 0
                    ? `${formatGBP(totals.changeAbs, { signed: true })} (${formatPct(totals.changePct, 2)})`
                    : formatPct(totals.avgPct, 2)}
              </p>
              {asOf ? (
                <p className="markets-section-asof text-[11px] text-text-subtle tabular-nums">{asOf}</p>
              ) : null}
            </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {section === 'fx' ? (
              <button
                type="button"
                className="btn-ghost btn-sm p-2 min-h-10 min-w-10"
                aria-label="Why FX quotes convert to display currency"
                onClick={() => setFxExplainerOpen(true)}
              >
                <HelpCircle size={16} strokeWidth={1.75} />
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost btn-sm p-2 min-h-10 min-w-10"
              aria-label={`Refresh ${meta.title}`}
              disabled={sectionBusy}
              onClick={() => void refreshSection(section)}
            >
              <RefreshCw
                size={16}
                strokeWidth={1.75}
                className={sectionRefreshing === section ? 'animate-spin' : undefined}
              />
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm p-2 min-h-10 min-w-10"
              aria-label={isCollapsed ? `Expand ${meta.title}` : `Collapse ${meta.title}`}
              onClick={() => toggleSection(section)}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {items.length === 0 ? (
              <div className="px-4 py-4 space-y-3">
                <EmptyStateInline
                  illustration
                  message={
                    searchQuery
                      ? `No ${meta.emptyLabel} matches "${searchText.trim()}".`
                      : activeTagFilter !== 'All'
                        ? `No ${meta.emptyLabel} tagged ${activeTagFilter}.`
                        : `No ${meta.emptyLabel} yet — add one or seed a preset.`
                  }
                  action={
                    searchQuery || activeTagFilter !== 'All'
                      ? undefined
                      : { label: meta.addLabel, onClick: () => openCreate(meta.kind) }
                  }
                />
                {!searchQuery &&
                activeTagFilter === 'All' &&
                (section === 'crypto' ||
                  section === 'equities' ||
                  section === 'commodities' ||
                  section === 'indices') ? (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {(section === 'crypto'
                      ? [
                          { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto' as const },
                          { symbol: 'ETH', name: 'Ethereum', kind: 'crypto' as const },
                        ]
                      : section === 'equities'
                        ? [
                            { symbol: 'AAPL', name: 'Apple', kind: 'equity' as const },
                            { symbol: 'MSFT', name: 'Microsoft', kind: 'equity' as const },
                          ]
                        : section === 'commodities'
                          ? [
                              { symbol: 'GC=F', name: 'Gold', kind: 'commodity' as const },
                              { symbol: 'SI=F', name: 'Silver', kind: 'commodity' as const },
                              { symbol: 'HG=F', name: 'Copper', kind: 'commodity' as const },
                              { symbol: 'CL=F', name: 'Crude oil (WTI)', kind: 'commodity' as const },
                              { symbol: 'BZ=F', name: 'Brent crude', kind: 'commodity' as const },
                              { symbol: 'NG=F', name: 'Natural gas', kind: 'commodity' as const },
                            ]
                          : [
                              { symbol: '^GSPC', name: 'S&P 500', kind: 'index' as const },
                              { symbol: '^FTSE', name: 'FTSE 100', kind: 'index' as const },
                            ]
                    ).map((preset) => (
                      <button
                        key={preset.symbol}
                        type="button"
                        className="btn-secondary btn-sm min-h-11"
                        onClick={() => {
                          try {
                            addMarketTicker({
                              kind: preset.kind,
                              symbol: preset.symbol,
                              name: preset.name,
                            })
                            reloadList()
                            void refresh()
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Could not add preset')
                          }
                        }}
                      >
                        + {preset.symbol}
                      </button>
                    ))}
                    {section === 'crypto' || section === 'equities' ? (
                      (() => {
                        const kind = section === 'crypto' ? 'crypto' : 'equity'
                        const holdings =
                          kind === 'crypto'
                            ? data.crypto.map((c) => ({ symbol: c.symbol, name: c.name }))
                            : data.equities.map((e) => ({ symbol: e.symbol, name: e.name }))
                        const missing = holdingsMissingFromWatchlist(holdings, kind)
                        if (missing.length === 0) return null
                        return (
                          <button
                            type="button"
                            className="btn-primary btn-sm min-h-11"
                            onClick={() => addFromHoldings(kind)}
                          >
                            Add from holding ({missing.length})
                          </button>
                        )
                      })()
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {(() => {
                  const liveCount = items.filter((item) => {
                    const q = quotes.get(item.id)
                    const label = quoteAvailabilityLabel(q, { refreshing: sectionBusy })
                    return label === 'Live' || label === 'Live · spot'
                  }).length
                  const unavailableItems = items.filter((item) => {
                    const q = quotes.get(item.id)
                    return quoteAvailabilityLabel(q, { refreshing: sectionBusy }) === 'Unavailable'
                  })
                  const unavailableCount = unavailableItems.length
                  const reasonBits = unavailableItems
                    .slice(0, 4)
                    .map((item) => `${item.symbol} (${unavailableReason(quotes.get(item.id))})`)
                    .join(' · ')
                  if (liveCount > 0 && unavailableCount > 0) {
                    return (
                      <div
                        className="markets-section-mixed px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-amber-500/8"
                        role="status"
                      >
                        <span className="text-[11px] text-text-muted">
                          {liveCount} live · {unavailableCount} unavailable
                          {reasonBits ? ` — ${reasonBits}` : ''}
                          {unavailableCount > 4 ? '…' : ''}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary btn-sm min-h-9"
                          disabled={sectionBusy}
                          aria-label={`Retry ${unavailableCount} unavailable in ${SECTION_JUMP_LABEL[section]}`}
                          onClick={() => void refreshSection(section)}
                        >
                          Retry unavailable
                        </button>
                      </div>
                    )
                  }
                  if (items.length > 0 && unavailableCount === items.length) {
                    return (
                      <div
                        className="markets-section-mixed px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-amber-500/8"
                        role="status"
                      >
                        <span className="text-[11px] text-text-muted">
                          All quotes unavailable
                          {reasonBits ? ` — ${reasonBits}` : ''}
                          {unavailableCount > 4 ? '…' : ''}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary btn-sm min-h-9"
                          disabled={sectionBusy}
                          aria-label={`Retry all unavailable in ${SECTION_JUMP_LABEL[section]}`}
                          onClick={() => void refreshSection(section)}
                        >
                          Retry section
                        </button>
                      </div>
                    )
                  }
                  const staleSynced = items.filter((t) => {
                    const q = quotes.get(t.id)
                    return Boolean(q && (q.source || '').startsWith('sync:') && isPastQuoteFreshnessSla(q))
                  })
                  if (staleSynced.length > 0) {
                    const oldestMs = Math.max(
                      ...staleSynced.map((t) => quoteAgeMs(quotes.get(t.id)) ?? 0),
                    )
                    return (
                      <div
                        className="markets-section-stale px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-amber-500/8"
                        role="status"
                      >
                        <span className="text-[11px] text-text-muted">
                          {staleSynced.length} stale from sync
                          {oldestMs > 0 ? ` · oldest ${formatSlaAge(oldestMs)}` : ''}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary btn-sm min-h-9"
                          disabled={sectionBusy}
                          aria-label={`Retry stale quotes in ${SECTION_JUMP_LABEL[section]}`}
                          onClick={() => void refreshSection(section)}
                        >
                          Retry section
                        </button>
                      </div>
                    )
                  }
                  return null
                })()}
              <ReorderList
                items={items}
                getId={(t) => t.id}
                onReorder={(next) => {
                  reorderMarketTickersInKind(
                    meta.kind,
                    next.map((t) => t.id),
                  )
                  reloadList()
                }}
                className={`divide-y divide-border${justSyncedPulse ? ' markets-list--just-synced' : ''}`}
              >
                {(t) => {
                  const q = quotes.get(t.id)
                  const pct = q?.changePct ?? 0
                  const trend = sparklineTrendFromSeries(q?.sparkline ?? [])
                  const showSpark = Boolean(q && q.sparkline.length > 1)
                  const compact = density === 'compact'
                  const focused = focusSymbol === t.symbol
                  const fromSync = Boolean(q && (q.source || '').startsWith('sync:'))
                  const ownedRoute =
                    t.kind === 'crypto' || t.kind === 'equity'
                      ? ownedHoldingRouteByKey.get(`${t.kind}:${normPortfolioSymbol(t.symbol)}`)
                      : undefined
                  const ownedWeight =
                    t.kind === 'crypto' || t.kind === 'equity'
                      ? ownedHoldingWeightByKey.get(`${t.kind}:${normPortfolioSymbol(t.symbol)}`)
                      : undefined
                  return (
                    <div
                      id={`market-${t.symbol.replace(/[^a-zA-Z0-9]/g, '_')}`}
                      tabIndex={0}
                      aria-label={`${t.symbol}${t.name ? ` · ${t.name}` : ''}${
                        quoteDetail?.ticker.id === t.id ? ' (selected)' : ''
                      }`}
                      className={`markets-row px-4 sm:px-5 flex items-center gap-2 sm:gap-4 ${
                        compact ? 'py-2 min-h-11' : 'py-3.5'
                      } ${focused ? 'ring-2 ring-inset ring-accent bg-accent/5' : ''} ${
                        isStaleQuote(q) || (fromSync && isPastQuoteFreshnessSla(q))
                          ? 'markets-row--stale'
                          : ''
                      }${fromSync ? ' markets-row--from-sync' : ''}${
                        justSyncedPulse && fromSync ? ' sync-just-added' : ''
                      }${quoteDetail?.ticker.id === t.id ? ' markets-row--selected' : ''}`}
                      onClick={() => setQuoteDetail({ ticker: t, quote: q })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setQuoteDetail({ ticker: t, quote: q })
                        }
                      }}
                      onTouchStart={() => {
                        if (sorting) return
                        if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
                        longPressTimer.current = window.setTimeout(() => {
                          setSorting(true)
                          longPressTimer.current = null
                        }, 520)
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer.current) {
                          window.clearTimeout(longPressTimer.current)
                          longPressTimer.current = null
                        }
                      }}
                      onTouchMove={() => {
                        if (longPressTimer.current) {
                          window.clearTimeout(longPressTimer.current)
                          longPressTimer.current = null
                        }
                      }}
                    >
                      {sorting ? <ReorderHandle label={`Reorder ${t.symbol}`} /> : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-text tracking-tight">{t.symbol}</p>
                          {(t.kind === 'equity' || t.kind === 'index' || t.kind === 'commodity') &&
                            (() => {
                              const session = marketSessionStatus(t.symbol, t.kind)
                              if (!session) return null
                              return (
                                <span
                                  className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 border ${
                                    session.open
                                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                                      : 'border-border text-text-subtle'
                                  }`}
                                  title={session.hint}
                                >
                                  {session.label}
                                </span>
                              )
                            })()}
                          {t.tag ? (
                            showMarketsTagYieldChips ? (
                              <button
                                type="button"
                                className="markets-row-tag-filter text-[10px] uppercase tracking-wider text-accent font-semibold hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setTagFilter(t.tag!)
                                  setMarketsTagFilter(t.tag!)
                                }}
                              >
                                {t.tag}
                              </button>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wider text-text-subtle">
                                {t.tag}
                              </span>
                            )
                          ) : null}
                          {ownedRoute ? (
                            <Link
                              to={ownedRoute}
                              className="markets-owned-chip text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 border border-accent/40 text-accent hover:bg-accent/10"
                              title={
                                ownedWeight != null
                                  ? `Owned · ${(ownedWeight * 100).toFixed(1)}% of included portfolio`
                                  : 'Owned holding'
                              }
                              aria-label={
                                ownedWeight != null
                                  ? `Owned holding detail for ${t.symbol}, ${(ownedWeight * 100).toFixed(1)}% portfolio weight`
                                  : `Owned holding detail for ${t.symbol}`
                              }
                            >
                              Owned
                            </Link>
                          ) : null}
                        </div>
                        {!compact ? (
                          <p className="text-xs text-text-muted truncate">{t.name}</p>
                        ) : null}
                        {t.notes ? (
                          <p className="text-[11px] text-text-subtle truncate mt-0.5" title={t.notes}>
                            {t.notes}
                          </p>
                        ) : null}
                        {t.kind === 'equity' && t.yieldPct != null && t.yieldPct > 0 ? (
                          <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                            Yield {t.yieldPct.toFixed(t.yieldPct >= 10 ? 1 : 2)}%
                          </p>
                        ) : null}
                      </div>

                      {showSpark ? (
                        <button
                          type="button"
                          className="w-14 sm:w-16 shrink-0 rounded-md hover:bg-surface-hover/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          aria-label={`${t.symbol} ${timeframe} sparkline detail`}
                          onClick={() => setQuoteDetail({ ticker: t, quote: q })}
                        >
                          <Sparkline
                            data={q!.sparkline}
                            height={compact ? 20 : 28}
                            showGradient={false}
                            trend={trend}
                          />
                        </button>
                      ) : (
                        <div className="w-14 sm:w-16 shrink-0" />
                      )}

                      <div className={`text-right shrink-0 ${privacyClass(privacy)}`}>
                        <p className="markets-quote-price text-sm font-medium tabular-nums text-text">
                          {formatLastDisplay(q)}
                        </p>
                        {(() => {
                          const label = quoteAvailabilityLabel(q, {
                            refreshing: sectionBusy && !(q != null && q.last > 0),
                          })
                          if (!label) return null
                          const stale = isStaleQuote(q)
                          const unavailable = label === 'Unavailable'
                          return (
                            <p
                              className={`text-[11px] mt-0.5 ${
                                unavailable
                                  ? 'text-text-subtle'
                                  : stale
                                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                    : 'text-text-muted font-medium'
                              }`}
                            >
                              {label}
                            </p>
                          )
                        })()}
                        {t.kind === 'commodity' &&
                        t.quantity != null &&
                        t.quantity > 0 &&
                        t.avgCostGbp != null &&
                        q &&
                        q.last > 0 ? (
                          <p
                            className={`text-[11px] mt-0.5 tabular-nums text-text-subtle ${privacyClass(privacy)}`}
                          >
                            Paper P&L{' '}
                            {formatGBP(t.quantity * q.last - t.quantity * t.avgCostGbp, {
                              signed: true,
                            })}
                          </p>
                        ) : null}
                        {t.kind === 'commodity' && t.includeInNetWorth ? (
                          <p
                            className={`markets-paper-nw-chip text-[11px] mt-0.5 font-semibold text-accent tabular-nums ${privacyClass(privacy)}`}
                            title="Included in net worth"
                          >
                            NW
                            {t.quantity != null && t.quantity > 0 && q && q.last > 0
                              ? ` · ${formatGBP(t.quantity * q.last)}`
                              : ''}
                          </p>
                        ) : null}
                        <div className="mt-1 flex flex-col items-end gap-0.5">
                          <ChangeBadge pct={pct} />
                          {(section === 'fx' || section === 'crosses' || section === 'indices') &&
                          q &&
                          q.last > 0 ? (
                            <span className="text-[11px] text-text-subtle tabular-nums">
                              {formatMarketChangeAbs(q)}
                            </span>
                          ) : null}
                          {q?.extendedHours ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] tabular-nums ${
                                q.extendedHours.changePct >= 0
                                  ? 'text-emerald-500'
                                  : 'text-red-500'
                              }`}
                            >
                              {q.extendedHours.session === 'pre' ? (
                                <Sun size={10} strokeWidth={2} />
                              ) : (
                                <Moon size={10} strokeWidth={2} />
                              )}
                              {formatPct(q.extendedHours.changePct, 2)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {compact ? (
                          <OverflowMenu
                            className="markets-retag"
                            label={`Actions for ${t.symbol}`}
                            items={[
                              {
                                id: 'edit',
                                label: 'Edit',
                                onClick: () => openEdit(t),
                              },
                              {
                                id: 'retag',
                                label: t.tag ? `Retag (${t.tag})` : 'Retag',
                                onClick: () => setRetagTicker(t),
                              },
                              ...(t.kind === 'commodity'
                                ? [
                                    {
                                      id: 'paper-nw',
                                      label: t.includeInNetWorth
                                        ? 'Exclude from NW'
                                        : 'Include in NW',
                                      onClick: () => {
                                        updateMarketTicker(t.id, {
                                          includeInNetWorth: !t.includeInNetWorth,
                                        })
                                        reloadList()
                                      },
                                    },
                                  ]
                                : []),
                              {
                                id: 'remove',
                                label: 'Remove',
                                destructive: true,
                                onClick: () => setDeleteId(t.id),
                              },
                            ]}
                          />
                        ) : (
                          <div
                            className="flex flex-row gap-1"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <OverflowMenu
                              className="markets-retag"
                              label={`Retag ${t.symbol}`}
                              items={[
                                {
                                  id: 'retag',
                                  label: t.tag ? `Retag (${t.tag})` : 'Retag',
                                  onClick: () => setRetagTicker(t),
                                },
                                ...(t.kind === 'commodity'
                                  ? [
                                      {
                                        id: 'paper-nw',
                                        label: t.includeInNetWorth
                                          ? 'Exclude from NW'
                                          : 'Include in NW',
                                        onClick: () => {
                                          updateMarketTicker(t.id, {
                                            includeInNetWorth: !t.includeInNetWorth,
                                          })
                                          reloadList()
                                        },
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                            <button
                              type="button"
                              className="btn-ghost btn-sm p-2 min-h-11 min-w-11"
                              aria-label={`Edit ${t.symbol}`}
                              onClick={() => openEdit(t)}
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm p-2 min-h-11 min-w-11 text-red-500"
                              aria-label={`Remove ${t.symbol}`}
                              onClick={() => setDeleteId(t.id)}
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }}
              </ReorderList>
              </>
            )}

            <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-sm text-accent inline-flex items-center gap-1.5"
                  onClick={() => openCreate(meta.kind)}
                >
                  <Plus size={14} strokeWidth={2} />
                  {meta.addLabel}
                </button>
                {(section === 'crypto' || section === 'equities') &&
                  (() => {
                    const kind = section === 'crypto' ? 'crypto' : 'equity'
                    const holdings =
                      kind === 'crypto'
                        ? data.crypto.map((c) => ({ symbol: c.symbol, name: c.name }))
                        : data.equities.map((e) => ({ symbol: e.symbol, name: e.name }))
                    const missing = holdingsMissingFromWatchlist(holdings, kind)
                    if (missing.length === 0) return null
                    return (
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-accent"
                        onClick={() => addFromHoldings(kind)}
                      >
                        Add from holding ({missing.length})
                      </button>
                    )
                  })()}
              </div>
              {meta.detailsHref ? (
                <Link
                  to={meta.detailsHref}
                  className="text-sm text-accent hover:underline inline-flex items-center gap-1"
                >
                  View details →
                </Link>
              ) : (
                <span className="text-xs text-text-subtle">
                  {sorting
                    ? `Drag ⋮⋮ to reorder · ${timeframe} sparkline`
                    : `${timeframe} % · ${timeframe} sparkline`}
                </span>
              )}
            </div>
          </>
        )}
      </section>
    )
  }

  const modalTitle = editing
    ? 'Edit Markets item'
    : addKind === 'crypto'
      ? 'Add crypto'
      : addKind === 'commodity'
        ? 'Add commodity'
        : addKind === 'fx'
          ? 'Add FX rate'
          : addKind === 'cross'
            ? 'Add crypto cross'
            : addKind === 'index'
              ? 'Add index'
              : 'Add equity'

  return (
    <div>
      <PageHeader
        eyebrow="Prices"
        title="Markets"
        action={
          <div className="hidden sm:flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm inline-flex items-center gap-1.5"
              disabled={refreshing || syncingPrices}
              aria-label="Sync prices now — refresh quotes and push to other devices"
              onClick={() => void syncPricesNow()}
            >
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={refreshing || syncingPrices ? 'animate-spin' : undefined}
              />
              {syncingPrices || refreshing ? 'Syncing…' : 'Sync prices'}
            </button>
            <span className="inline-flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`btn-ghost btn-sm ${
                  density === 'compact' ? 'border-accent text-accent' : ''
                }`}
                aria-pressed={density === 'compact'}
                aria-label={
                  density === 'comfortable'
                    ? 'Switch to compact density'
                    : 'Switch to comfortable density'
                }
                onClick={() => {
                  const next: MarketsDensity =
                    density === 'comfortable' ? 'compact' : 'comfortable'
                  setMarketsDensity(next)
                  setDensity(next)
                }}
              >
                {density === 'comfortable' ? 'Compact' : 'Comfortable'}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm markets-expand-all"
                data-testid="markets-expand-all"
                aria-label="Expand all Markets sections"
                onClick={() => setAllSectionsCollapsed(false)}
              >
                Expand all
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm markets-collapse-all"
                data-testid="markets-collapse-all"
                aria-label="Collapse all Markets sections"
                onClick={() => setAllSectionsCollapsed(true)}
              >
                Collapse all
              </button>
              <span
                className="markets-density-trust text-xs text-text-muted tabular-nums"
                role="status"
                aria-label={`${densityTrust.hiddenSparklines} sparklines hidden, ${densityTrust.collapsedCount} sections collapsed`}
              >
                {densityTrust.hiddenSparklines} sparkline
                {densityTrust.hiddenSparklines === 1 ? '' : 's'} hidden ·{' '}
                {densityTrust.collapsedCount} section
                {densityTrust.collapsedCount === 1 ? '' : 's'} collapsed
              </span>
            </span>
            <button
              type="button"
              className={`btn-secondary inline-flex items-center gap-2 ${sorting ? 'border-accent text-accent' : ''}`}
              aria-pressed={sorting}
              onClick={() => {
                applyYieldSort(false)
                setSectionSorting(false)
                setSorting((v) => !v)
              }}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sorting ? 'Done' : 'Sort'}
            </button>
            <button
              type="button"
              className={`btn-secondary inline-flex items-center gap-2 ${sectionSorting ? 'border-accent text-accent' : ''}`}
              aria-pressed={sectionSorting}
              aria-label={sectionSorting ? 'Done reordering sections' : 'Reorder Markets sections'}
              onClick={() => {
                applyYieldSort(false)
                setSorting(false)
                setSectionSorting((v) => !v)
              }}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sectionSorting ? 'Done' : 'Sections'}
            </button>
          </div>
        }
      />

      {statusHint ? (
        <p className="text-xs text-text-subtle mb-2" role="status">
          {statusHint}
        </p>
      ) : null}
      {finnhubMissing ? (
        <div
          className="markets-finnhub-missing-chip mb-3 px-3 py-2 text-xs border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
        >
          Finnhub key missing on this device — equities rely on Yahoo.{' '}
          <Link to="/settings#prices" className="font-semibold underline hover:no-underline">
            Add key in Settings
          </Link>
        </div>
      ) : null}
      {finnhubQuotaLimited ? (
        <div
          className="markets-finnhub-quota-chip mb-3 px-3 py-2 text-xs border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
        >
          Finnhub rate-limited (429) — using Yahoo until quota resets
        </div>
      ) : null}
      {slaChip ? (
        <div
          className="markets-quote-sla-chip mb-3 px-3 py-2 text-xs border border-border bg-surface/50 rounded-lg md:rounded-none flex flex-wrap items-center justify-between gap-2"
          role="status"
        >
          <span>{slaChip}</span>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-9"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            Refresh now
          </button>
        </div>
      ) : null}
      <div className="markets-sticky-toolbar sticky z-[9] -mx-1 mb-3 bg-bg/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="markets-in-list-search surface border border-border-strong px-3 py-2">
          <label className="sr-only" htmlFor="markets-search-input">
            Search watchlist
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="markets-search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSearchText('')
                }
              }}
              placeholder="Search watchlist by symbol or name"
              aria-label="Search watchlist by symbol or name"
              className="min-w-[14rem] flex-1"
            />
            {searchText ? (
              <button
                type="button"
                className="btn-ghost btn-sm markets-search-clear"
                data-testid="markets-search-clear"
                aria-label="Clear markets search"
                onClick={() => setSearchText('')}
              >
                Clear
              </button>
            ) : null}
            {hasStaleOrUnavailable ? (
              <button
                type="button"
                className="btn-secondary btn-sm markets-retry-all-stale"
                data-testid="markets-retry-all-stale"
                disabled={refreshing}
                aria-label="Retry all stale and unavailable quotes"
                onClick={() => void retryAllStale()}
              >
                Retry all stale
              </button>
            ) : null}
          </div>
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Sparkline and percent change timeframe"
            onKeyDown={(e) => {
              const idx = MARKET_TIMEFRAMES.indexOf(timeframe)
              if (idx < 0) return
              let next = idx
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                next = (idx + 1) % MARKET_TIMEFRAMES.length
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                next = (idx - 1 + MARKET_TIMEFRAMES.length) % MARKET_TIMEFRAMES.length
              } else if (e.key === 'Home') {
                next = 0
              } else if (e.key === 'End') {
                next = MARKET_TIMEFRAMES.length - 1
              } else {
                return
              }
              e.preventDefault()
              const tf = MARKET_TIMEFRAMES[next]!
              setMarketsTimeframe(tf)
              setTimeframe(tf)
              const el = document.getElementById(`markets-tf-${tf}`)
              el?.focus()
            }}
          >
            {MARKET_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                id={`markets-tf-${tf}`}
                type="button"
                role="tab"
                className={`btn-sm min-h-9 px-2.5 tabular-nums markets-timeframe ${
                  timeframe === tf ? 'btn-secondary border-accent text-accent' : 'btn-ghost'
                }`}
                data-testid="markets-timeframe"
                aria-selected={timeframe === tf}
                tabIndex={timeframe === tf ? 0 : -1}
                onClick={() => {
                  if (tf === timeframe) return
                  setMarketsTimeframe(tf)
                  setTimeframe(tf)
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <nav
          className="markets-section-jump-chips"
          role="tablist"
          aria-label="Jump to market section"
          onKeyDown={(e) => {
            const idx = Math.max(
              0,
              sectionOrder.indexOf(activeJumpSection ?? sectionOrder[0]!),
            )
            let next = idx
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              next = (idx + 1) % sectionOrder.length
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              next = (idx - 1 + sectionOrder.length) % sectionOrder.length
            } else if (e.key === 'Home') {
              next = 0
            } else if (e.key === 'End') {
              next = sectionOrder.length - 1
            } else {
              return
            }
            e.preventDefault()
            const section = sectionOrder[next]!
            setActiveJumpSection(section)
            document
              .getElementById(`markets-jump-${section}`)
              ?.focus()
            document
              .getElementById(`markets-section-${section}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          {sectionOrder.map((section) => {
            const active = activeJumpSection === section
            const unavailableCount = bySection[section].filter(
              (t) =>
                quoteAvailabilityLabel(quotes.get(t.id), { refreshing: false }) === 'Unavailable',
            ).length
            const baseLabel = SECTION_JUMP_LABEL[section]
            const ariaLabel =
              unavailableCount > 0
                ? `${baseLabel} · ${unavailableCount} unavailable`
                : baseLabel
            return (
              <a
                key={section}
                id={`markets-jump-${section}`}
                href={`#markets-section-${section}`}
                role="tab"
                aria-controls={`markets-section-${section}`}
                tabIndex={active || (!activeJumpSection && section === sectionOrder[0]) ? 0 : -1}
                className={`markets-section-jump-chip btn-ghost btn-sm${
                  active ? ' markets-section-jump-chip--active border-accent text-accent' : ''
                }${unavailableCount > 0 ? ' markets-jump-unavailable' : ''}`}
                aria-selected={active ? true : false}
                aria-current={active ? 'true' : undefined}
                aria-label={
                  unavailableCount > 0 ? `${ariaLabel} — retry section` : ariaLabel
                }
                title={
                  unavailableCount > 0
                    ? `${ariaLabel} — click to jump and retry`
                    : undefined
                }
                onClick={(e) => {
                  if (unavailableCount <= 0) return
                  e.preventDefault()
                  setCollapsed((prev) => {
                    if (!prev[section]) return prev
                    const next = { ...prev, [section]: false }
                    setMarketsCollapsed(section, false)
                    return next
                  })
                  document
                    .getElementById(`markets-section-${section}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  void refreshSection(section)
                }}
              >
                {unavailableCount > 0
                  ? `${baseLabel} · ${unavailableCount}`
                  : baseLabel}
              </a>
            )
          })}
        </nav>
      </div>

      {cachedMode ? (
        <div
          id="markets-cached-mode-banner"
          className="markets-cached-mode-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          <p className="font-semibold">Cached mode</p>
          <p className="text-xs mt-0.5 opacity-90">
            {!online
              ? 'You are offline — showing last-good quotes from cache.'
              : 'Live quotes unavailable or stale — showing last-good cached prices.'}
          </p>
        </div>
      ) : null}

      {fxTriangleHits.length > 0 ? (
        <div
          className="markets-fx-triangle-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">FX triangle check</p>
          <p className="text-xs mt-0.5 opacity-90">
            {formatFxTriangleWarning(fxTriangleHits[0]!)}
            {fxTriangleHits.length > 1
              ? ` · +${fxTriangleHits.length - 1} more`
              : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs opacity-90">
              Suggested cross: {formatFxTriangleSuggestedRate(fxTriangleHits[0]!)}
            </p>
            {firstFxTriangleSuggestion ? (
              <button
                type="button"
                className="btn-secondary btn-sm bg-bg-elevated/80"
                onClick={() => applySuggestedFxRate(firstFxTriangleSuggestion)}
              >
                Use suggested
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showMarketsTagYieldChips ? (
        <div
          className="markets-sticky-filters flex flex-wrap gap-2 mb-5"
          role="group"
          aria-label="Filter and sort watchlist"
          data-testid="markets-sticky-filters"
        >
          {(['All', ...MARKET_TICKER_TAGS] as const).map((tag) => {
            const on = tagFilter === tag
            const slug = tag.toLowerCase().replace(/\s+/g, '-')
            return (
              <button
                key={tag}
                type="button"
                className={`btn-sm markets-tag-filter ${on ? 'btn-primary' : 'btn-ghost'}`}
                data-testid={`markets-tag-filter-${slug}`}
                aria-pressed={on}
                onClick={() => {
                  setTagFilter(tag)
                  setMarketsTagFilter(tag)
                }}
              >
                {tag}
              </button>
            )
          })}
          <button
            type="button"
            className={`btn-sm markets-yield-sort ${yieldSort ? 'btn-primary' : 'btn-ghost'}`}
            data-testid="markets-yield-sort"
            aria-pressed={yieldSort}
            onClick={() => {
              applyYieldSort(!yieldSort)
              setSorting(false)
              setSectionSorting(false)
            }}
            title="Sort equity watchlist by dividend yield"
          >
            Yield %
          </button>
        </div>
      ) : (
        <p className="markets-tag-yield-settings-hint mb-4 text-xs text-text-muted">
          Tag + Yield chips are hidden.
          <Link
            to="/settings#prices"
            className="ml-1 font-semibold underline hover:no-underline text-text"
          >
            Settings → Prices
          </Link>
        </p>
      )}

      {(initialLoad || refreshing) &&
      ![...quotes.values()].some((q) => q.last > 0) ? (
        <MarketsHoldingsSkeleton rows={5} label="Loading market quotes" className="mb-6" />
      ) : null}

      <div
        className={`markets-master-detail${quoteDetail ? ' markets-master-detail--open' : ''}`}
      >
        <div className="markets-master-detail-list min-w-0">
          {sectionSorting ? (
            <ReorderList
              items={sectionOrder}
              getId={(s) => s}
              onReorder={(next) => {
                reorderMarketSections(next)
                setSectionOrder(next)
              }}
              itemClassName="mb-6"
              className="markets-section-reorder-list"
            >
              {(section) => renderSection(section)}
            </ReorderList>
          ) : (
            sectionOrder.map((section) => renderSection(section))
          )}
        </div>
        {quoteDetail ? (
          <aside
            className="markets-master-detail-panel markets-detail-sticky surface p-4 border border-border hidden md:block sticky self-start"
            aria-label={`Selected ${quoteDetail.ticker.symbol} detail`}
          >
            <p className="label-uppercase mb-1">Selected</p>
            <h2 className="text-xl font-bold tracking-tight mb-1">{quoteDetail.ticker.symbol}</h2>
            <p className="text-sm text-text-muted mb-3">{quoteDetail.ticker.name}</p>
            {quoteDetail.quote && quoteDetail.quote.last > 0 ? (
              <p className={`text-2xl font-bold tabular-nums mb-2 ${privacyClass(privacy)}`}>
                {formatMarketLast(quoteDetail.quote)}
              </p>
            ) : (
              <p className="text-sm text-text-subtle mb-2">No live print</p>
            )}
            {quoteDetail.ticker.kind === 'commodity' &&
            quoteDetail.ticker.quantity != null &&
            quoteDetail.ticker.quantity > 0 &&
            quoteDetail.quote &&
            quoteDetail.quote.last > 0 ? (
              <p className={`text-sm text-text-muted mb-2 tabular-nums ${privacyClass(privacy)}`}>
                Paper {quoteDetail.ticker.quantity} × last ={' '}
                {formatGBP(quoteDetail.ticker.quantity * quoteDetail.quote.last)}
                {quoteDetail.ticker.avgCostGbp != null
                  ? ` · cost ${formatGBP(quoteDetail.ticker.quantity * quoteDetail.ticker.avgCostGbp)}`
                  : ''}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => openEdit(quoteDetail.ticker)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setQuoteDetail(null)}
              >
                Close
              </button>
            </div>
          </aside>
        ) : null}
      </div>

      <Modal open={modalOpen} title={modalTitle} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <Field label="Type">
            <select
              className="w-full"
              value={form.kind}
              disabled={Boolean(editing)}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as MarketAssetKind }))
              }
            >
              <option value="equity">Equity</option>
              <option value="commodity">Commodity (e.g. GC=F gold)</option>
              <option value="crypto">Crypto</option>
              <option value="index">Index (e.g. SPX, NDX, FTSE)</option>
              <option value="fx">FX rate (e.g. GBP/USD)</option>
              <option value="cross">Crypto cross (e.g. ADA/BTC)</option>
            </select>
          </Field>
          <Field
            label={form.kind === 'fx' || form.kind === 'cross' ? 'Pair' : 'Symbol'}
            hint={
              form.kind === 'fx'
                ? 'Format BASE/QUOTE — e.g. GBP/USD, GBP/THB, EUR/USD'
                : form.kind === 'cross'
                  ? 'Format BASE/QUOTE — e.g. ADA/BTC, ETH/BTC'
                  : form.kind === 'index'
                    ? 'e.g. SPX, ^GSPC, NDX, NASDAQ, FTSE'
                    : form.kind === 'commodity'
                      ? 'Yahoo futures/spot — e.g. GC=F (gold), SI=F (silver), HG=F (copper), or GOLD'
                      : 'e.g. TSLA or BTC'
            }
          >
            <input
              className="w-full"
              value={form.symbol}
              onChange={(e) => {
                const v = e.target.value.toUpperCase()
                setForm((f) => ({
                  ...f,
                  symbol:
                    form.kind === 'fx' || form.kind === 'cross'
                      ? v
                      : form.kind === 'index' || form.kind === 'commodity'
                        ? v
                        : v.replace(/\//g, ''),
                }))
              }}
              placeholder={symbolPlaceholder(form.kind)}
              autoCapitalize="characters"
            />
          </Field>
          <Field label="Name">
            <input
              className="w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={namePlaceholder(form.kind)}
            />
          </Field>
          {form.kind === 'crypto' || form.kind === 'cross' ? (
            <Field
              label="CoinGecko id (optional)"
              hint={
                form.kind === 'cross'
                  ? 'For the base coin if it is uncommon (e.g. cardano for ADA/BTC)'
                  : KNOWN_CRYPTO_SYMBOLS.includes(form.symbol.toUpperCase())
                    ? `Known map: ${form.symbol.toUpperCase()}`
                    : 'Leave blank — we search CoinGecko automatically'
              }
            >
              <input
                className="w-full"
                value={form.coingeckoId}
                onChange={(e) => setForm((f) => ({ ...f, coingeckoId: e.target.value }))}
                placeholder={form.kind === 'cross' ? 'cardano' : 'bitcoin'}
              />
            </Field>
          ) : null}
          <Field label="Notes / watch reason (optional)" hint="Shown as a short preview on the row">
            <textarea
              className="w-full min-h-[4.5rem] resize-y"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Why you’re watching this…"
              maxLength={280}
            />
          </Field>
          <Field label="Tag / folder (optional)" hint="Filter chips: Core · Speculative · Income · Other">
            <select
              className="w-full"
              value={form.tag}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tag: e.target.value as MarketTickerTag | '',
                }))
              }
            >
              <option value="">None</option>
              {MARKET_TICKER_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </Field>
          {form.kind === 'equity' ? (
            <Field
              label="Dividend yield % (optional)"
              hint="Auto-filled from Finnhub when blank; you can override"
            >
              <input
                className="w-full"
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                value={form.yieldPct}
                onChange={(e) => setForm((f) => ({ ...f, yieldPct: e.target.value }))}
                placeholder="e.g. 2.4"
              />
            </Field>
          ) : null}
          {form.kind === 'commodity' ? (
            <>
              <Field
                label="Paper quantity (optional)"
                hint="Units × last quote → section value (syncs with watchlist)"
              >
                <input
                  className="w-full"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                    setFormError(null)
                  }}
                  placeholder="e.g. 10"
                  aria-invalid={
                    form.quantity.trim() !== '' &&
                    !(Number(form.quantity) > 0)
                      ? true
                      : undefined
                  }
                />
                {form.quantity.trim() !== '' && !(Number(form.quantity) > 0) ? (
                  <p className="commodity-qty-hint text-xs text-red-500 mt-1" role="status">
                    Quantity must be a positive number.
                  </p>
                ) : null}
              </Field>
              <Field label="Avg cost GBP / unit (optional)" hint="For paper P&L on the detail pane">
                <input
                  className="w-full"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.avgCostGbp}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, avgCostGbp: e.target.value }))
                    setFormError(null)
                  }}
                  placeholder="e.g. 1800"
                  aria-invalid={
                    form.avgCostGbp.trim() !== '' &&
                    !(Number(form.avgCostGbp) >= 0)
                      ? true
                      : undefined
                  }
                />
                {form.avgCostGbp.trim() !== '' && !(Number(form.avgCostGbp) >= 0) ? (
                  <p className="commodity-cost-hint text-xs text-red-500 mt-1" role="status">
                    Avg cost must be zero or a positive number.
                  </p>
                ) : null}
              </Field>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includeInNetWorth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, includeInNetWorth: e.target.checked }))
                  }
                />
                Include paper position in net worth
              </label>
            </>
          ) : null}
          {formError ? (
            <p className="text-sm text-red-500" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(quoteDetail)}
        title={quoteDetail ? `${quoteDetail.ticker.symbol} · 24h` : 'Quote'}
        onClose={() => setQuoteDetail(null)}
      >
        {quoteDetail ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">{quoteDetail.ticker.name}</p>
            <div className={`grid grid-cols-2 gap-3 ${privacyClass(privacy)}`}>
              <div className="surface p-3">
                <p className="label-uppercase mb-1">Last</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatLastDisplay(quoteDetail.quote)}
                </p>
              </div>
              <div className="surface p-3">
                <p className="label-uppercase mb-1">Change</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatPct(quoteDetail.quote?.changePct ?? 0, 2)}
                </p>
              </div>
            </div>
            {quoteDetail.quote && quoteDetail.quote.sparkline.length > 1 ? (
              <div className="surface p-3">
                <p className="label-uppercase mb-2">Sparkline</p>
                <Sparkline
                  data={quoteDetail.quote.sparkline}
                  height={56}
                  showGradient
                  trend={sparklineTrendFromSeries(quoteDetail.quote.sparkline)}
                />
              </div>
            ) : null}
            <p className="text-xs text-text-subtle">
              Source: {quoteDetail.quote?.source ?? '—'}
              {quoteDetail.quote?.updatedAt
                ? ` · Updated ${new Date(quoteDetail.quote.updatedAt).toLocaleString('en-GB')}`
                : ''}
            </p>
            {quoteDetail.ticker.kind === 'commodity' ? (
              <div className="space-y-2">
                {quoteDetail.ticker.quantity != null &&
                quoteDetail.ticker.quantity > 0 &&
                quoteDetail.quote &&
                quoteDetail.quote.last > 0 ? (
                  <p
                    className={`markets-quote-paper-block text-sm tabular-nums text-text-muted ${privacyClass(privacy)}`}
                  >
                    {quoteDetail.ticker.quantity}
                    {' · cost '}
                    {quoteDetail.ticker.avgCostGbp != null
                      ? formatGBP(quoteDetail.ticker.quantity * quoteDetail.ticker.avgCostGbp)
                      : '—'}
                    {' · P&L '}
                    {quoteDetail.ticker.avgCostGbp != null
                      ? formatGBP(
                          quoteDetail.ticker.quantity * quoteDetail.quote.last -
                            quoteDetail.ticker.quantity * quoteDetail.ticker.avgCostGbp,
                          { signed: true },
                        )
                      : '—'}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost btn-sm markets-quote-nw-badge"
                  aria-label={
                    quoteDetail.ticker.includeInNetWorth
                      ? 'Exclude paper position from net worth'
                      : 'Include paper position in net worth'
                  }
                  aria-pressed={Boolean(quoteDetail.ticker.includeInNetWorth)}
                  onClick={() => {
                    const next = !quoteDetail.ticker.includeInNetWorth
                    updateMarketTicker(quoteDetail.ticker.id, { includeInNetWorth: next })
                    reloadList()
                    setQuoteDetail((prev) =>
                      prev
                        ? { ...prev, ticker: { ...prev.ticker, includeInNetWorth: next } }
                        : prev,
                    )
                  }}
                >
                  {quoteDetail.ticker.includeInNetWorth
                    ? 'Exclude from NW'
                    : 'Include in NW'}
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const ownedRoute =
                  quoteDetail.ticker.kind === 'crypto' || quoteDetail.ticker.kind === 'equity'
                    ? ownedHoldingRouteByKey.get(
                        `${quoteDetail.ticker.kind}:${normPortfolioSymbol(quoteDetail.ticker.symbol)}`,
                      )
                    : undefined
                return ownedRoute ? (
                  <Link
                    to={ownedRoute}
                    className="btn-secondary btn-sm markets-quote-open-holding"
                    data-testid="markets-quote-open-holding"
                    aria-label={`Open holding for ${quoteDetail.ticker.symbol}`}
                    onClick={() => setQuoteDetail(null)}
                  >
                    Open holding
                  </Link>
                ) : null
              })()}
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-price-alert"
                data-testid="markets-quote-price-alert"
                aria-label={`Set price alert for ${quoteDetail.ticker.symbol}`}
                onClick={() => openPriceAlertForSymbol(quoteDetail.ticker.symbol)}
              >
                Set price alert
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-copy"
                data-testid="markets-quote-copy"
                aria-label={`Copy symbol ${quoteDetail.ticker.symbol}`}
                onClick={() => {
                  const sym = quoteDetail.ticker.symbol
                  void (async () => {
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(sym)
                        toastSuccess('Copied', `${sym} copied to clipboard`)
                      } else {
                        toastError('Copy failed', 'Clipboard unavailable')
                      }
                    } catch {
                      toastError('Copy failed', 'Could not copy symbol')
                    }
                  })()
                }}
              >
                Copy symbol
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-copy-price"
                data-testid="markets-quote-copy-price"
                aria-label={`Copy price for ${quoteDetail.ticker.symbol}`}
                onClick={() => {
                  const sym = quoteDetail.ticker.symbol
                  const q = quotes.get(quoteDetail.ticker.id)
                  const price =
                    q && q.last > 0
                      ? `${sym} ${q.last.toFixed(q.last >= 100 ? 2 : 4)} ${q.unit || ''}`.trim()
                      : sym
                  void (async () => {
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(price)
                        toastSuccess('Copied', `${price} copied to clipboard`)
                      } else {
                        toastError('Copy failed', 'Clipboard unavailable')
                      }
                    } catch {
                      toastError('Copy failed', 'Could not copy price')
                    }
                  })()
                }}
              >
                Copy price
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-copy-change"
                data-testid="markets-quote-copy-change"
                aria-label={`Copy percent change for ${quoteDetail.ticker.symbol}`}
                onClick={() => {
                  const sym = quoteDetail.ticker.symbol
                  const q = quotes.get(quoteDetail.ticker.id)
                  const pct = formatPct(q?.changePct ?? 0, 2)
                  const text = `${sym} ${pct} (${timeframe})`
                  void (async () => {
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text)
                        toastSuccess('Copied', `${text} copied to clipboard`)
                      } else {
                        toastError('Copy failed', 'Clipboard unavailable')
                      }
                    } catch {
                      toastError('Copy failed', 'Could not copy change')
                    }
                  })()
                }}
              >
                Copy %
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-share"
                data-testid="markets-quote-share"
                aria-label={`Share quote for ${quoteDetail.ticker.symbol}`}
                onClick={() => {
                  const sym = quoteDetail.ticker.symbol
                  const q = quotes.get(quoteDetail.ticker.id)
                  const price =
                    q && q.last > 0
                      ? `${q.last.toFixed(q.last >= 100 ? 2 : 4)} ${q.unit || ''}`.trim()
                      : 'n/a'
                  const text = `${sym} · ${price}`
                  void (async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: `${sym} quote`, text })
                        return
                      }
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text)
                        toastSuccess('Copied', 'Quote copied to clipboard')
                        return
                      }
                      toastError('Share failed', 'Sharing unavailable')
                    } catch (err) {
                      if (err instanceof DOMException && err.name === 'AbortError') return
                      toastError('Share failed', 'Could not share quote')
                    }
                  })()
                }}
              >
                Share
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-open-news"
                data-testid="markets-quote-open-news"
                aria-label={`Open News for ${quoteDetail.ticker.symbol}`}
                onClick={() => {
                  const tag = quoteDetail.ticker.symbol.trim()
                  if (tag) saveNewsFilterTag(tag)
                  setQuoteDetail(null)
                  navigate(tag ? `/news?tag=${encodeURIComponent(tag)}` : '/news')
                }}
              >
                Open News
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-retry"
                data-testid="markets-quote-retry"
                disabled={refreshing}
                aria-label={`Retry quote for ${quoteDetail.ticker.symbol}`}
                onClick={() => void refresh(quoteDetail.ticker.kind)}
              >
                Retry this quote
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm markets-quote-edit"
                data-testid="markets-quote-edit"
                onClick={() => {
                  const t = quoteDetail.ticker
                  setQuoteDetail(null)
                  openEdit(t)
                }}
              >
                Edit ticker
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setQuoteDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(priceAlertEdit)}
        title={
          priceAlertEdit ? `Price alert · ${priceAlertEdit.key}` : 'Set price alert'
        }
        onClose={() => setPriceAlertEdit(null)}
      >
        {priceAlertEdit ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Alert when absolute move reaches this threshold (bell notifications).
            </p>
            <Field label="Threshold % move" hint="e.g. 3 for ±3%">
              <input
                type="number"
                min={0.1}
                step={0.1}
                className="text-sm"
                value={priceAlertEdit.changePct}
                aria-label={`Alert threshold % for ${priceAlertEdit.key}`}
                onChange={(e) =>
                  setPriceAlertEdit((prev) =>
                    prev ? { ...prev, changePct: e.target.value } : prev,
                  )
                }
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setPriceAlertEdit(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                aria-label={`Save price alert for ${priceAlertEdit.key}`}
                onClick={() => {
                  const pct = Number(priceAlertEdit.changePct)
                  if (!Number.isFinite(pct) || pct <= 0) {
                    toastError('Invalid threshold', 'Enter a percentage greater than 0')
                    return
                  }
                  const key = priceAlertEdit.key.trim()
                  const existing = loadPriceAlertThresholds()
                  const idx = existing.findIndex(
                    (th) =>
                      th.key.toUpperCase() === key.toUpperCase() ||
                      th.key.replace('^', '').toUpperCase() ===
                        key.replace('^', '').toUpperCase(),
                  )
                  const next = [...existing]
                  if (idx >= 0) next[idx] = { key: existing[idx]!.key, changePct: pct }
                  else next.push({ key, changePct: pct })
                  savePriceAlertThresholds(next)
                  setPriceAlertEdit(null)
                  toastSuccess('Price alert saved', `${key} ±${pct}%`)
                }}
              >
                Save alert
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(retagTicker)}
        title={retagTicker ? `Retag · ${retagTicker.symbol}` : 'Retag'}
        onClose={() => setRetagTicker(null)}
      >
        {retagTicker ? (
          <div className="markets-retag space-y-3" data-testid="markets-retag">
            <p className="text-sm text-text-muted">
              Apply a watchlist folder tag (Core · Speculative · Income · Other). Tags persist even
              when filter chips are hidden.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Retag ${retagTicker.symbol}`}>
              {MARKET_TICKER_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`btn-secondary btn-sm ${
                    retagTicker.tag === tag ? 'border-accent text-accent' : ''
                  }`}
                  aria-pressed={retagTicker.tag === tag}
                  aria-label={`Tag ${retagTicker.symbol} as ${tag}`}
                  onClick={() => applyTickerTag(retagTicker, tag)}
                >
                  {tag}
                </button>
              ))}
              <button
                type="button"
                className="btn-ghost btn-sm"
                aria-label={`Clear tag on ${retagTicker.symbol}`}
                onClick={() => applyTickerTag(retagTicker, '')}
              >
                Clear tag
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={fxExplainerOpen}
        title="FX & display currency"
        onClose={() => setFxExplainerOpen(false)}
      >
        <div className="space-y-3 text-sm text-text-muted font-light leading-relaxed">
          <p>
            Holdings and equity/crypto market prints use <strong className="text-text font-medium">GBP storage</strong>{' '}
            so sync, tax, and history stay consistent across devices.
          </p>
          <p>
            The toolbar display currency ({getDisplayCurrency()}) converts those GBP amounts for on-screen
            viewing only — it does not change stored cost basis or journal entries.
          </p>
          <p>
            FX pair rows (e.g. GBP/USD) stay in quote units per 1 base. Indices stay in native points.
            Switch display CCY anytime from the header currency control or Settings → Display.
          </p>
          <div className="flex justify-end pt-2">
            <button type="button" className="btn-primary" onClick={() => setFxExplainerOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove from Markets"
        body="Remove this item from Markets? Your holdings and FX settings are unchanged."
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleteId) {
            const removed = tickers.find((t) => t.id === deleteId) ?? null
            removeMarketTicker(deleteId)
            setDeleteId(null)
            reloadList()
            void refresh()
            if (removed) {
              setUndoRemove(removed)
              if (undoTimer.current) window.clearTimeout(undoTimer.current)
              undoTimer.current = window.setTimeout(() => setUndoRemove(null), 8_000)
            }
          }
        }}
        onClose={() => setDeleteId(null)}
      />

      {undoRemove ? (
        <div
          className="markets-undo-banner mb-3 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
          role="status"
        >
          <p className="text-sm text-text-muted">
            Removed <span className="font-semibold text-text">{undoRemove.symbol}</span> from Markets
          </p>
          <button
            type="button"
            className="btn-secondary btn-sm markets-undo-remove"
            data-testid="markets-undo-remove"
            onClick={() => {
              try {
                addMarketTicker({
                  kind: undoRemove.kind,
                  symbol: undoRemove.symbol,
                  name: undoRemove.name,
                  coingeckoId: undoRemove.coingeckoId,
                  notes: undoRemove.notes,
                  tag: undoRemove.tag,
                  yieldPct: undoRemove.yieldPct,
                  quantity: undoRemove.quantity,
                  avgCostGbp: undoRemove.avgCostGbp,
                  includeInNetWorth: undoRemove.includeInNetWorth,
                  yieldManual: undoRemove.yieldManual,
                })
              } catch {
                /* already re-added */
              }
              setUndoRemove(null)
              if (undoTimer.current) window.clearTimeout(undoTimer.current)
              reloadList()
              void refresh()
            }}
          >
            Undo
          </button>
        </div>
      ) : null}

      {undoRetag ? (
        <div
          className="markets-undo-retag-banner mb-3 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border"
          role="status"
        >
          <p className="text-sm text-text-muted">
            Retagged <span className="font-semibold text-text">{undoRetag.ticker.symbol}</span>
          </p>
          <button
            type="button"
            className="btn-secondary btn-sm markets-undo-retag"
            data-testid="markets-undo-retag"
            onClick={() => {
              updateMarketTicker(undoRetag.ticker.id, {
                tag: undoRetag.previousTag || '',
              })
              setUndoRetag(null)
              if (undoRetagTimer.current) window.clearTimeout(undoRetagTimer.current)
              reloadList()
              setQuoteDetail((prev) =>
                prev && prev.ticker.id === undoRetag.ticker.id
                  ? {
                      ...prev,
                      ticker: {
                        ...prev.ticker,
                        tag: undoRetag.previousTag || undefined,
                      },
                    }
                  : prev,
              )
            }}
          >
            Undo
          </button>
        </div>
      ) : null}

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary markets actions">
        <button
          type="button"
          className="btn-primary btn-sm inline-flex items-center gap-1.5"
          onClick={() => openCreate('equity')}
        >
          <Plus size={16} strokeWidth={2} /> Add equity
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          disabled={refreshing || syncingPrices}
          aria-label="Sync prices now — refresh quotes and push to other devices"
          onClick={() => void syncPricesNow()}
        >
          <RefreshCw
            size={16}
            strokeWidth={2}
            className={refreshing || syncingPrices ? 'animate-spin' : undefined}
          />
          {syncingPrices || refreshing ? 'Syncing…' : 'Sync prices'}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          disabled={refreshing}
          aria-label={
            online ? 'Retry unavailable quotes' : 'Retry when online — queue retry for unavailable quotes'
          }
          onClick={() => void retryUnavailable()}
        >
          {online ? 'Retry unavailable' : 'Retry when online'}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          onClick={() => openCreate('crypto')}
        >
          <Plus size={16} strokeWidth={2} /> Add crypto
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5 markets-add-commodity-thumb"
          onClick={() => openCreate('commodity')}
        >
          <Plus size={16} strokeWidth={2} /> Add commodity
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5 markets-add-fx-thumb"
          onClick={() => openCreate('fx')}
        >
          <Plus size={16} strokeWidth={2} /> Add FX
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5 markets-add-index-thumb"
          onClick={() => openCreate('index')}
        >
          <Plus size={16} strokeWidth={2} /> Add index
        </button>
        {(() => {
          const eqMissing = holdingsMissingFromWatchlist(
            data.equities.map((e) => ({ symbol: e.symbol, name: e.name })),
            'equity',
          )
          const cryptoMissing = holdingsMissingFromWatchlist(
            data.crypto.map((c) => ({ symbol: c.symbol, name: c.name })),
            'crypto',
          )
          const total = eqMissing.length + cryptoMissing.length
          if (total === 0) return null
          return (
            <button
              type="button"
              className="btn-secondary btn-sm inline-flex items-center gap-1.5 markets-add-from-holding-thumb"
              data-testid="markets-add-from-holding-thumb"
              onClick={() => {
                if (eqMissing.length > 0) addFromHoldings('equity')
                if (cryptoMissing.length > 0) addFromHoldings('crypto')
              }}
            >
              <Plus size={16} strokeWidth={2} /> Add from holding ({total})
            </button>
          )
        })()}
        <button
          type="button"
          className={`btn-ghost btn-sm markets-density-thumb ${
            density === 'compact' ? 'border-accent text-accent' : ''
          }`}
          aria-pressed={density === 'compact'}
          aria-label={
            density === 'comfortable'
              ? 'Switch to compact density'
              : 'Switch to comfortable density'
          }
          onClick={() => {
            const next: MarketsDensity =
              density === 'comfortable' ? 'compact' : 'comfortable'
            setMarketsDensity(next)
            setDensity(next)
          }}
        >
          {density === 'comfortable' ? 'Compact' : 'Comfortable'}
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm markets-expand-all"
          aria-label="Expand all Markets sections"
          onClick={() => setAllSectionsCollapsed(false)}
        >
          Expand all
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm markets-collapse-all"
          aria-label="Collapse all Markets sections"
          onClick={() => setAllSectionsCollapsed(true)}
        >
          Collapse all
        </button>
        <span
          className="markets-density-trust text-xs text-text-muted tabular-nums self-center"
          data-testid="markets-density-trust"
          role="status"
          aria-label={`${densityTrust.hiddenSparklines} sparklines hidden, ${densityTrust.collapsedCount} sections collapsed`}
        >
          {densityTrust.hiddenSparklines} sparkline
          {densityTrust.hiddenSparklines === 1 ? '' : 's'} hidden ·{' '}
          {densityTrust.collapsedCount} section
          {densityTrust.collapsedCount === 1 ? '' : 's'} collapsed
        </span>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
