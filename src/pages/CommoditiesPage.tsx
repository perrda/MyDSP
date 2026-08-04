import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { PagePrimaryActions } from '../components/ui/PagePrimaryActions'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, Modal, parseNum } from '../components/ui/Modal'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { usePortfolio } from '../context/PortfolioContext'
import { commodityDisplayName, DEFAULT_COMMODITIES } from '../domain/commodities'
import { paperCommodityValue } from '../domain/paperCommodities'
import {
  addMarketTicker,
  listMarketTickers,
  loadMarketQuotesCache,
  updateMarketTicker,
} from '../storage/marketsStore'
import { formatGBP, formatGBPPrecise, privacyClass } from '../utils/format'
import { useToasts } from '../components/ToastProvider'

type EditForm = {
  id: string
  symbol: string
  quantity: string
  avgCostGbp: string
  includeInNetWorth: boolean
}

export function CommoditiesPage() {
  const navigate = useNavigate()
  const { privacy } = usePortfolio()
  const { success, error: showError } = useToasts()
  const [tick, setTick] = useState(0)
  const [edit, setEdit] = useState<EditForm | null>(null)

  const tickers = useMemo(() => {
    void tick
    return listMarketTickers('commodity')
  }, [tick])
  const quotes = useMemo(() => {
    void tick
    return loadMarketQuotesCache()
  }, [tick])
  const paper = useMemo(() => paperCommodityValue(tickers, quotes), [tickers, quotes])

  const seedDefaults = () => {
    let added = 0
    for (const spec of DEFAULT_COMMODITIES) {
      try {
        addMarketTicker({
          kind: 'commodity',
          symbol: spec.symbol,
          name: spec.name,
          quantity: null,
          avgCostGbp: null,
          includeInNetWorth: false,
        })
        added++
      } catch {
        /* already present */
      }
    }
    setTick((n) => n + 1)
    success(
      added ? 'Commodities seeded' : 'Already seeded',
      added
        ? `Added ${added} default commodity ticker${added === 1 ? '' : 's'}.`
        : 'Gold, silver, and copper are already on Markets.',
    )
  }

  const saveEdit = () => {
    if (!edit) return
    try {
      updateMarketTicker(edit.id, {
        quantity: parseNum(edit.quantity) || null,
        avgCostGbp: parseNum(edit.avgCostGbp) || null,
        includeInNetWorth: edit.includeInNetWorth,
      })
      setEdit(null)
      setTick((n) => n + 1)
      success('Commodity updated', edit.symbol)
    } catch (error) {
      showError('Save failed', error instanceof Error ? error.message : 'Could not update.')
    }
  }

  return (
    <div data-testid="commodities-page">
      <PageHeader
        eyebrow="Holdings"
        title="Commodities"
        description="Paper commodity positions (qty · cost · P&L) backed by the Markets watchlist."
        action={
          <PagePrimaryActions
            primaryLabel="Open Markets"
            onPrimary={() => navigate('/markets')}
            menuLabel="Commodity actions"
            items={[
              { id: 'seed', label: 'Seed Gold/Silver/Copper', onClick: seedDefaults },
              {
                id: 'markets',
                label: 'Manage on Markets',
                onClick: () => navigate('/markets'),
              },
            ]}
          />
        }
      />

      <div className="surface p-3 md:p-4 mb-4 rounded-xl md:rounded-none">
        <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold mb-1">
          Paper net worth
        </p>
        <p className={`text-lg font-bold tabular-nums ${privacyClass(privacy)}`}>
          {formatGBP(paper.value)}
          <span className="text-sm font-medium text-text-muted ml-2">
            · cost {formatGBP(paper.cost)} · {paper.count} position
            {paper.count === 1 ? '' : 's'}
          </span>
        </p>
        <p className="text-xs text-text-muted mt-1">
          Quotes and add/remove live on{' '}
          <Link to="/markets" className="text-accent font-semibold hover:underline">
            Markets → Commodities
          </Link>
          . This page focuses on paper qty, cost, and P&L.
        </p>
      </div>

      {tickers.length === 0 ? (
        <EmptyState
          title="No commodity tickers yet"
          description="Seed Gold, Silver, and Copper, or add them from Markets."
          action={{ label: 'Seed defaults', onClick: seedDefaults }}
        />
      ) : (
        <ul className="space-y-2" aria-label="Commodity holdings">
          {tickers.map((ticker) => {
            const quote = quotes.get(ticker.id)
            const qty = ticker.quantity ?? 0
            const avg = ticker.avgCostGbp ?? 0
            const last = quote?.last ?? 0
            const value = qty > 0 && last > 0 ? qty * last : 0
            const cost = qty > 0 && avg >= 0 ? qty * avg : 0
            const pnl = value - cost
            return (
              <li
                key={ticker.id}
                className="holdings-list-row surface px-3 py-3 rounded-xl md:rounded-none"
              >
                <div className="holdings-list-row__identity min-w-0">
                  <p className="holdings-list-row__symbol font-semibold">{ticker.symbol}</p>
                  <p className="text-xs text-text-muted truncate">
                    {ticker.name || commodityDisplayName(ticker.symbol)}
                    {ticker.includeInNetWorth ? ' · in NW' : ''}
                  </p>
                </div>
                <div
                  className={`holdings-list-row__metrics text-sm tabular-nums ${privacyClass(privacy)}`}
                >
                  <p>
                    Qty {qty || '—'} · Cost {avg ? formatGBPPrecise(avg) : '—'}
                  </p>
                  <p>
                    Value {value ? formatGBP(value) : '—'} · P&L{' '}
                    {qty && last ? formatGBP(pnl) : '—'}
                  </p>
                </div>
                <OverflowMenu
                  compact
                  label={`Actions for ${ticker.symbol}`}
                  items={[
                    {
                      id: 'edit',
                      label: 'Edit paper qty',
                      onClick: () =>
                        setEdit({
                          id: ticker.id,
                          symbol: ticker.symbol,
                          quantity: ticker.quantity != null ? String(ticker.quantity) : '',
                          avgCostGbp: ticker.avgCostGbp != null ? String(ticker.avgCostGbp) : '',
                          includeInNetWorth: Boolean(ticker.includeInNetWorth),
                        }),
                    },
                    {
                      id: 'markets',
                      label: 'Open Markets',
                      onClick: () => navigate('/markets'),
                    },
                  ]}
                />
              </li>
            )
          })}
        </ul>
      )}

      {edit ? (
        <Modal open title={`Edit ${edit.symbol}`} onClose={() => setEdit(null)}>
          <Field label="Quantity">
            <input
              type="text"
              inputMode="decimal"
              value={edit.quantity}
              onChange={(e) => setEdit({ ...edit, quantity: e.target.value })}
            />
          </Field>
          <Field label="Avg cost (GBP)">
            <input
              type="text"
              inputMode="decimal"
              value={edit.avgCostGbp}
              onChange={(e) => setEdit({ ...edit, avgCostGbp: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm mt-3 mb-4">
            <input
              type="checkbox"
              checked={edit.includeInNetWorth}
              onChange={(e) => setEdit({ ...edit, includeInNetWorth: e.target.checked })}
            />
            Include in net worth
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveEdit}>
              Save
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
