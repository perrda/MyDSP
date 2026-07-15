import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import type { CryptoHolding } from '../domain/types'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatGBP, formatGBPPrecise, formatPct, formatQty, privacyClass } from '../utils/format'
import { useToasts } from '../components/ToastProvider'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
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
  const { crypto } = breakdown
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CryptoHolding | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [tradeFor, setTradeFor] = useState<CryptoHolding | null>(null)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [sorting, setSorting] = useState(false)

  const holdings = useMemo(() => sortBySortOrder(data.crypto), [data.crypto])
  const showSkeleton = refreshing && holdings.length === 0

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
            <button
              type="button"
              className={`btn-secondary btn-sm inline-flex items-center gap-2 ${sorting ? 'border-accent text-accent' : ''}`}
              aria-pressed={sorting}
              disabled={holdings.length === 0}
              onClick={() => setSorting((v) => !v)}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sorting ? 'Done' : 'Sort'}
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              Add crypto
            </button>
          </div>
        }
      />

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
      ) : (
        <ReorderList
          items={holdings}
          getId={(c) => String(c.id)}
          onReorder={(next) => setData((prev) => ({ ...prev, crypto: applySortOrder(next) }))}
          className="flex flex-col gap-3 md:gap-px"
        >
          {(c) => {
            const value = c.qty * c.price
            const pnl = value - c.cost
            const included = c.includeInPortfolio !== false
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
                }`}
              >
                {sorting ? <ReorderHandle label={`Reorder ${c.symbol}`} /> : null}
                <Link to={`/crypto/${c.id}`} className="min-w-0 flex-1 hover:text-accent transition-colors">
                  <p className="font-semibold text-base">{c.symbol}</p>
                  <p className="text-xs text-text-subtle truncate mt-0.5">{c.name}</p>
                </Link>
                <div className={`text-sm tabular-nums ${privacyClass(privacy)}`}>
                  <p className="font-semibold">{formatGBP(value)}</p>
                  <p className="text-xs text-text-subtle">
                    {formatQty(c.qty)} · {formatGBPPrecise(c.price)}
                  </p>
                  <p className="text-[11px] text-text-subtle tabular-nums mt-0.5">
                    Cost {formatGBP(c.cost)} · P&L {formatGBP(pnl, { signed: true })}
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
        onClose={() => setTradeFor(null)}
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
