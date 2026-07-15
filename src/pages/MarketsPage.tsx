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
  type MarketsCollapsed,
} from '../domain/markets'
import { marketSessionStatus } from '../domain/marketSession'
import { shouldShowCachedMode } from '../domain/marketsCachedMode'
import { mergeMarketQuotes } from '../domain/marketQuotesCache'
import { isOnline } from '../services/offlineQueue'
import { sparklineTrendFromSeries } from '../domain/sparklineSeries'
import { refreshMarketQuotes } from '../services/marketsQuotes'
import { formatMarketsProviderHealthHint } from '../services/marketsProviderHealth'
import { KNOWN_CRYPTO_SYMBOLS } from '../services/prices'
import {
  addMarketTicker,
  listMarketTickers,
  loadMarketQuotesCache,
  loadMarketsState,
  removeMarketTicker,
  reorderMarketTickersInKind,
  saveMarketQuotesCache,
  setMarketsCollapsed,
  setMarketsDensity,
  getMarketsDensity,
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
import type { PortfolioData } from '../domain/types'

type FormState = {
  kind: MarketAssetKind
  symbol: string
  name: string
  coingeckoId: string
  notes: string
  tag: MarketTickerTag | ''
  yieldPct: string
}

const emptyForm: FormState = {
  kind: 'equity',
  symbol: '',
  name: '',
  coingeckoId: '',
  notes: '',
  tag: '',
  yieldPct: '',
}

type SectionKey = keyof MarketsCollapsed

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
  if (kind === 'index') return 'SPX'
  if (kind === 'fx') return 'GBP/USD'
  return 'ADA/BTC'
}

function namePlaceholder(kind: MarketAssetKind): string {
  if (kind === 'crypto') return 'Bitcoin'
  if (kind === 'equity') return 'Tesla, Inc.'
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

function isStaleQuote(q: MarketQuote | undefined): boolean {
  if (!q) return false
  if (
    q.source.startsWith('stale:') ||
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
  if (isStaleQuote(q)) {
    try {
      const t = new Date(q.updatedAt).getTime()
      if (Number.isFinite(t)) {
        const mins = Math.round((Date.now() - t) / 60_000)
        if (mins < 2) return 'Last synced · just now'
        if (mins < 60) return `Last synced · ${mins}m ago`
        const hrs = Math.round(mins / 60)
        if (hrs < 48) return `Last synced · ${hrs}h ago`
      }
    } catch {
      /* ignore */
    }
    return 'Last synced'
  }
  const src = (q.source || '').toLowerCase()
  if (src.includes('yahoo') || src.includes('finnhub') || src.includes('coingecko') || src.includes('frankfurter')) {
    return 'Live'
  }
  if (src.includes('exchangerate')) return 'Live · spot'
  return null
}

export function MarketsPage() {
  const { data, privacy, setData } = usePortfolio()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickers, setTickers] = useState(() => listMarketTickers())
  const [collapsed, setCollapsed] = useState(() => loadMarketsState().collapsed)
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
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => getMarketsDensity())
  const [focusSymbol, setFocusSymbol] = useState<string | null>(null)
  const [quoteDetail, setQuoteDetail] = useState<{ ticker: MarketTicker; quote?: MarketQuote } | null>(
    null,
  )
  const [fxExplainerOpen, setFxExplainerOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<MarketTickerTag | 'All'>('All')
  const [online, setOnline] = useState(() => isOnline())
  const longPressTimer = useRef<number | null>(null)
  const refreshInFlight = useRef(false)
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const cachedMode = useMemo(
    () => shouldShowCachedMode(online, quotes.values()),
    [online, quotes],
  )

  // Deep-link: /markets?symbol=BTC expands section + scrolls to row
  useEffect(() => {
    const raw = searchParams.get('symbol')
    if (!raw) return
    const want = raw.trim().toUpperCase()
    const hit = tickers.find(
      (t) =>
        t.symbol.toUpperCase() === want ||
        t.symbol.replace('^', '').toUpperCase() === want.replace('^', ''),
    )
    setSearchParams({}, { replace: true })
    if (!hit) return
    const section =
      hit.kind === 'crypto'
        ? 'crypto'
        : hit.kind === 'equity'
          ? 'equities'
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

  const bySection = useMemo(
    () => {
      const tagged =
        tagFilter === 'All' ? tickers : tickers.filter((t) => t.tag === tagFilter)
      return {
        crypto: tagged.filter((t) => t.kind === 'crypto'),
        equities: tagged.filter((t) => t.kind === 'equity'),
        indices: tagged.filter((t) => t.kind === 'index'),
        fx: tagged.filter((t) => t.kind === 'fx'),
        crosses: tagged.filter((t) => t.kind === 'cross'),
      }
    },
    [tickers, tagFilter],
  )

  const statusHint = useMemo(() => {
    const health = formatMarketsProviderHealthHint()
    if (refreshing) {
      return `Updating quotes…${error ? ` · ${error}` : ''}`
    }
    if (error) {
      return health ? `${error} · ${health}` : error
    }
    if (sorting) {
      return health
        ? `Drag ⋮⋮ to reorder tickers within each section. · ${health}`
        : 'Drag ⋮⋮ to reorder tickers within each section.'
    }
    return health ?? 'Quotes refreshed'
  }, [refreshing, error, sorting, quotes])

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

  const reloadList = useCallback(() => {
    setTickers(listMarketTickers())
    setCollapsed(loadMarketsState().collapsed)
  }, [])

  const refresh = useCallback(async () => {
    const list = listMarketTickers()
    if (list.length === 0) {
      setQuotes(new Map())
      saveMarketQuotesCache(new Map())
      return
    }
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
      })
      const previous = seedQuotesFromPortfolio(list, data, quotesRef.current)
      const merged = mergeMarketQuotes(previous, next)
      setQuotes(merged)
      saveMarketQuotesCache(merged)
      // Push live Markets prints into holdings so Equities / net worth stay real-time
      setData((prev) => applyLastSyncedQuotesToHoldings(prev, { overwrite: true }).data)
      const at = new Date().toISOString()
      setMarketsLastRefresh(at)
      const liveCount = [...merged.values()].filter((q) => q.last > 0 && !isStaleQuote(q)).length
      const shown = [...merged.values()].filter((q) => q.last > 0).length
      if (shown < list.length) {
        setError(
          `Showing ${shown}/${list.length} prices` +
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
  }, [data])

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
      if (form.kind === 'equity' && form.yieldPct.trim() !== '' && !(yieldNum != null && yieldNum > 0)) {
        setFormError('Yield % must be a positive number.')
        return
      }
      if (editing) {
        updateMarketTicker(editing.id, {
          kind: form.kind,
          symbol: form.symbol,
          name,
          coingeckoId: form.coingeckoId,
          notes: form.notes,
          tag: form.tag,
          yieldPct: form.kind === 'equity' ? yieldNum : null,
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
          : new Map<string, number>()
    const totals = sectionTotals(items, quotes, holdings)
    const isCollapsed = collapsed[section]
    const isRateSection = section === 'fx' || section === 'crosses' || section === 'indices'
    const asOf = sectionAsOfLabel(items, quotes, loadMarketsState().lastRefreshAt)

    return (
      <section
        key={section}
        className="border border-border bg-bg-elevated mb-6 overflow-hidden"
      >
        <div
          className={`markets-section-sticky sticky top-0 z-[5] bg-bg-elevated px-4 sm:px-5 flex items-start justify-between gap-3 border-b border-border ${density === 'compact' ? 'pt-3 pb-2' : 'pt-4 pb-3'}`}
        >
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
                  message={`No ${meta.emptyLabel} yet — add one or seed a preset.`}
                  action={{ label: meta.addLabel, onClick: () => openCreate(meta.kind) }}
                />
                {section === 'crypto' || section === 'equities' || section === 'indices' ? (
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
                  </div>
                ) : null}
              </div>
            ) : (
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
                className="divide-y divide-border"
              >
                {(t) => {
                  const q = quotes.get(t.id)
                  const pct = q?.changePct ?? 0
                  const trend = sparklineTrendFromSeries(q?.sparkline ?? [])
                  const showSpark = Boolean(q && q.sparkline.length > 1)
                  const compact = density === 'compact'
                  const focused = focusSymbol === t.symbol
                  return (
                    <div
                      id={`market-${t.symbol.replace(/[^a-zA-Z0-9]/g, '_')}`}
                      className={`px-4 sm:px-5 flex items-center gap-2 sm:gap-4 ${
                        compact ? 'py-2 min-h-11' : 'py-3.5'
                      } ${focused ? 'ring-2 ring-inset ring-accent bg-accent/5' : ''} ${
                        isStaleQuote(q) ? 'markets-row--stale' : ''
                      }`}
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
                          {(t.kind === 'equity' || t.kind === 'index') &&
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
                          aria-label={`${t.symbol} 24h sparkline detail`}
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
                          const label = freshnessLabel(q)
                          if (!label) {
                            return q && !(q.last > 0) ? (
                              <p className="text-[11px] text-text-subtle mt-0.5">Fetching…</p>
                            ) : null
                          }
                          const stale = isStaleQuote(q)
                          return (
                            <p
                              className={`text-[11px] mt-0.5 ${
                                stale
                                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                  : 'text-emerald-600/80 dark:text-emerald-400/80'
                              }`}
                            >
                              {label}
                            </p>
                          )
                        })()}
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
                          <div className="flex flex-row gap-1">
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
            )}

            <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-border">
              <button
                type="button"
                className="btn-ghost btn-sm text-accent inline-flex items-center gap-1.5"
                onClick={() => openCreate(meta.kind)}
              >
                <Plus size={14} strokeWidth={2} />
                {meta.addLabel}
              </button>
              {meta.detailsHref ? (
                <Link
                  to={meta.detailsHref}
                  className="text-sm text-accent hover:underline inline-flex items-center gap-1"
                >
                  View details →
                </Link>
              ) : (
                <span className="text-xs text-text-subtle">
                  {sorting ? 'Drag ⋮⋮ to reorder · 24h sparkline' : '24h % · 24h sparkline'}
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
        description="Live equities, crypto, indices, FX, and crosses. Auto-refreshes ~45s; header refresh forces an update."
        action={
          <div className="hidden sm:flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn-ghost btn-sm ${density === 'compact' ? 'border-accent text-accent' : ''}`}
              aria-pressed={density === 'compact'}
              onClick={() => {
                const next = density === 'compact' ? 'comfortable' : 'compact'
                setMarketsDensity(next)
                setDensity(next)
              }}
            >
              {density === 'compact' ? 'Comfortable' : 'Compact'}
            </button>
            <button
              type="button"
              className={`btn-secondary inline-flex items-center gap-2 ${sorting ? 'border-accent text-accent' : ''}`}
              aria-pressed={sorting}
              onClick={() => setSorting((v) => !v)}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sorting ? 'Done' : 'Sort'}
            </button>
          </div>
        }
      />

      <p className="text-xs text-text-subtle mb-4">{statusHint}</p>

      {cachedMode ? (
        <div
          className="markets-cached-mode-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Cached mode</p>
          <p className="text-xs mt-0.5 opacity-90">
            {!online
              ? 'You are offline — showing last-good quotes from cache.'
              : 'Live quotes unavailable or stale — showing last-good cached prices.'}
          </p>
        </div>
      ) : null}

      <div
        className="flex flex-wrap gap-2 mb-5"
        role="group"
        aria-label="Filter watchlist by tag"
      >
        {(['All', ...MARKET_TICKER_TAGS] as const).map((tag) => {
          const on = tagFilter === tag
          return (
            <button
              key={tag}
              type="button"
              className={`btn-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={on}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {(initialLoad || refreshing) &&
      ![...quotes.values()].some((q) => q.last > 0) ? (
        <MarketsHoldingsSkeleton rows={5} label="Loading market quotes" className="mb-6" />
      ) : null}

      {renderSection('crypto')}
      {renderSection('equities')}
      {renderSection('indices')}
      {renderSection('fx')}
      {renderSection('crosses')}

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
                      : form.kind === 'index'
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
            <Field label="Dividend yield % (optional)" hint="Manual stub — shown on Markets equity rows">
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
          onClick={() => openCreate('crypto')}
        >
          <Plus size={16} strokeWidth={2} /> Add crypto
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
