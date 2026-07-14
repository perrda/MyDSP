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
import {
  formatMarketChangeAbs,
  formatMarketLast,
  type MarketAssetKind,
  type MarketQuote,
  type MarketTicker,
  type MarketsCollapsed,
} from '../domain/markets'
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
  if (q.kind === 'crypto' || q.kind === 'equity') return formatGBPPrecise(q.last)
  return formatMarketLast(q)
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

    if (t.kind === 'fx' || t.kind === 'cross') continue

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
  if (kind === 'fx') return 'GBP/USD'
  return 'ADA/BTC'
}

function namePlaceholder(kind: MarketAssetKind): string {
  if (kind === 'crypto') return 'Bitcoin'
  if (kind === 'equity') return 'Tesla, Inc.'
  if (kind === 'fx') return 'British Pound / US Dollar'
  return 'Cardano / Bitcoin'
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

  const bySection = useMemo(
    () => ({
      crypto: tickers.filter((t) => t.kind === 'crypto'),
      equities: tickers.filter((t) => t.kind === 'equity'),
      fx: tickers.filter((t) => t.kind === 'fx'),
      crosses: tickers.filter((t) => t.kind === 'cross'),
    }),
    [tickers],
  )

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
    const isRateSection = section === 'fx' || section === 'crosses'

    return (
      <section
        key={section}
        className="border border-border bg-bg-elevated mb-6 overflow-hidden"
      >
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border">
          <div className="min-w-0">
            <p className="label-uppercase text-[10px] text-text-subtle mb-1">{meta.title}</p>
            <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${privacyClass(privacy)}`}>
              <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-text">
                {isRateSection
                  ? items.length > 0
                    ? `${items.length} rate${items.length === 1 ? '' : 's'}`
                    : '—'
                  : totals.matched > 0
                    ? formatGBPPrecise(totals.value)
                    : items.length > 0
                      ? `${items.length} ticker${items.length === 1 ? '' : 's'}`
                      : '—'}
              </p>
              <p
                className={`text-sm font-medium tabular-nums ${
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
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm p-2 min-h-10 min-w-10 shrink-0"
            aria-label={isCollapsed ? `Expand ${meta.title}` : `Collapse ${meta.title}`}
            onClick={() => toggleSection(section)}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <ul className="divide-y divide-border">
              {items.length === 0 ? (
                <li className="px-4 sm:px-5 py-8 text-sm text-text-muted text-center">
                  No {meta.emptyLabel} items yet.
                </li>
              ) : (
                items.map((t) => {
                  const q = quotes.get(t.id)
                  const pct = q?.changePct ?? 0
                  const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
                  const showSpark = Boolean(q && q.sparkline.length > 1)
                  return (
                    <li
                      key={t.id}
                      className="px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-text tracking-tight">{t.symbol}</p>
                        <p className="text-xs text-text-muted truncate">{t.name}</p>
                      </div>

                      {showSpark ? (
                        <div className="hidden sm:block w-16 shrink-0">
                          <Sparkline
                            data={q!.sparkline}
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
                          {formatLastDisplay(q)}
                        </p>
                        {q && !(q.last > 0) ? (
                          <p className="text-[10px] text-text-subtle mt-0.5">No live quote</p>
                        ) : null}
                        <div className="mt-1 flex flex-col items-end gap-0.5">
                          <ChangeBadge pct={pct} />
                          {isRateSection && q && q.last > 0 ? (
                            <span className="text-[10px] text-text-subtle tabular-nums">
                              {formatMarketChangeAbs(q)}
                            </span>
                          ) : null}
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
                <span className="text-xs text-text-subtle">Live rates · day change + sparkline</span>
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
          : 'Add equity'

  return (
    <div>
      <PageHeader
        eyebrow="Watchlist"
        title="Markets"
        description="Live equities, crypto, FX (GBP/USD, GBP/THB…), and crypto crosses (ADA/BTC…). Day change, % and sparklines — refresh about every minute."
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

      {renderSection('crypto')}
      {renderSection('equities')}
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
                  symbol: form.kind === 'fx' || form.kind === 'cross' ? v : v.replace(/\//g, ''),
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
                    : 'Required for less common coins (e.g. avalanche-2)'
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
    </div>
  )
}
