import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitCompareArrows, ArrowRight } from 'lucide-react'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import {
  buildPortfolioComparison,
  comparisonTotals,
} from '../domain/portfolioCompare'
import {
  syncCompareWeekSnapshots,
  weekOverWeekDelta,
} from '../domain/compareWeekSnapshot'
import { applyLastSyncedQuotesToHoldings, lastSyncedHoldingPrices } from '../domain/lastSyncedHoldings'
import { formatGBP, privacyClass } from '../utils/format'
import { AllocationRing, type SliceDatum } from '../components/charts/AllocationRing'
import {
  getActivePortfolioId,
  loadPortfolio,
  savePortfolioImmediate,
  setActivePortfolioId,
} from '../storage/portfolioStore'
import { useToasts } from '../components/ToastProvider'

export function ComparePage() {
  const { privacy, portfolios, activeId, switchPortfolio, reload } = usePortfolio()
  const { error: showError, showToast } = useToasts()
  const [selected, setSelected] = useState<string[]>(() => portfolios.map((p) => p.id))
  const [scanToken, setScanToken] = useState(0)
  const [filling, setFilling] = useState(false)

  const cacheAgeLabel = useMemo(() => {
    const { updatedAt } = lastSyncedHoldingPrices()
    if (!updatedAt) return null
    const t = new Date(updatedAt).getTime()
    if (!Number.isFinite(t)) return null
    const sec = Math.round((Date.now() - t) / 1000)
    if (sec < 45) return 'cache · just now'
    if (sec < 3600) return `cache · ${Math.max(1, Math.round(sec / 60))}m ago`
    if (sec < 86400) return `cache · ${Math.max(1, Math.round(sec / 3600))}h ago`
    return `cache · ${Math.max(1, Math.round(sec / 86400))}d ago`
  }, [scanToken, filling])

  const rows = useMemo(() => {
    const all = buildPortfolioComparison()
    const set = new Set(selected)
    return all.filter((r) => set.has(r.id))
  }, [selected, scanToken])

  const weekSnap = useMemo(() => {
    const all = buildPortfolioComparison()
    const byId: Record<string, number> = {}
    for (const r of all) byId[r.id] = r.netWorth
    return syncCompareWeekSnapshots(byId)
  }, [scanToken, portfolios])

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

  const fillFromLastSynced = () => {
    setFilling(true)
    try {
      const previous = getActivePortfolioId()
      const snapshots = new Map(selected.map((id) => [id, loadPortfolio(id)]))
      let cryptoN = 0
      let equitiesN = 0
      for (const id of selected) {
        const data = snapshots.get(id)!
        const result = applyLastSyncedQuotesToHoldings(data, { overwrite: true })
        if (result.crypto + result.equities > 0) {
          savePortfolioImmediate(result.data, id)
          cryptoN += result.crypto
          equitiesN += result.equities
        }
      }
      setActivePortfolioId(previous)
      reload()
      switchPortfolio(activeId)
      setScanToken((n) => n + 1)
      if (cryptoN + equitiesN === 0) {
        showError('No cache hits', 'Refresh Markets first, then try again.')
      } else {
        showToast({
          type: 'success',
          title: 'Filled from last synced',
          message: `${cryptoN} crypto · ${equitiesN} equities updated`,
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: () => {
              for (const [id, snap] of snapshots) {
                savePortfolioImmediate(snap, id)
              }
              setActivePortfolioId(previous)
              reload()
              switchPortfolio(activeId)
              setScanToken((n) => n + 1)
            },
          },
        })
      }
    } catch (e) {
      showError('Fill failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setFilling(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Family"
        title="Compare portfolios"
        description="Side-by-side net worth and allocation across David and family workspaces. Week Δ uses a local previous-week snapshot."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={filling || selected.length === 0}
              onClick={fillFromLastSynced}
              title={
                cacheAgeLabel
                  ? `Apply last-synced Markets quotes (${cacheAgeLabel})`
                  : 'Apply last-synced Markets quotes to holdings in selected portfolios'
              }
            >
              {filling
                ? 'Filling…'
                : cacheAgeLabel
                  ? `Fill from last synced (${cacheAgeLabel})`
                  : 'Fill from last synced'}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={refresh}>
              Refresh
            </button>
          </div>
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

      <div className="table-wrap surface overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[40rem]" aria-label="Portfolio comparison">
          <caption className="sr-only">
            Side-by-side net worth, allocation, and flags for the selected portfolios.
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4 label-uppercase font-bold table-sticky-col" scope="col">Portfolio</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Net worth</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col" title="Change vs previous week snapshot">
                Week Δ
              </th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Crypto</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Equities</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">Debt</th>
              <th className="p-4 label-uppercase font-bold text-right" scope="col">P&amp;L</th>
              <th className="p-4 label-uppercase font-bold" scope="col">Flags</th>
            </tr>
          </thead>
          <tbody className={privacyClass(privacy)}>
            {rows.map((r) => {
              const wow = weekOverWeekDelta(r.id, r.netWorth, weekSnap)
              return (
              <tr
                key={r.id}
                className={`border-b border-border/60 ${r.id === activeId ? 'bg-accent/5' : ''}`}
                aria-current={r.id === activeId ? 'true' : undefined}
              >
                <td className="p-4 table-sticky-col">
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
                      aria-hidden
                    />
                  </button>
                  {r.isPrimary && (
                    <span className="ml-2 text-[11px] uppercase tracking-widest text-text-subtle">
                      primary
                    </span>
                  )}
                </td>
                <td className="p-4 text-right tabular-nums font-medium">
                  {formatGBP(r.netWorth)}
                </td>
                <td
                  className={`p-4 text-right tabular-nums ${
                    wow == null
                      ? 'text-text-subtle'
                      : wow >= 0
                        ? 'text-accent'
                        : 'text-text-muted'
                  }`}
                  title={wow == null ? 'No previous-week snapshot yet' : 'vs previous week'}
                >
                  {wow == null ? '—' : formatGBP(wow, { signed: true })}
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
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-muted font-light">
                  Select at least one portfolio above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px mb-8">
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
                  role="img"
                  aria-label={`${r.name} represents ${Math.round(pct)}% of the largest net worth shown`}
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
