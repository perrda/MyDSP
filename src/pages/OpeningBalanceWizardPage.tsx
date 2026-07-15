import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { BackNav } from '../components/ui/BackNav'
import { usePortfolio } from '../context/PortfolioContext'
import {
  scanAllOpeningBalances,
  type OpeningBalanceItem,
} from '../domain/openingBalanceScan'
import { applyTrade } from '../domain/trades'
import {
  getActivePortfolioId,
  listPortfolios,
  loadPortfolio,
  savePortfolioImmediate,
  setActivePortfolioId,
} from '../storage/portfolioStore'
import { formatGBP } from '../utils/format'

type DraftRow = OpeningBalanceItem & {
  date: string
  price: string
  included: boolean
}

export function OpeningBalanceWizardPage() {
  const { reload, switchPortfolio, activeId } = usePortfolio()
  const [rows, setRows] = useState<DraftRow[]>(() =>
    scanAllOpeningBalances().map((item) => ({
      ...item,
      date: item.draft.date.slice(0, 10),
      price: String(item.draft.price),
      included: true,
    })),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const byPortfolio = useMemo(() => {
    const map = new Map<string, DraftRow[]>()
    for (const r of rows) {
      const list = map.get(r.portfolioId) ?? []
      list.push(r)
      map.set(r.portfolioId, list)
    }
    return [...map.entries()]
  }, [rows])

  const selectedCount = rows.filter((r) => r.included).length

  const refreshScan = () => {
    setRows(
      scanAllOpeningBalances().map((item) => ({
        ...item,
        date: item.draft.date.slice(0, 10),
        price: String(item.draft.price),
        included: true,
      })),
    )
    setMessage('Rescanned all portfolios.')
  }

  const applySelected = () => {
    setBusy(true)
    try {
      const previous = getActivePortfolioId()
      let applied = 0
      const groups = new Map<string, DraftRow[]>()
      for (const r of rows) {
        if (!r.included) continue
        const list = groups.get(r.portfolioId) ?? []
        list.push(r)
        groups.set(r.portfolioId, list)
      }
      for (const [portfolioId, group] of groups) {
        let data = loadPortfolio(portfolioId)
        for (const r of group) {
          const price = Number(r.price)
          if (!(price >= 0) || !r.date) continue
          data = applyTrade(data, {
            ...r.draft,
            date: r.date,
            price,
          })
          applied++
        }
        savePortfolioImmediate(data, portfolioId)
      }
      setActivePortfolioId(previous)
      reload()
      switchPortfolio(activeId)
      setRows((prev) => prev.filter((r) => !r.included))
      setMessage(
        applied
          ? `Applied ${applied} opening balance${applied === 1 ? '' : 's'} across ${groups.size} portfolio${groups.size === 1 ? '' : 's'}.`
          : 'Nothing to apply.',
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to apply')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <BackNav to="/settings#trade-history" label="Back to settings" />
      </div>
      <PageHeader
        eyebrow="Setup"
        title="Opening balance wizard"
        description="Holdings with quantity but no buy/sell journal need a dated opening buy. Apply across every family portfolio in one pass."
        action={
          <button type="button" className="btn-secondary btn-sm" onClick={refreshScan}>
            Rescan
          </button>
        }
      />

      {message && (
        <p
          className="mb-6 text-sm text-accent border border-accent/30 bg-accent/5 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="surface p-8 sm:p-10 text-center">
          <p className="text-lg font-semibold mb-2">All clear</p>
          <p className="text-sm text-text-muted font-light max-w-md mx-auto mb-6">
            No holdings need an opening balance right now. Import dated trades for TSLA, MSTR, and
            BTC from Settings when you&apos;re ready.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/settings#trade-history" className="btn-primary">
              Trade templates
            </Link>
            <Link to="/compare" className="btn-ghost">
              Compare portfolios
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <p className="text-sm text-text-muted font-light" role="status">
              {selectedCount} of {rows.length} selected · {byPortfolio.length} portfolio
              {byPortfolio.length === 1 ? '' : 's'} · {listPortfolios().length} total workspaces
            </p>
            <div className="flex gap-2" role="group" aria-label="Bulk actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setRows((prev) => prev.map((r) => ({ ...r, included: true })))}
                aria-label="Select all opening balances"
              >
                Select all
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setRows((prev) => prev.map((r) => ({ ...r, included: false })))}
                aria-label="Clear all selections"
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || selectedCount === 0}
                onClick={applySelected}
                aria-label={`Apply ${selectedCount} selected opening balance${selectedCount === 1 ? '' : 's'}`}
                aria-busy={busy}
              >
                {busy ? 'Applying…' : `Apply ${selectedCount}`}
              </button>
            </div>
          </div>

          <div className="space-y-6" aria-busy={busy}>
            {byPortfolio.map(([portfolioId, group]) => (
              <section
                key={portfolioId}
                className="surface overflow-hidden"
                aria-labelledby={`portfolio-${portfolioId}`}
              >
                <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`portfolio-${portfolioId}`} className="font-bold tracking-tight">
                    {group[0].portfolioName}
                  </h3>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => switchPortfolio(portfolioId)}
                    aria-label={`Switch to ${group[0].portfolioName} portfolio`}
                  >
                    Switch to this portfolio
                  </button>
                </div>
                <ul className="divide-y divide-border" role="list">
                  {group.map((r) => {
                    const key = `${r.portfolioId}:${r.kind}:${r.symbol}`
                    return (
                      <li
                        key={key}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end gap-4"
                      >
                        <label className="flex items-start gap-3 min-w-[10rem]">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={r.included}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.portfolioId === r.portfolioId &&
                                  x.symbol === r.symbol &&
                                  x.kind === r.kind
                                    ? { ...x, included: e.target.checked }
                                    : x,
                                ),
                              )
                            }
                            aria-label={`Include ${r.symbol} ${r.name} opening balance`}
                          />
                          <span>
                            <span className="font-semibold block">{r.symbol}</span>
                            <span className="text-xs text-text-muted">
                              {r.name} · {r.kind} · qty {r.draft.qty}
                            </span>
                          </span>
                        </label>
                        <label className="flex-1 min-w-[8rem]">
                          <span className="label-uppercase block mb-1.5">Buy date</span>
                          <input
                            type="date"
                            value={r.date}
                            disabled={!r.included}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.portfolioId === r.portfolioId &&
                                  x.symbol === r.symbol &&
                                  x.kind === r.kind
                                    ? { ...x, date: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            aria-label={`Buy date for ${r.symbol}`}
                          />
                        </label>
                        <label className="flex-1 min-w-[8rem]">
                          <span className="label-uppercase block mb-1.5">
                            Unit price (GBP)
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={r.price}
                            disabled={!r.included}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.portfolioId === r.portfolioId &&
                                  x.symbol === r.symbol &&
                                  x.kind === r.kind
                                    ? { ...x, price: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            aria-label={`Unit price in GBP for ${r.symbol}`}
                          />
                        </label>
                        <p
                          className="text-xs text-text-subtle lg:w-36 lg:text-right"
                          aria-label={`Estimated cost ${formatGBP(r.draft.qty * (Number(r.price) || 0))}`}
                        >
                          Est. cost{' '}
                          <span className="tabular-nums text-text-muted" aria-hidden="true">
                            {formatGBP(r.draft.qty * (Number(r.price) || 0))}
                          </span>
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
