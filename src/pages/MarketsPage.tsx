import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyStateInline } from '../components/ui/EmptyState'
import { MarketsHoldingsSkeleton } from '../components/ui/MarketsHoldingsSkeleton'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
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
import { mergeMarketQuotes } from '../domain/marketQuotesCache'
import { isOnline } from '../services/offlineQueue'
import { sparklineTrendFromSeries } from '../domain/sparklineSeries'
import { refreshMarketQuotes } from '../services/marketsQuotes'
import {
  formatMarketsProviderHealthHint,
  getMarketsProviderHealth,
} from '../services/marketsProviderHealth'
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
function sectionAsOfLabel(
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
  return `As of ${new Date(freshest).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickers, setTickers] = useState(() => listMarketTickers())
  const [collapsed, setCollapsed] = useState(() => loadMarketsState().collapsed)
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => getMarketSectionOrder())
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(() => {
    const cached = loadMarketQuotesCache()
    return seedQuotesFromPortfolio(listMarketTickers(), data, cached)
  })
  const [refreshing, setRefreshing] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [fxExplainerOpen, setFxExplainerOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<MarketTickerTag | 'All'>(() => getMarketsTagFilter())
  const [searchText, setSearchText] = useState('')
  const [yieldSort, setYieldSort] = useState(() => getMarketsYieldSort())
  const [online, setOnline] = useState(() => isOnline())
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

  const bySection = useMemo(
    () => {
      const tagged =
        tagFilter === 'All' ? tickers : tickers.filter((t) => t.tag === tagFilter)
      const filtered = searchQuery
        ? tagged.filter((t) => matchesMarketsSearch(t, searchQuery))
        : tagged
      const equities = filtered.filter((t) => t.kind === 'equity')
      return {
        crypto: filtered.filter((t) => t.kind === 'crypto'),
        equities: yieldSort ? sortByYieldDesc(equities) : equities,
        commodities: filtered.filter((t) => t.kind === 'commodity'),
        indices: filtered.filter((t) => t.kind === 'index'),
        fx: filtered.filter((t) => t.kind === 'fx'),
        crosses: filtered.filter((t) => t.kind === 'cross'),
      }
    },
    [tickers, tagFilter, searchQuery, yieldSort],
  )

  const filteredTickerCount = useMemo(
    () => Object.values(bySection).reduce((sum, items) => sum + items.length, 0),
    [bySection],
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
    const health = formatMarketsProviderHealthHint()
    if (refreshing) {
      return `Updating quotes…${error ? ` · ${error}` : ''}`
    }
    if (error) {
      return health ? `${error} · ${health}` : error
    }
    if (sectionSorting) {
      return health
        ? `Drag ⋮⋮ on section headers to reorder My Crypto / Equities / … · ${health}`
        : 'Drag ⋮⋮ on section headers to reorder My Crypto / Equities / …'
    }
    if (sorting) {
      return health
        ? `Drag ⋮⋮ to reorder tickers within each section. · ${health}`
        : 'Drag ⋮⋮ to reorder tickers within each section.'
    }
    return health ?? 'Quotes refreshed'
  }, [refreshing, error, sorting, sectionSorting, quotes])

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
        setError(`Sync prices: ${live} live · ${failed} failed`)
      } else if (!cfg.enabled || !cfg.remoteUrl.trim()) {
        setError('Prices refreshed locally — enable Cloud Sync in Settings to push to other devices')
      } else {
        setError(null)
      }
      setJustSyncedPulse(true)
      window.setTimeout(() => setJustSyncedPulse(false), 2800)
    } finally {
      setSyncingPrices(false)
    }
  }, [refresh, syncingPrices])

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

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      const hasUnavailable = tickersRef.current.some(
        (t) =>
          quoteAvailabilityLabel(quotesRef.current.get(t.id), { refreshing: false }) ===
          'Unavailable',
      )
      if (hasUnavailable || pendingRetryOnline.current) {
        pendingRetryOnline.current = false
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
  }, [retryUnavailable])

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
    const asOf = sectionAsOfLabel(items, quotes, loadMarketsState().lastRefreshAt)
    const sectionBusy = sectionRefreshing === section || refreshing

    return (
      <section
        key={section}
        id={`markets-section-${section}`}
        className={`border border-border bg-bg-elevated overflow-hidden ${sectionSorting ? '' : 'mb-6'}`}
      >
        <div
          className={`markets-section-sticky sticky top-0 z-[5] bg-bg-elevated px-4 sm:px-5 flex items-start justify-between gap-3 border-b border-border ${density === 'compact' ? 'pt-3 pb-2' : 'pt-4 pb-3'}`}
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
                      : tagFilter !== 'All'
                        ? `No ${meta.emptyLabel} tagged ${tagFilter}.`
                        : `No ${meta.emptyLabel} yet — add one or seed a preset.`
                  }
                  action={
                    searchQuery || tagFilter !== 'All'
                      ? undefined
                      : { label: meta.addLabel, onClick: () => openCreate(meta.kind) }
                  }
                />
                {!searchQuery &&
                tagFilter === 'All' &&
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
                            <span className="text-[10px] uppercase tracking-wider text-text-subtle">
                              {t.tag}
                            </span>
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
                                    : 'text-emerald-600/80 dark:text-emerald-400/80'
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
                            label={`Actions for ${t.symbol}`}
                            items={[
                              {
                                id: 'edit',
                                label: 'Edit',
                                onClick: () => openEdit(t),
                              },
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
        eyebrow="Watchlist"
        title="Markets"
        description="Live watchlist · auto ~45s · Sync prices now pushes last-good quotes to other devices."
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
              {syncingPrices ? 'Syncing…' : 'Sync prices now'}
            </button>
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

      <p className="text-xs text-text-subtle mb-2">{statusHint}</p>
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
      <div
        className="markets-provider-health mb-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-subtle"
        aria-label="Markets provider health this session"
      >
        {providerHealth.map((row) => {
          const ok = row.consecutiveFailures === 0 && Boolean(row.lastSuccessAt)
          const bad = row.consecutiveFailures >= 2
          return (
            <span
              key={row.id}
              className={
                bad
                  ? 'text-amber-700 dark:text-amber-300 font-medium'
                  : ok
                    ? 'text-emerald-700/90 dark:text-emerald-400/90'
                    : undefined
              }
            >
              {row.id}
              {ok ? ' · OK' : bad ? ` · ${row.consecutiveFailures}× fail` : ''}
            </span>
          )
        })}
      </div>

      <div className="markets-in-list-search sticky top-0 z-[9] -mx-1 mb-3 bg-bg/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="surface border border-border-strong px-3 py-2">
          <label className="sr-only" htmlFor="markets-search-input">
            Search watchlist
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="markets-search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search watchlist by symbol or name"
              aria-label="Search watchlist by symbol or name"
              className="min-w-[14rem] flex-1"
            />
            {searchText ? (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSearchText('')}>
                Clear
              </button>
            ) : null}
          </div>
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Sparkline and percent change timeframe"
          >
            {MARKET_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`btn-sm min-h-9 px-2.5 tabular-nums ${
                  timeframe === tf ? 'btn-secondary border-accent text-accent' : 'btn-ghost'
                }`}
                aria-pressed={timeframe === tf}
                onClick={() => {
                  if (tf === timeframe) return
                  setMarketsTimeframe(tf)
                  setTimeframe(tf)
                }}
              >
                {tf}
              </button>
            ))}
            <span className="text-[11px] text-text-subtle ml-1">
              % and sparkline use the same {timeframe} series
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-text-subtle">
            {searchQuery
              ? `${filteredTickerCount}/${tickers.length} watchlist match${filteredTickerCount === 1 ? '' : 'es'}`
              : `${tickers.length} watchlist item${tickers.length === 1 ? '' : 's'}`}
          </p>
        </div>
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

      <div
        className="flex flex-wrap gap-2 mb-5"
        role="group"
        aria-label="Filter and sort watchlist"
      >
        {(['All', ...MARKET_TICKER_TAGS] as const).map((tag) => {
          const on = tagFilter === tag
          return (
            <button
              key={tag}
              type="button"
              className={`btn-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
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
          className={`btn-sm ${yieldSort ? 'btn-primary' : 'btn-ghost'}`}
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

      <nav
        className="markets-section-jump-chips"
        aria-label="Jump to market section"
      >
        {sectionOrder.map((section) => (
          <a
            key={section}
            href={`#markets-section-${section}`}
            className="markets-section-jump-chip btn-ghost btn-sm"
          >
            {SECTION_JUMP_LABEL[section]}
          </a>
        ))}
      </nav>

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
            className="markets-master-detail-panel surface p-4 border border-border hidden md:block sticky top-20 self-start"
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
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="e.g. 10"
                />
              </Field>
              <Field label="Avg cost GBP / unit (optional)" hint="For paper P&L on the detail pane">
                <input
                  className="w-full"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.avgCostGbp}
                  onChange={(e) => setForm((f) => ({ ...f, avgCostGbp: e.target.value }))}
                  placeholder="e.g. 1800"
                />
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
            removeMarketTicker(deleteId)
            setDeleteId(null)
            reloadList()
            void refresh()
          }
        }}
        onClose={() => setDeleteId(null)}
      />

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
          {syncingPrices ? 'Syncing…' : 'Sync prices'}
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
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
