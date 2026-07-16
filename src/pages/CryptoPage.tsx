import { useMemo, useState, type KeyboardEvent } from 'react'
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
import { applyLastSyncedQuotesToHoldings } from '../domain/lastSyncedHoldings'
import { appendHoldingPrices } from '../domain/holdingHistory'
import {
  cryptoDriftHits,
  isSymbolDrifting,
  loadHoldingsDriftThresholdPct,
} from '../domain/holdingsDrift'
import {
  includedPortfolioHoldingValue,
  loadPortfolioConcentrationThresholdPct,
  portfolioConcentrationHits,
} from '../domain/portfolioConcentration'
import type { CryptoHolding } from '../domain/types'
import { addHoldingsMissingFromWatchlist, holdingsMissingFromWatchlist } from '../domain/addHoldingsToWatchlist'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { useWindowedList } from '../hooks/useWindowedList'
import { formatGBP, formatGBPPrecise, formatPct, formatQty, privacyClass } from '../utils/format'
import { useToasts } from '../components/ToastProvider'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
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

function taxDisposalHrefForCrypto(
  holding: CryptoHolding,
  vals: { date: string; qty: number; price: number; fees: number },
): string {
  const params = new URLSearchParams()
  const unitCost = holding.qty > 0 ? holding.cost / holding.qty : 0
  params.set('assetType', 'crypto')
  params.set('symbol', holding.symbol)
  params.set('date', vals.date)
  params.set('qty', String(vals.qty))
  params.set('proceeds', String(Math.max(0, vals.qty * vals.price - vals.fees)))
  params.set('cost', String(Math.max(0, vals.qty * unitCost)))
  return `/tax?${params.toString()}`
}

const emptyForm = {
  symbol: '',
  name: '',
  qty: '',
  price: '',
  cost: '',
}

export function CryptoPage() {
  const { data, breakdown, privacy, setData, refreshing } = usePortfolio()
  const { error: showError, showToast } = useToasts()
  const navigate = useNavigate()
  const { crypto } = breakdown
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CryptoHolding | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [tradeFor, setTradeFor] = useState<CryptoHolding | null>(null)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [sorting, setSorting] = useState(false)
  const [weightSort, setWeightSort] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedHoldingId, setSelectedHoldingId] = useState<number | null>(null)

  const holdings = useMemo(() => sortBySortOrder(data.crypto), [data.crypto])
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
                ? (a.qty * a.price) / includedPortfolioValue
                : -1
            const bv =
              b.includeInPortfolio !== false && includedPortfolioValue > 0
                ? (b.qty * b.price) / includedPortfolioValue
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
      weightSortedHoldings.find((c) => c.id === selectedHoldingId) ??
      weightSortedHoldings[0] ??
      holdings.find((c) => c.id === selectedHoldingId) ??
      holdings[0] ??
      null,
    [weightSortedHoldings, holdings, selectedHoldingId],
  )
  const showSkeleton = refreshing && holdings.length === 0
  const driftHits = useMemo(() => cryptoDriftHits(holdings), [holdings, data.settings.lastPriceUpdate])
  const driftThreshold = loadHoldingsDriftThresholdPct()
  const holdingsIncludedSummary = useMemo(() => {
    let includedValue = 0
    let includedCount = 0
    let excludedCount = 0
    for (const c of holdings) {
      if (c.includeInPortfolio === false) {
        excludedCount++
        continue
      }
      includedCount++
      includedValue += c.qty * c.price
    }
    return { includedValue, includedCount, excludedCount }
  }, [holdings])
  const concentrationThreshold = loadPortfolioConcentrationThresholdPct()
  const concentrationHits = useMemo(
    () => portfolioConcentrationHits(data, concentrationThreshold),
    [data, concentrationThreshold],
  )

  const fillFromLastSynced = () => {
    const snapshot = data
    const result = applyLastSyncedQuotesToHoldings(data, { overwrite: true })
    if (result.crypto === 0) {
      showError('No cache hits', 'Refresh Markets first, then try again.')
      return
    }
    setData(() => result.data)
    showToast({
      type: 'success',
      title: 'Filled from last synced',
      message: `${result.crypto} crypto price${result.crypto === 1 ? '' : 's'}`,
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => setData(() => snapshot),
      },
    })
  }

  const applyMarketsPriceForCrypto = (holding: CryptoHolding, marketPrice: number) => {
    if (!(marketPrice > 0)) return
    const snapshot = data
    const now = new Date().toISOString()
    const next = appendHoldingPrices(
      {
        ...data,
        crypto: data.crypto.map((c) =>
          c.id === holding.id ? { ...c, price: marketPrice } : c,
        ),
        settings: { ...data.settings, lastPriceUpdate: now },
      },
      [{ kind: 'crypto', symbol: holding.symbol, price: marketPrice }],
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

  const pieSlices = useMemo(
    () =>
      holdings
        .filter((c) => c.includeInPortfolio !== false && c.qty * c.price > 0)
        .map((c) => ({ name: c.symbol, value: c.qty * c.price }))
        .sort((a, b) => b.value - a.value),
    [holdings],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (c: CryptoHolding) => {
    setEditing(c)
    setForm({
      symbol: c.symbol,
      name: c.name,
      qty: String(c.qty),
      price: String(c.price),
      cost: String(c.cost),
    })
    setOpen(true)
  }

  const save = () => {
    const holding: CryptoHolding = {
      id: editing?.id ?? nextId(data.crypto),
      symbol: form.symbol.trim().toUpperCase() || '???',
      name: form.name.trim() || form.symbol.trim().toUpperCase() || 'Unknown',
      qty: parseNum(form.qty),
      price: parseNum(form.price),
      cost: parseNum(form.cost),
      includeInPortfolio: editing?.includeInPortfolio ?? true,
      sortOrder: editing?.sortOrder,
      ragStatus: editing?.ragStatus,
      commentaries: editing?.commentaries,
      platform: editing?.platform,
      contactUrl: editing?.contactUrl,
    }
    setData((prev) => ({
      ...prev,
      crypto: editing
        ? prev.crypto.map((c) => (c.id === editing.id ? holding : c))
        : applySortOrder([...prev.crypto, holding]),
    }))
    setOpen(false)
  }

  const toggle = (id: number) => {
    setData((prev) => ({
      ...prev,
      crypto: prev.crypto.map((c) =>
        c.id === id ? { ...c, includeInPortfolio: c.includeInPortfolio === false } : c,
      ),
    }))
  }

  const missingOnMarkets = useMemo(
    () =>
      holdingsMissingFromWatchlist(
        holdings.map((c) => ({ symbol: c.symbol, name: c.name })),
        'crypto',
      ),
    [holdings],
  )

  const addMissingToMarkets = () => {
    const result = addHoldingsMissingFromWatchlist(
      holdings.map((c) => ({ symbol: c.symbol, name: c.name })),
      'crypto',
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
    const currentIndex = Math.max(0, filteredHoldings.findIndex((c) => c.id === currentId))
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
        title="Crypto portfolio"
        description={
          sorting
            ? 'Drag ⋮⋮ to reorder — order is saved with this portfolio.'
            : 'Tap Sort to rearrange. Totals respect include/exclude.'
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
              Add crypto
            </button>
          </div>
        }
      />

      <div className="holdings-in-list-search holdings-sticky-search sticky z-[9] -mx-1 mb-4 bg-bg/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="surface border border-border-strong px-3 py-2.5">
          <label className="sr-only" htmlFor="crypto-search-input">
            Search crypto holdings
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="crypto-search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search crypto holdings by symbol or name"
              aria-label="Search crypto holdings by symbol or name"
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
              ? `${filteredHoldings.length}/${holdings.length} crypto holding match${filteredHoldings.length === 1 ? '' : 'es'}`
              : `${holdings.length} crypto holding${holdings.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div
        className={`holdings-included-value-bar holdings-sticky-totals sticky z-[8] -mx-1 mb-4 border border-border bg-bg-elevated/95 px-3 py-2 text-xs text-text-muted shadow-sm backdrop-blur supports-[backdrop-filter]:bg-bg-elevated/85 ${privacyClass(privacy)}`}
        role="status"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-text">
            Included crypto value {formatGBP(holdingsIncludedSummary.includedValue)}
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
          <p className="text-xl md:text-2xl font-bold tabular-nums">{formatGBP(crypto.value)}</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">Cost basis</p>
          <p className="text-xl md:text-2xl font-bold tabular-nums">{formatGBP(crypto.cost)}</p>
        </div>
        <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-text-subtle mb-2 font-semibold">P&amp;L</p>
          <p className={`text-xl md:text-2xl font-bold tabular-nums ${crypto.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
            {formatGBP(crypto.pnl, { signed: true })}{' '}
            <span className="text-base font-semibold">({formatPct(crypto.pct)})</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-px mb-6">
        {showSkeleton ? (
          <div className="lg:col-span-3">
            <MarketsHoldingsSkeleton rows={3} label="Loading crypto holdings" />
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
            title="Crypto value"
            eyebrow="Chart"
            primary="crypto"
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
          title="No crypto holdings yet"
          description="Add BTC, ETH, or any coin to track quantity, live price, and P&amp;L."
          action={{ label: 'Add crypto', onClick: openCreate }}
        />
      ) : filteredHoldings.length === 0 ? (
        <div className="surface p-6 text-center text-sm text-text-muted">
          No crypto holdings match "{searchText.trim()}".
        </div>
      ) : (
        <div
          className="holdings-master-detail crypto-master-detail"
          tabIndex={0}
          onKeyDown={onHoldingsMasterKeyDown}
          aria-label="Crypto holdings master detail. Use up and down arrows to change selected holding on wide screens."
        >
        <ReorderList
          items={listHoldings}
          getId={(c) => String(c.id)}
          onReorder={(next) =>
            setData((prev) => ({
              ...prev,
              crypto: applySortOrder(mergeVisibleOrder(holdings, next)),
            }))
          }
          className="flex flex-col gap-3 md:gap-px"
        >
          {(c) => {
            const value = c.qty * c.price
            const pnl = value - c.cost
            const included = c.includeInPortfolio !== false
            const portfolioWeightPct =
              included && includedPortfolioValue > 0 ? (value / includedPortfolioValue) * 100 : null
            const driftHit = driftHits.find((h) => isSymbolDrifting([h], c.symbol))
            const drifting = Boolean(driftHit)
            return (
              <SwipeHoldingRow
                onBuy={() => {
                  setTradeFor(c)
                  setTradeSide('buy')
                }}
                onToggleNw={() => toggle(c.id)}
                included={included}
              >
              <div
                className={`surface p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center gap-3 rounded-xl md:rounded-none shadow-sm md:shadow-none ${
                  included ? '' : 'opacity-50'
                } ${drifting ? 'ring-1 ring-inset ring-amber-500/50 bg-amber-500/5' : ''} ${
                  selectedHolding?.id === c.id ? 'holdings-master-row-selected' : ''
                }`}
                tabIndex={0}
                aria-selected={selectedHolding?.id === c.id}
                onClick={() => setSelectedHoldingId(c.id)}
              >
                {sorting ? <ReorderHandle label={`Reorder ${c.symbol}`} /> : null}
                <Link to={`/crypto/${c.id}`} className="min-w-0 flex-1 hover:text-accent transition-colors">
                  <p className="font-semibold text-base">{c.symbol}</p>
                  <p className="text-xs text-text-subtle truncate mt-0.5">{c.name}</p>
                  {drifting ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      Price drift vs Markets
                    </p>
                  ) : null}
                </Link>
                {driftHit ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm border-amber-500/40 text-amber-700 dark:text-amber-300 min-h-11 md:min-h-9"
                    onClick={() => applyMarketsPriceForCrypto(c, driftHit.marketPrice)}
                  >
                    Use Markets price
                  </button>
                ) : null}
                <div className={`text-sm tabular-nums ${privacyClass(privacy)}`}>
                  <p className="font-semibold">{formatGBP(value)}</p>
                  <p className="text-xs text-text-subtle">
                    {formatQty(c.qty)} · {formatGBPPrecise(c.price)}
                  </p>
                  <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                    Cost {formatGBP(c.cost)} · P&L {formatGBP(pnl, { signed: true })}
                  </p>
                  <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                    Portfolio weight{' '}
                    {portfolioWeightPct == null ? 'Excluded' : `${portfolioWeightPct.toFixed(1)}%`}
                  </p>
                </div>
                <p
                  className={`text-sm tabular-nums w-20 text-right font-semibold ${
                    pnl >= 0 ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  {formatPct(c.cost > 0 ? (pnl / c.cost) * 100 : 0)}
                </p>
                <OverflowMenu
                  label={`More actions for ${c.symbol}`}
                  className="ml-auto md:ml-0"
                  leading={
                    <>
                      <button
                        type="button"
                        className="btn-primary btn-sm min-h-11 md:min-h-9"
                        onClick={() => {
                          setTradeFor(c)
                          setTradeSide('buy')
                        }}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm min-h-11 md:min-h-9"
                        onClick={() => {
                          setTradeFor(c)
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
                      onClick: () => toggle(c.id),
                    },
                    { id: 'edit', label: 'Edit', onClick: () => openEdit(c) },
                    {
                      id: 'delete',
                      label: 'Delete',
                      destructive: true,
                      onClick: () => setDeleteId(c.id),
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
            aria-label={`Selected crypto detail for ${selectedHolding.symbol}`}
          >
            {(() => {
              const value = selectedHolding.qty * selectedHolding.price
              const pnl = value - selectedHolding.cost
              const weight =
                selectedHolding.includeInPortfolio !== false && includedPortfolioValue > 0
                  ? (value / includedPortfolioValue) * 100
                  : null
              return (
                <div className={privacyClass(privacy)}>
                  <p className="label-uppercase mb-1">Selected crypto</p>
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
                        {formatGBP(pnl, { signed: true })} · {formatPct(selectedHolding.cost > 0 ? (pnl / selectedHolding.cost) * 100 : 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-text-subtle">Holding</dt>
                      <dd className="tabular-nums">
                        {formatQty(selectedHolding.qty)} × {formatGBPPrecise(selectedHolding.price)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-text-subtle">Portfolio weight</dt>
                      <dd className="tabular-nums">{weight == null ? 'Excluded' : `${weight.toFixed(1)}%`}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to={`/crypto/${selectedHolding.id}`} className="btn-primary btn-sm">
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

      <Modal open={open} size="full" title={editing ? 'Edit crypto' : 'Add crypto'} onClose={() => setOpen(false)}>
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
              placeholder="BTC"
            />
          </Field>
          <Field label="Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bitcoin"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Quantity">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </Field>
            <Field label="Price (GBP)">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Cost basis (GBP)">
              <input
                type="text"
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>
          </div>
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
        kind="crypto"
        symbol={tradeFor?.symbol ?? ''}
        defaultPrice={tradeFor?.price}
        defaultSide={tradeSide}
        data={data}
        onClose={(opts) => {
          const holding = tradeFor
          setTradeFor(null)
          if (opts?.saved && holding) navigate(`/crypto/${holding.id}`)
        }}
        onSave={(vals) => {
          if (!tradeFor) return
          setData((prev) =>
            applyTrade(prev, {
              kind: 'crypto',
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
          const taxHref = vals.side === 'sell' ? taxDisposalHrefForCrypto(tradeFor, vals) : null
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
        body="Remove this crypto holding from the portfolio? This cannot be undone."
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({ ...prev, crypto: prev.crypto.filter((c) => c.id !== deleteId) }))
        }}
      />
    </div>
  )
}
