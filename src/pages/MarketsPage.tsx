import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
} from 'lucide-react'
import { Sparkline } from '../components/charts/Sparkline'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import type { MarketAssetKind, MarketQuote, MarketTicker } from '../domain/markets'
import { refreshMarketQuotes } from '../services/marketsQuotes'
import { KNOWN_CRYPTO_SYMBOLS } from '../services/prices'
import {
  addMarketTicker,
  listMarketTickers,
  loadMarketsState,
  removeMarketTicker,
  setMarketsCollapsed,
  setMarketsLastRefresh,
  updateMarketTicker,
} from '../storage/marketsStore'
import { formatDateTime, formatGBP, formatGBPPrecise, formatPct, privacyClass } from '../utils/format'

type FormState = {
  kind: MarketAssetKind
  symbol: string
  name: string
  coingeckoId: string
}

const emptyForm: FormState = {
  kind: 'equity',
  symbol: '',
  name: '',
  coingeckoId: '',
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

function sectionTotals(
  tickers: MarketTicker[],
  quotes: Map<string, MarketQuote>,
  holdingsValueBySymbol: Map<string, number>,
) {
  let value = 0
  let prevValue = 0
  let matched = 0
  for (const t of tickers) {
    const q = quotes.get(t.id)
    if (!q || !(q.priceGbp > 0)) continue
    const held = holdingsValueBySymbol.get(t.symbol.toUpperCase())
    if (held != null && held > 0) {
      matched++
      const qtyImplied = held / q.priceGbp
      value += held
      prevValue += held - q.changeAbsGbp * qtyImplied
    } else {
      // No holding — contribute unit price so empty watchlists still show live prints
      value += q.priceGbp
      prevValue += q.priceGbp - q.changeAbsGbp
    }
  }
  const changeAbs = value - prevValue
  const changePct = prevValue > 0 ? (changeAbs / prevValue) * 100 : 0
  return { value, changeAbs, changePct, matched }
}

export function MarketsPage() {
  const { data, privacy } = usePortfolio()
  const [tickers, setTickers] = useState(() => listMarketTickers())
  const [collapsed, setCollapsed] = useState(() => loadMarketsState().collapsed)
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(() => new Map())
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAt, setLastAt] = useState(() => loadMarketsState().lastRefreshAt)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MarketTicker | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [addKind, setAddKind] = useState<MarketAssetKind | null>(null)

  const crypto = useMemo(() => tickers.filter((t) => t.kind === 'crypto'), [tickers])
  const equities = useMemo(() => tickers.filter((t) => t.kind === 'equity'), [tickers])

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
      map.set(sym, (map.get(sym) ?? 0) + e.qty * e.price)
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
      return
    }
    setRefreshing(true)
    setError(null)
    try {
      const finnhubKey =
        data.settings.finnhubKey || localStorage.getItem('finnhub_key') || ''
      const next = await refreshMarketQuotes(list, {
        finnhubKey,
        manualCryptoPrices: data.settings.manualCryptoPrices,
      })
      setQuotes(next)
      const at = new Date().toISOString()
      setMarketsLastRefresh(at)
      setLastAt(at)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Price refresh failed')
    } finally {
      setRefreshing(false)
    }
  }, [data.settings.finnhubKey, data.settings.manualCryptoPrices])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = () => reloadList()
    window.addEventListener('mydsp-markets-changed', onChanged)
    return () => window.removeEventListener('mydsp-markets-changed', onChanged)
  }, [reloadList])

  // Auto-refresh every 60s while page is visible
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 60_000)
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
    })
    setFormError(null)
    setModalOpen(true)
  }

  const save = () => {
    try {
      if (editing) {
        updateMarketTicker(editing.id, {
          kind: form.kind,
          symbol: form.symbol,
          name: form.name,
          coingeckoId: form.coingeckoId,
        })
      } else {
        addMarketTicker({
          kind: form.kind,
          symbol: form.symbol,
          name: form.name,
          coingeckoId: form.coingeckoId || undefined,
        })
      }
      setModalOpen(false)
      reloadList()
      void refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save ticker')
    }
  }

  const toggleSection = (section: 'crypto' | 'equities') => {
    const next = !collapsed[section]
    setMarketsCollapsed(section, next)
    setCollapsed((c) => ({ ...c, [section]: next }))
  }

  const renderSection = (
    section: 'crypto' | 'equities',
    title: string,
    items: MarketTicker[],
    detailsHref: string,
    holdingsValueBySymbol: Map<string, number>,
  ) => {
    const totals = sectionTotals(items, quotes, holdingsValueBySymbol)
    const isCollapsed = collapsed[section]
    const kind: MarketAssetKind = section === 'crypto' ? 'crypto' : 'equity'

    return (
      <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border">
          <div className="min-w-0">
            <p className="label-uppercase text-[10px] text-text-subtle mb-1">{title}</p>
            <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${privacyClass(privacy)}`}>
              <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-text">
                {totals.matched > 0
                  ? formatGBPPrecise(totals.value)
                  : items.length > 0
                    ? `${items.length} ticker${items.length === 1 ? '' : 's'}`
                    : '—'}
              </p>
              <p
                className={`text-sm font-medium tabular-nums ${
                  totals.changeAbs > 0
                    ? 'text-emerald-500'
                    : totals.changeAbs < 0
                      ? 'text-red-500'
                      : 'text-text-muted'
                }`}
              >
                {totals.matched > 0
                  ? `${formatGBP(totals.changeAbs, { signed: true })} (${formatPct(totals.changePct, 2)})`
                  : formatPct(totals.changePct, 2)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="btn-ghost btn-sm p-2 min-h-10 min-w-10"
              aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
              onClick={() => toggleSection(section)}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            <ul className="divide-y divide-border">
              {items.length === 0 ? (
                <li className="px-4 sm:px-5 py-8 text-sm text-text-muted text-center">
                  No {section === 'crypto' ? 'crypto' : 'equity'} tickers yet.
                </li>
              ) : (
                items.map((t) => {
                  const q = quotes.get(t.id)
                  const pct = q?.changePct ?? 0
                  const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
                  return (
                    <li
                      key={t.id}
                      className="px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-text tracking-tight">{t.symbol}</p>
                        <p className="text-xs text-text-muted truncate">{t.name}</p>
                      </div>

                      {kind === 'equity' && q && q.sparkline.length > 1 ? (
                        <div className="hidden sm:block w-16 shrink-0">
                          <Sparkline
                            data={q.sparkline}
                            height={28}
                            showGradient={false}
                            trend={trend}
                          />
                        </div>
                      ) : (
                        <div className="hidden sm:block w-16 shrink-0" />
                      )}

                      <div className={`text-right shrink-0 ${privacyClass(privacy)}`}>
                        <p className="text-sm font-medium tabular-nums text-text">
                          {q && q.priceGbp > 0 ? formatGBPPrecise(q.priceGbp) : '—'}
                        </p>
                        <div className="mt-1 flex flex-col items-end gap-0.5">
                          <ChangeBadge pct={pct} />
                          {q?.extendedHours ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] tabular-nums ${
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

                      <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                        <button
                          type="button"
                          className="btn-ghost btn-sm p-2 min-h-9 min-w-9"
                          aria-label={`Edit ${t.symbol}`}
                          onClick={() => openEdit(t)}
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm p-2 min-h-9 min-w-9 text-red-500"
                          aria-label={`Remove ${t.symbol}`}
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>

            <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-border">
              <button
                type="button"
                className="btn-ghost btn-sm text-accent inline-flex items-center gap-1.5"
                onClick={() => openCreate(kind)}
              >
                <Plus size={14} strokeWidth={2} />
                Add ticker
              </button>
              <Link
                to={detailsHref}
                className="text-sm text-accent hover:underline inline-flex items-center gap-1"
              >
                View details →
              </Link>
            </div>
          </>
        )}
      </section>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Watchlist"
        title="Markets"
        description="Track live equity and crypto prices with daily changes. Quotes refresh automatically about every minute."
        action={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <p className="text-xs text-text-subtle mb-4">
        {lastAt ? `Last update ${formatDateTime(lastAt)}` : 'Prices not loaded yet'}
        {error ? ` · ${error}` : ''}
      </p>

      {renderSection('crypto', 'My Crypto', crypto, '/crypto', cryptoHoldingsValue)}
      {renderSection('equities', 'My Equities', equities, '/equities', equityHoldingsValue)}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit ticker' : addKind === 'crypto' ? 'Add crypto' : 'Add equity'}
        onClose={() => setModalOpen(false)}
      >
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
            </select>
          </Field>
          <Field label="Symbol" hint="e.g. TSLA or BTC">
            <input
              className="w-full"
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
              placeholder={form.kind === 'crypto' ? 'BTC' : 'TSLA'}
              autoCapitalize="characters"
            />
          </Field>
          <Field label="Name">
            <input
              className="w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={form.kind === 'crypto' ? 'Bitcoin' : 'Tesla, Inc.'}
            />
          </Field>
          {form.kind === 'crypto' ? (
            <Field
              label="CoinGecko id (optional)"
              hint={
                KNOWN_CRYPTO_SYMBOLS.includes(form.symbol.toUpperCase())
                  ? `Known map: ${form.symbol.toUpperCase()}`
                  : 'Required for less common coins (e.g. avalanche-2)'
              }
            >
              <input
                className="w-full"
                value={form.coingeckoId}
                onChange={(e) => setForm((f) => ({ ...f, coingeckoId: e.target.value }))}
                placeholder="bitcoin"
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

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove ticker"
        body="Remove this ticker from Markets? Your holdings are unchanged."
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
    </div>
  )
}
