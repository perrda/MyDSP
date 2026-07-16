import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpDown } from 'lucide-react'
import { AllocationRing } from '../components/charts/AllocationRing'
import { PortfolioSeriesChart } from '../components/charts/PortfolioSeriesChart'
import { EmptyState } from '../components/ui/EmptyState'
import { MarketsHoldingsSkeleton } from '../components/ui/MarketsHoldingsSkeleton'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { TradeModal } from '../components/ui/TradeModal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { SwipeHoldingRow } from '../components/ui/SwipeHoldingRow'
import { usePortfolio } from '../context/PortfolioContext'
import { applyTrade } from '../domain/trades'
import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import { equityUnitPriceGbp } from '../domain/migrateEquityGbp'
import { applyLastSyncedQuotesToHoldings } from '../domain/lastSyncedHoldings'
import { appendHoldingPrices } from '../domain/holdingHistory'
import {
  equityDriftHits,
  isSymbolDrifting,
  loadHoldingsDriftThresholdPct,
} from '../domain/holdingsDrift'
import {
  includedPortfolioHoldingValue,
  loadPortfolioConcentrationThresholdPct,
  portfolioConcentrationHits,
} from '../domain/portfolioConcentration'
import type { EquityHolding } from '../domain/types'
import { addHoldingsMissingFromWatchlist, holdingsMissingFromWatchlist } from '../domain/addHoldingsToWatchlist'
import { listMarketTickers } from '../storage/marketsStore'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { useWindowedList } from '../hooks/useWindowedList'
import {
  formatGBP,
  formatGBPPrecise,
  formatDate,
  formatPct,
  formatQty,
  getDisplayCurrency,
  privacyClass,
} from '../utils/format'
import { convertFromGbp } from '../services/fx'
import { useToasts } from '../components/ToastProvider'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const emptyForm = { symbol: '', name: '', shares: '', avgCost: '', livePrice: '' }

function todayIsoDate(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function isCorporateActionDue(date?: string): boolean {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayIsoDate())
}

function matchesPortfolioSearch(holding: { symbol: string; name: string }, query: string): boolean {
  if (!query) return true
  return `${holding.symbol} ${holding.name}`.toLowerCase().includes(query)
}

function mergeVisibleOrder<T extends { id: number }>(all: T[], visibleNext: T[]): T[] {
  const visibleIds = new Set(visibleNext.map((item) => item.id))
  const reordered = [...visibleNext]
  return all.map((item) => (visibleIds.has(item.id) ? reordered.shift() ?? item : item))
}

function taxDisposalHrefForEquity(
  holding: EquityHolding,
  vals: { date: string; qty: number; price: number; fees: number },
): string {
  const params = new URLSearchParams()
  params.set('assetType', 'equity')
  params.set('symbol', holding.symbol)
  params.set('date', vals.date)
  params.set('qty', String(vals.qty))
  params.set('proceeds', String(Math.max(0, vals.qty * vals.price - vals.fees)))
  params.set('cost', String(Math.max(0, vals.qty * holding.avgCost)))
  return `/tax?${params.toString()}`
}

export function EquitiesPage() {
  const { data, breakdown, privacy, setData, fxRates, refreshing } = usePortfolio()
  const { error: showError, showToast } = useToasts()
  const navigate = useNavigate()
  const { equity } = breakdown
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EquityHolding | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [tradeFor, setTradeFor] = useState<EquityHolding | null>(null)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [sorting, setSorting] = useState(false)
  const [weightSort, setWeightSort] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedHoldingId, setSelectedHoldingId] = useState<number | null>(null)
  const corpActionToastKeyRef = useRef('')

  const holdings = useMemo(() => sortBySortOrder(data.equities), [data.equities])
  const includedPortfolioValue = useMemo(() => includedPortfolioHoldingValue(data), [data])
  const searchQuery = searchText.trim().toLowerCase()
  const filteredHoldings = useMemo(
    () => holdings.filter((holding) => matchesPortfolioSearch(holding, searchQuery)),
    [holdings, searchQuery],
  )
  const weightSortedHoldings = useMemo(
    () =>
      weightSort
        ? [...filteredHoldings].sort((a, b) => {
            const av =
              a.includeInPortfolio !== false && includedPortfolioValue > 0
                ? (a.shares * equityUnitPriceGbp(a)) / includedPortfolioValue
                : -1
            const bv =
              b.includeInPortfolio !== false && includedPortfolioValue > 0
                ? (b.shares * equityUnitPriceGbp(b)) / includedPortfolioValue
                : -1
            if (bv !== av) return bv - av
            return a.symbol.localeCompare(b.symbol)
          })
        : filteredHoldings,
    [filteredHoldings, includedPortfolioValue, weightSort],
  )
  const windowed = useWindowedList(weightSortedHoldings, 40, 30)
  const listHoldings = sorting ? filteredHoldings : windowed.visible
  const selectedHolding = useMemo(
    () =>
      weightSortedHoldings.find((e) => e.id === selectedHoldingId) ??
      weightSortedHoldings[0] ??
      holdings.find((e) => e.id === selectedHoldingId) ??
      holdings[0] ??
      null,
    [weightSortedHoldings, holdings, selectedHoldingId],
  )
  const displayCcy = getDisplayCurrency()
  const showSkeleton = refreshing && holdings.length === 0
  const driftHits = useMemo(() => equityDriftHits(holdings), [holdings, data.settings.lastPriceUpdate])
  const driftThreshold = loadHoldingsDriftThresholdPct()
  const holdingsIncludedSummary = useMemo(() => {
    let includedValue = 0
    let includedCount = 0
    let excludedCount = 0
    for (const e of holdings) {
      if (e.includeInPortfolio === false) {
        excludedCount++
        continue
      }
      includedCount++
      includedValue += e.shares * equityUnitPriceGbp(e)
    }
    return { includedValue, includedCount, excludedCount }
  }, [holdings])
  const concentrationThreshold = loadPortfolioConcentrationThresholdPct()
  const concentrationHits = useMemo(
    () => portfolioConcentrationHits(data, concentrationThreshold),
    [data, concentrationThreshold],
  )
  const dueCorporateActions = useMemo(
    () =>
      holdings.filter(
        (e) => e.corporateActionNote && isCorporateActionDue(e.corporateActionDate),
      ),
    [holdings],
  )
  const yieldBySymbol = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of listMarketTickers('equity')) {
      if (t.yieldPct != null && t.yieldPct > 0) map.set(t.symbol.toUpperCase(), t.yieldPct)
    }
    for (const e of holdings) {
      if (e.yieldPct != null && e.yieldPct > 0) map.set(e.symbol.toUpperCase(), e.yieldPct)
    }
    return map
  }, [holdings])

  const fillFromLastSynced = () => {
    const snapshot = data
    const result = applyLastSyncedQuotesToHoldings(data, { overwrite: true })
    if (result.equities === 0) {
      showError('No cache hits', 'Refresh Markets first, then try again.')
      return
    }
    setData(() => result.data)
    showToast({
      type: 'success',
      title: 'Filled from last synced',
      message: `${result.equities} equity price${result.equities === 1 ? '' : 's'}`,
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => setData(() => snapshot),
      },
    })
  }

  const applyMarketsPriceForEquity = (holding: EquityHolding, marketPrice: number) => {
    if (!(marketPrice > 0)) return
    const snapshot = data
    const now = new Date().toISOString()
    const next = appendHoldingPrices(
      {
        ...data,
        equities: data.equities.map((e) =>
          e.id === holding.id ? { ...e, livePrice: marketPrice } : e,
        ),
        settings: { ...data.settings, lastPriceUpdate: now },
      },
      [{ kind: 'equity', symbol: holding.symbol, price: marketPrice }],
      now,
    )
    setData(() => next)
    showToast({
      type: 'success',
      title: 'Holding price updated',
      message: `${holding.symbol} set from Markets last quote`,
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => setData(() => snapshot),
      },
    })
  }

  useEffect(() => {
    if (dueCorporateActions.length === 0) return
    const key = dueCorporateActions
      .map((e) => `${e.id}:${e.corporateActionDate}`)
      .sort()
      .join('|')
    if (corpActionToastKeyRef.current === key) return
    corpActionToastKeyRef.current = key
    const first = dueCorporateActions[0]!
    showToast({
      type: 'warning',
      title: 'Corporate action due',
      message: `${first.symbol} effective ${formatDate(first.corporateActionDate!)}${
        dueCorporateActions.length > 1 ? ` · +${dueCorporateActions.length - 1} more` : ''
      }`,
      duration: 9000,
    })
  }, [dueCorporateActions, showToast])

  const pieSlices = useMemo(
    () =>
      holdings
        .filter((e) => e.includeInPortfolio !== false && e.shares * equityUnitPriceGbp(e) > 0)
        .map((e) => ({ name: e.symbol, value: e.shares * equityUnitPriceGbp(e) }))
        .sort((a, b) => b.value - a.value),
    [holdings],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (e: EquityHolding) => {
    setEditing(e)
    setForm({
      symbol: e.symbol,
      name: e.name,
      shares: String(e.shares),
      avgCost: String(e.avgCost),
      livePrice: String(e.livePrice),
    })
    setOpen(true)
  }

  const save = () => {
    const holding: EquityHolding = {
      id: editing?.id ?? nextId(data.equities),
      symbol: form.symbol.trim().toUpperCase() || '???',
      name: form.name.trim() || form.symbol.trim().toUpperCase() || 'Unknown',
      shares: parseNum(form.shares),
      avgCost: parseNum(form.avgCost),
      livePrice: parseNum(form.livePrice) || parseNum(form.avgCost),
      includeInPortfolio: editing?.includeInPortfolio ?? true,
      sortOrder: editing?.sortOrder,
      ragStatus: editing?.ragStatus,
      commentaries: editing?.commentaries,
      platform: editing?.platform,
      contactUrl: editing?.contactUrl,
      yieldPct: editing?.yieldPct,
      corporateActionNote: editing?.corporateActionNote,
      corporateActionDate: editing?.corporateActionDate,
    }
    setData((prev) => ({
      ...prev,
      equities: editing
        ? prev.equities.map((e) => (e.id === editing.id ? holding : e))
        : applySortOrder([...prev.equities, holding]),
    }))
    setOpen(false)
  }

  const toggle = (id: number) => {
    setData((prev) => ({
      ...prev,
      equities: prev.equities.map((e) =>
        e.id === id ? { ...e, includeInPortfolio: e.includeInPortfolio === false } : e,
      ),
    }))
  }

  const missingOnMarkets = useMemo(
    () =>
      holdingsMissingFromWatchlist(
        holdings.map((e) => ({ symbol: e.symbol, name: e.name })),
        'equity',
      ),
    [holdings],
  )

  const addMissingToMarkets = () => {
    const result = addHoldingsMissingFromWatchlist(
      holdings.map((e) => ({ symbol: e.symbol, name: e.name })),
      'equity',
    )
    if (result.added.length > 0) {
      showToast({
        type: 'success',
        title: 'Added to Markets',
        message: `${result.added.length} symbol${result.added.length === 1 ? '' : 's'}`,
      })
      window.dispatchEvent(new CustomEvent('mydsp-markets-changed'))
    } else if (result.errors[0]) {
      showError('Could not add', result.errors[0])
    }
  }

  const selectAdjacentHolding = (direction: -1 | 1) => {
    if (filteredHoldings.length === 0) return
    const currentId = selectedHolding?.id ?? filteredHoldings[0]!.id
    const currentIndex = Math.max(0, filteredHoldings.findIndex((e) => e.id === currentId))
    const nextIndex = Math.min(filteredHoldings.length - 1, Math.max(0, currentIndex + direction))
    setSelectedHoldingId(filteredHoldings[nextIndex]!.id)
  }

  const onHoldingsMasterKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 900px)').matches) return
    event.preventDefault()
    selectAdjacentHolding(event.key === 'ArrowDown' ? 1 : -1)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Holdings"
        title="Equity / SIPP"
        description={
          sorting
            ? 'Drag ⋮⋮ to reorder — order is saved with this portfolio.'
            : 'Tap Sort to rearrange. Use Buy/Sell for dated trades.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={holdings.length === 0}
              onClick={fillFromLastSynced}
              title="Apply last-synced Markets quotes to holdings"
            >
              Fill last synced
            </button>
            {missingOnMarkets.length > 0 ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={addMissingToMarkets}
                title="Add portfolio symbols missing from Markets watchlist"
              >
                Add from holding ({missingOnMarkets.length})
              </button>
            ) : null}
            <button
              type="button"
              className={`btn-secondary btn-sm inline-flex items-center gap-2 ${sorting ? 'border-accent text-accent' : ''}`}
              aria-pressed={sorting}
              disabled={holdings.length === 0}
              onClick={() => {
                setWeightSort(false)
                setSorting((v) => !v)
              }}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sorting ? 'Done' : 'Sort'}
            </button>
            <button
              type="button"
              className={`btn-secondary btn-sm ${weightSort ? 'border-accent text-accent' : ''}`}
              aria-pressed={weightSort}
              disabled={holdings.length === 0}
              onClick={() => {
                setSorting(false)
                setWeightSort((v) => !v)
              }}
              title="Sort holdings by portfolio weight percent"
            >
              Weight %
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              Add equity
            </button>
          </div>
        }
      />

      <div className="holdings-in-list-search sticky top-0 z-[9] -mx-1 mb-4 bg-bg/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="surface border border-border-strong px-3 py-2.5">
          <label className="sr-only" htmlFor="equities-search-input">
            Search equity holdings
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="equities-search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search equity holdings by symbol or name"
              aria-label="Search equity holdings by symbol or name"
              className="min-w-[14rem] flex-1"
            />
            {searchText ? (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSearchText('')}>
                Clear
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11px] text-text-subtle">
            {searchQuery
              ? `${filteredHoldings.length}/${holdings.length} equity holding match${filteredHoldings.length === 1 ? '' : 'es'}`
              : `${holdings.length} equity holding${holdings.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div
        className={`holdings-included-value-bar sticky top-[4.5rem] z-[8] -mx-1 mb-4 border border-border bg-bg-elevated/95 px-3 py-2 text-xs text-text-muted shadow-sm backdrop-blur supports-[backdrop-filter]:bg-bg-elevated/85 ${privacyClass(privacy)}`}
        role="status"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-text">
            Included equity value {formatGBP(holdingsIncludedSummary.includedValue)}
          </span>
          <span className="tabular-nums">
            {holdingsIncludedSummary.includedCount} in NW · {holdingsIncludedSummary.excludedCount} excluded
            {weightSort ? ' · sorted by portfolio weight %' : ''}
          </span>
        </div>
      </div>

      {driftHits.length > 0 ? (
        <div
          className="mb-4 px-4 py-3 border border-amber-500/40 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3"
          role="status"
        >
          <span>
            Markets live ≠ holding price by &gt;{driftThreshold}% on{' '}
            {driftHits.map((h) => h.symbol).join(', ')}. Refresh Markets or fill last synced.
          </span>
          <button type="button" className="btn-secondary btn-sm bg-bg-elevated/80" onClick={fillFromLastSynced}>
            Use Markets prices
          </button>
        </div>
      ) : null}

      {concentrationHits.length > 0 ? (
        <div
          className="portfolio-concentration-banner mb-4 px-4 py-3 border border-amber-500/40 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3"
          role="status"
        >
          <span>
            Concentration: {concentrationHits[0]!.symbol} is{' '}
            {concentrationHits[0]!.weightPct.toFixed(1)}% of included portfolio value (threshold{' '}
            {concentrationThreshold}%)
            {concentrationHits.length > 1 ? ` · +${concentrationHits.length - 1} more` : ''}.
          </span>
          <Link
            to={`/${concentrationHits[0]!.kind === 'equity' ? 'equities' : 'crypto'}/${concentrationHits[0]!.id}`}
            className="btn-secondary btn-sm bg-bg-elevated/80"
          >
            Review holding
          </Link>
        </div>
      ) : null}

      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-px mb-6 ${privacyClass(privacy)}`}>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Value</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums">{formatGBP(equity.value)}</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Cost basis</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums">{formatGBP(equity.cost)}</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">P&amp;L</p>
          <p className={`text-xl md:text-2xl font-bold tabular-nums ${equity.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
            {formatGBP(equity.pnl, { signed: true })}{' '}
            <span className="text-base font-semibold">({formatPct(equity.pct)})</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-px mb-6">
        {showSkeleton ? (
          <div className="lg:col-span-3">
            <MarketsHoldingsSkeleton rows={3} label="Loading equity holdings" />
          </div>
        ) : (
          <>
        <div className="surface p-5 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <AllocationRing
            data={pieSlices}
            privacy={privacy}
            eyebrow="Mix"
            title="Holdings"
            donut
          />
        </div>
        <div className="lg:col-span-2 surface p-5 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <PortfolioSeriesChart
            history={data.history}
            privacy={privacy}
            title="Equity value"
            eyebrow="Chart"
            primary="equity"
            defaultRange="12M"
            heightClass="h-56 sm:h-64 lg:h-72"
          />
        </div>
          </>
        )}
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          illustration
          title="No equity holdings yet"
          description="Add stocks or ETFs to track shares, cost basis, and live P&amp;L."
          action={{ label: 'Add equity', onClick: openCreate }}
        />
      ) : filteredHoldings.length === 0 ? (
        <div className="surface p-6 text-center text-sm text-text-muted">
          No equity holdings match "{searchText.trim()}".
        </div>
      ) : (
        <div
          className="holdings-master-detail equities-master-detail"
          tabIndex={0}
          onKeyDown={onHoldingsMasterKeyDown}
          aria-label="Equity holdings master detail. Use up and down arrows to change selected holding on wide screens."
        >
        <ReorderList
          items={listHoldings}
          getId={(e) => String(e.id)}
          onReorder={(next) =>
            setData((prev) => ({
              ...prev,
              equities: applySortOrder(mergeVisibleOrder(holdings, next)),
            }))
          }
          className="flex flex-col gap-3 md:gap-px"
        >
          {(e) => {
            const priceGbp = equityUnitPriceGbp(e)
            const value = e.shares * priceGbp
            const cost = e.shares * e.avgCost
            const pnl = value - cost
            const included = e.includeInPortfolio !== false
            const portfolioWeightPct =
              included && includedPortfolioValue > 0 ? (value / includedPortfolioValue) * 100 : null
            const usdSpot =
              equityNeedsUsdToGbp(e.symbol) && priceGbp > 0
                ? convertFromGbp(priceGbp, 'USD', fxRates)
                : null
            const driftHit = driftHits.find((h) => isSymbolDrifting([h], e.symbol))
            const drifting = Boolean(driftHit)
            const yieldPct = yieldBySymbol.get(e.symbol.toUpperCase())
            const corpActionDue = isCorporateActionDue(e.corporateActionDate)
            return (
              <SwipeHoldingRow
                onBuy={() => {
                  setTradeFor(e)
                  setTradeSide('buy')
                }}
                onToggleNw={() => toggle(e.id)}
                included={included}
              >
              <div
                className={`surface p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center gap-3 rounded-xl md:rounded-none shadow-sm md:shadow-none ${
                  included ? '' : 'opacity-50'
                } ${drifting ? 'ring-1 ring-inset ring-amber-500/50 bg-amber-500/5' : ''} ${
                  selectedHolding?.id === e.id ? 'holdings-master-row-selected' : ''
                }`}
                tabIndex={0}
                aria-selected={selectedHolding?.id === e.id}
                onClick={() => setSelectedHoldingId(e.id)}
              >
                {sorting ? <ReorderHandle label={`Reorder ${e.symbol}`} /> : null}
                <Link to={`/equities/${e.id}`} className="min-w-0 flex-1 hover:text-accent transition-colors">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-semibold text-base">{e.symbol}</p>
                    {e.corporateActionNote ? (
                      <span
                        className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 border border-amber-500/45 text-amber-700 dark:text-amber-300"
                        title={[
                          e.corporateActionNote,
                          e.corporateActionDate ? `Effective ${formatDate(e.corporateActionDate)}` : '',
                        ].filter(Boolean).join(' · ')}
                      >
                        Corp
                      </span>
                    ) : null}
                    {corpActionDue ? (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 border border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        Due
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">{e.name}</p>
                  {drifting ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      Price drift vs Markets
                    </p>
                  ) : null}
                  {yieldPct != null ? (
                    <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                      Yield {yieldPct.toFixed(yieldPct >= 10 ? 1 : 2)}%
                    </p>
                  ) : null}
                  {e.corporateActionDate ? (
                    <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                      Effective {formatDate(e.corporateActionDate)}
                    </p>
                  ) : null}
                </Link>
                {driftHit ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm border-amber-500/40 text-amber-700 dark:text-amber-300 min-h-11 md:min-h-9"
                    onClick={() => applyMarketsPriceForEquity(e, driftHit.marketPrice)}
                  >
                    Use Markets price
                  </button>
                ) : null}
                <div className={`text-sm tabular-nums min-w-[8.5rem] ${privacyClass(privacy)}`}>
                  <p className="font-semibold">{formatGBP(value)}</p>
                  <p className="text-xs text-text-muted">
                    {formatQty(e.shares)} × {formatGBPPrecise(priceGbp)}
                  </p>
                  <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                    Cost {formatGBP(cost)} · P&L {formatGBP(pnl, { signed: true })}
                  </p>
                  <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                    Portfolio weight{' '}
                    {portfolioWeightPct == null ? 'Excluded' : `${portfolioWeightPct.toFixed(1)}%`}
                  </p>
                  {usdSpot != null && displayCcy === 'GBP' && (
                    <p className="text-[11px] text-text-subtle tabular-nums">
                      USD {usdSpot.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <p
                  className={`text-sm tabular-nums w-20 text-right font-semibold ${
                    pnl >= 0 ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  {formatPct(cost > 0 ? (pnl / cost) * 100 : 0)}
                </p>
                <OverflowMenu
                  label={`More actions for ${e.symbol}`}
                  className="ml-auto md:ml-0"
                  leading={
                    <>
                      <button
                        type="button"
                        className="btn-primary btn-sm min-h-11 md:min-h-9"
                        onClick={() => {
                          setTradeFor(e)
                          setTradeSide('buy')
                        }}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm min-h-11 md:min-h-9"
                        onClick={() => {
                          setTradeFor(e)
                          setTradeSide('sell')
                        }}
                      >
                        Sell
                      </button>
                    </>
                  }
                  items={[
                    {
                      id: 'nw',
                      label: included ? 'In net worth' : 'Excluded from NW',
                      active: included,
                      onClick: () => toggle(e.id),
                    },
                    { id: 'edit', label: 'Edit', onClick: () => openEdit(e) },
                    {
                      id: 'delete',
                      label: 'Delete',
                      destructive: true,
                      onClick: () => setDeleteId(e.id),
                    },
                  ]}
                />
              </div>
              </SwipeHoldingRow>
            )
          }}
        </ReorderList>
        {!sorting && windowed.hasMore ? (
          <div
            ref={windowed.sentinelRef}
            className="holdings-window-sentinel py-3 text-center text-xs text-text-subtle"
            role="status"
            aria-live="polite"
          >
            Showing {listHoldings.length} of {filteredHoldings.length} · scroll for more
            <button type="button" className="btn-ghost btn-sm ml-2 min-h-9" onClick={windowed.showAll}>
              Show all
            </button>
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          Showing {listHoldings.length} of {filteredHoldings.length}
        </p>
        {selectedHolding ? (
          <aside
            className="holdings-master-detail-panel surface p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none"
            aria-label={`Selected equity detail for ${selectedHolding.symbol}`}
          >
            {(() => {
              const priceGbp = equityUnitPriceGbp(selectedHolding)
              const value = selectedHolding.shares * priceGbp
              const cost = selectedHolding.shares * selectedHolding.avgCost
              const pnl = value - cost
              const weight =
                selectedHolding.includeInPortfolio !== false && includedPortfolioValue > 0
                  ? (value / includedPortfolioValue) * 100
                  : null
              return (
                <div className={privacyClass(privacy)}>
                  <p className="label-uppercase mb-1">Selected equity</p>
                  <h2 className="text-xl font-bold tracking-tight mb-1">{selectedHolding.symbol}</h2>
                  <p className="text-sm text-text-muted mb-4">{selectedHolding.name}</p>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-text-subtle">Value</dt>
                      <dd className="font-semibold tabular-nums">{formatGBP(value)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-text-subtle">P&L</dt>
                      <dd className={`font-semibold tabular-nums ${pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
                        {formatGBP(pnl, { signed: true })} · {formatPct(cost > 0 ? (pnl / cost) * 100 : 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-text-subtle">Holding</dt>
                      <dd className="tabular-nums">
                        {formatQty(selectedHolding.shares)} × {formatGBPPrecise(priceGbp)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-text-subtle">Portfolio weight</dt>
                      <dd className="tabular-nums">{weight == null ? 'Excluded' : `${weight.toFixed(1)}%`}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to={`/equities/${selectedHolding.id}`} className="btn-primary btn-sm">
                      Open detail
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setTradeFor(selectedHolding)
                        setTradeSide('sell')
                      }}
                    >
                      Sell
                    </button>
                  </div>
                </div>
              )
            })()}
          </aside>
        ) : null}
        </div>
      )}

      <Modal open={open} size="full" title={editing ? 'Edit equity' : 'Add equity'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Symbol">
            <input
              type="text"
              required
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              placeholder="TSLA"
            />
          </Field>
          <Field label="Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tesla Inc"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Shares">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
              />
            </Field>
            <Field label="Avg cost (GBP)">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.avgCost}
                onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
              />
            </Field>
            <Field label="Live price (GBP)">
              <input
                type="text"
                inputMode="decimal"
                value={form.livePrice}
                onChange={(e) => setForm({ ...form, livePrice: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-text-muted -mt-1 mb-1">
            US equities (TSLA, MSTR, …) are quoted in USD and converted to GBP with the daily
            GBP/USD rate when you refresh prices. Enter costs and manual overrides in GBP.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <TradeModal
        open={tradeFor !== null}
        kind="equity"
        symbol={tradeFor?.symbol ?? ''}
        defaultPrice={tradeFor ? equityUnitPriceGbp(tradeFor) : 0}
        defaultSide={tradeSide}
        data={data}
        onClose={(opts) => {
          const holding = tradeFor
          setTradeFor(null)
          if (opts?.saved && holding) navigate(`/equities/${holding.id}`)
        }}
        onSave={(vals) => {
          if (!tradeFor) return
          setData((prev) =>
            applyTrade(prev, {
              kind: 'equity',
              side: vals.side,
              symbol: tradeFor.symbol,
              name: tradeFor.name,
              date: vals.date,
              qty: vals.qty,
              price: vals.price,
              fees: vals.fees,
              notes: vals.notes,
              platform: vals.platform,
              holdingId: tradeFor.id,
            }),
          )
          const taxHref = vals.side === 'sell' ? taxDisposalHrefForEquity(tradeFor, vals) : null
          showToast({
            type: 'success',
            title: 'Trade saved',
            message: tradeFor.symbol,
            duration: taxHref ? 9000 : undefined,
            action: taxHref
              ? {
                  label: 'Tax disposal',
                  onClick: () => navigate(taxHref),
                }
              : undefined,
          })
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete holding"
        body="Remove this equity holding? This cannot be undone."
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            equities: prev.equities.filter((e) => e.id !== deleteId),
          }))
        }}
      />
    </div>
  )
}
