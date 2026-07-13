import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitCompareArrows, ArrowRight } from 'lucide-react'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import {
  buildPortfolioComparison,
  comparisonTotals,
} from '../domain/portfolioCompare'
import { formatGBP, privacyClass } from '../utils/format'
import { AllocationRing, type SliceDatum } from '../components/charts/AllocationRing'

export function ComparePage() {
  const { privacy, portfolios, activeId, switchPortfolio, reload } = usePortfolio()
  const [selected, setSelected] = useState<string[]>(() => portfolios.map((p) => p.id))
  const [scanToken, setScanToken] = useState(0)

  const rows = useMemo(() => {
    const all = buildPortfolioComparison()
    const set = new Set(selected)
    return all.filter((r) => set.has(r.id))
  }, [selected, scanToken])

  const totals = useMemo(() => comparisonTotals(rows), [rows])
  const maxNw = Math.max(1, ...rows.map((r) => Math.abs(r.netWorth)))

  const allocationData = useMemo<SliceDatum[]>(() => {
    const crypto = totals.crypto
    const equity = totals.equity
    const data: SliceDatum[] = []
    if (crypto > 0) data.push({ name: 'Crypto', value: crypto })
    if (equity > 0) data.push({ name: 'Equities', value: equity })
    return data
  }, [totals])

  const portfolioAllocation = useMemo<SliceDatum[]>(() => {
    return rows
      .filter((r) => r.netWorth > 0)
      .map((r) => ({ name: r.name, value: r.netWorth }))
  }, [rows])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const refresh = () => {
    reload()
    setScanToken((n) => n + 1)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Family"
        title="Compare portfolios"
        description="Side-by-side net worth and allocation across David and family workspaces."
        action={
          <button type="button" className="btn-secondary btn-sm" onClick={refresh}>
            Refresh
          </button>
        }
      />

      <div className="surface p-5 sm:p-6 mb-8">
        <p className="label-uppercase mb-4">Include</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter portfolios">
          {portfolios.map((p) => {
            const on = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`btn-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                aria-label={`${on ? 'Hide' : 'Show'} ${p.name} portfolio`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}
      >
        <StatCard label="Combined net worth" value={formatGBP(totals.netWorth)} />
        <StatCard label="Combined assets" value={formatGBP(totals.assets)} />
        <StatCard label="Combined liabilities" value={formatGBP(totals.liabilities)} />
        <StatCard
          label="Portfolios shown"
          value={String(rows.length)}
          hint={`${portfolios.length} total`}
        />
      </div>

      <div className="surface overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[40rem]" role="table" aria-label="Portfolio comparison">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4 label-uppercase font-bold" scope="col">Portfolio</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Net worth</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Crypto</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Equities</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Debt</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">P&amp;L</th>
              <th className="p-4 label-uppercase font-bold" scope="col">Flags</th>
            </tr>
          </thead>
          <tbody className={privacyClass(privacy)}>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-border/60 ${r.id === activeId ? 'bg-accent/5' : ''}`}
              >
                <td className="p-4">
                  <button
                    type="button"
                    className="font-semibold text-left hover:text-accent transition-colors inline-flex items-center gap-1.5 group"
                    onClick={() => switchPortfolio(r.id)}
                    aria-label={`Switch to ${r.name} portfolio`}
                    title={`Switch to ${r.name} portfolio`}
                  >
                    {r.name}
                    <ArrowRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      strokeWidth={2}
                    />
                  </button>
                  {r.isPrimary && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-text-subtle">
                      primary
                    </span>
                  )}
                </td>
                <td className="p-4 text-right tabular-nums font-medium">
                  {formatGBP(r.netWorth)}
                </td>
                <td className="p-4 text-right tabular-nums text-text-muted">
                  {formatGBP(r.crypto)}
                </td>
                <td className="p-4 text-right tabular-nums text-text-muted">
                  {formatGBP(r.equity)}
                </td>
                <td className="p-4 text-right tabular-nums text-text-muted">
                  {formatGBP(r.liabilities)}
                </td>
                <td
                  className={`p-4 text-right tabular-nums ${r.pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}
                >
                  {formatGBP(r.pnl, { signed: true })}
                </td>
                <td className="p-4 text-xs text-text-muted">
                  {r.currency} · {r.taxResidency}
                  <span className="block text-text-subtle mt-0.5">
                    {r.journalTrades} trades · {r.historyPoints} hist
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted font-light">
                  Select at least one portfolio above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px mb-8">
        <AllocationRing
          data={allocationData}
          privacy={privacy}
          eyebrow="Family"
          title="Combined asset allocation"
          emptyText="No assets to display"
        />
        <AllocationRing
          data={portfolioAllocation}
          privacy={privacy}
          eyebrow="Family"
          title="Net worth by portfolio"
          emptyText="No portfolios with positive net worth"
          linkForSlice={(name) => {
            const row = rows.find((r) => r.name === name)
            if (row) {
              switchPortfolio(row.id)
              return '/'
            }
            return null
          }}
        />
      </div>

      <div className="surface p-5 sm:p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <GitCompareArrows className="size-4 text-accent" aria-hidden />
          <h3 className="label-uppercase">Net worth scale</h3>
        </div>
        <ul className={`space-y-4 ${privacyClass(privacy)}`} role="list" aria-label="Net worth visualization by portfolio">
          {rows.map((r) => {
            const pct = Math.min(100, (Math.abs(r.netWorth) / maxNw) * 100)
            return (
              <li key={r.id}>
                <div className="flex justify-between gap-3 text-sm mb-1.5">
                  <span className="font-medium truncate">{r.name}</span>
                  <span className="tabular-nums text-text-muted shrink-0">
                    {formatGBP(r.netWorth)}
                  </span>
                </div>
                <div
                  className="h-2 bg-border/40 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${r.name} represents ${Math.round(pct)}% of maximum net worth`}
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-sm text-text-muted font-light">
        Need opening balances or trade history?{' '}
        <Link to="/setup/opening" className="text-accent hover:underline">
          Opening-balance wizard
        </Link>
        {' · '}
        <Link to="/settings#trade-history" className="text-accent hover:underline">
          Trade CSV templates
        </Link>
      </p>
    </div>
  )
}
