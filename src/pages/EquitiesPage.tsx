import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Landmark } from 'lucide-react'
import { AllocationRing } from '../components/charts/AllocationRing'
import { PortfolioSeriesChart } from '../components/charts/PortfolioSeriesChart'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { TradeModal } from '../components/ui/TradeModal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
import { applyTrade } from '../domain/trades'
import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import { equityUnitPriceGbp } from '../domain/migrateEquityGbp'
import type { EquityHolding } from '../domain/types'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import {
  formatGBP,
  formatGBPPrecise,
  formatPct,
  formatQty,
  getDisplayCurrency,
  privacyClass,
} from '../utils/format'
import { convertFromGbp } from '../services/fx'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const emptyForm = { symbol: '', name: '', shares: '', avgCost: '', livePrice: '' }

export function EquitiesPage() {
  const { data, breakdown, privacy, setData, fxRates } = usePortfolio()
  const { equity } = breakdown
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EquityHolding | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [tradeFor, setTradeFor] = useState<EquityHolding | null>(null)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')

  const holdings = useMemo(() => sortBySortOrder(data.equities), [data.equities])
  const displayCcy = getDisplayCurrency()

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

  return (
    <div>
      <PageHeader
        eyebrow="Holdings"
        title="Equity / SIPP"
        description="Drag ⋮⋮ to reorder holdings (saved). Totals respect include/exclude. Use Buy/Sell for dated trades."
        action={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            Add equity
          </button>
        }
      />

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
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          icon={<Landmark size={40} strokeWidth={1.25} />}
          title="No equity holdings yet"
          description="Add stocks or ETFs to track shares, cost basis, and live P&amp;L."
          action={{ label: 'Add equity', onClick: openCreate }}
        />
      ) : (
        <ReorderList
          items={holdings}
          getId={(e) => String(e.id)}
          onReorder={(next) => setData((prev) => ({ ...prev, equities: applySortOrder(next) }))}
          className="flex flex-col gap-3 md:gap-px"
        >
          {(e) => {
            const priceGbp = equityUnitPriceGbp(e)
            const value = e.shares * priceGbp
            const cost = e.shares * e.avgCost
            const pnl = value - cost
            const included = e.includeInPortfolio !== false
            const usdSpot =
              equityNeedsUsdToGbp(e.symbol) && priceGbp > 0
                ? convertFromGbp(priceGbp, 'USD', fxRates)
                : null
            return (
              <div
                className={`surface p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center gap-3 rounded-xl md:rounded-none shadow-sm md:shadow-none ${
                  included ? '' : 'opacity-50'
                }`}
              >
                <ReorderHandle label={`Reorder ${e.symbol}`} />
                <Link to={`/equities/${e.id}`} className="min-w-0 flex-1 hover:text-accent transition-colors">
                  <p className="font-semibold text-base">{e.symbol}</p>
                  <p className="text-xs text-text-muted truncate mt-0.5">{e.name}</p>
                </Link>
                <div className={`text-sm tabular-nums min-w-[8.5rem] ${privacyClass(privacy)}`}>
                  <p className="font-semibold">{formatGBP(value)}</p>
                  <p className="text-xs text-text-muted">
                    {formatQty(e.shares)} × {formatGBPPrecise(priceGbp)}
                  </p>
                  {usdSpot != null && displayCcy === 'GBP' && (
                    <p className="text-[11px] text-text-subtle tabular-nums">
                      US ${usdSpot.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
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
                <div className="flex flex-wrap gap-2 ml-auto md:ml-0">
                  <button
                    type="button"
                    className="btn-primary btn-sm min-h-[44px] md:min-h-[36px]"
                    onClick={() => {
                      setTradeFor(e)
                      setTradeSide('buy')
                    }}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm min-h-[44px] md:min-h-[36px]"
                    onClick={() => {
                      setTradeFor(e)
                      setTradeSide('sell')
                    }}
                  >
                    Sell
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 border min-h-[44px] md:min-h-[36px] ${
                      included ? 'border-accent text-accent' : 'border-border-strong text-text-subtle'
                    }`}
                  >
                    {included ? 'In NW' : 'Off'}
                  </button>
                  <button type="button" className="btn-ghost btn-sm min-h-[44px] md:min-h-[36px]" onClick={() => openEdit(e)}>
                    Edit
                  </button>
                  <button type="button" className="btn-ghost btn-sm min-h-[44px] md:min-h-[36px]" onClick={() => setDeleteId(e.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          }}
        </ReorderList>
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
        onClose={() => setTradeFor(null)}
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
