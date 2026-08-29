import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitCompareArrows, ArrowRight } from 'lucide-react'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { PagePrimaryActions } from '../components/ui/PagePrimaryActions'
import { Modal } from '../components/ui/Modal'
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
import { isSyncedRemoteQuote } from '../domain/marketQuotesSync'
import {
  formatSlaAge,
  hasStaleSyncedQuotes,
  quoteAgeMs,
  QUOTE_FRESHNESS_SLA_MS,
} from '../domain/quoteFreshnessSla'
import { formatGBP, privacyClass } from '../utils/format'
import { AllocationRing, type SliceDatum } from '../components/charts/AllocationRing'
import {
  getActivePortfolioId,
  loadPortfolio,
  savePortfolioImmediate,
  setActivePortfolioId,
} from '../storage/portfolioStore'
import { listMarketTickers, loadMarketQuotesCache } from '../storage/marketsStore'
import { useToasts } from '../components/ToastProvider'
import {
  printHouseholdSnapshot,
  shareHouseholdSnapshot,
} from '../domain/householdSnapshot'
import {
  weekDeltaFromHistory,
  type WeeklyDigestInput,
} from '../domain/weeklyDigest'
import { WeeklyDigestModal } from '../components/WeeklyDigestModal'
import {
  loadCompareSelectedIds,
  saveCompareSelectedIds,
} from '../domain/compareSelectionPrefs'

function quoteAgeLabel(iso?: string): string {
  if (!iso) return 'unknown'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'unknown'
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`
  if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`
  return `${Math.max(1, Math.round(sec / 86400))}d ago`
}

function normCompareSym(s: string): string {
  return s.trim().toUpperCase().replace(/^\^/, '')
}

function portfolioSyncQuoteLabel(portfolioId: string): string | null {
  let data
  try {
    data = loadPortfolio(portfolioId)
  } catch {
    return null
  }
  const quotes = loadMarketQuotesCache()
  const tickers = listMarketTickers()
  let newest = 0
  let found = false
  const check = (symbol: string, price: number) => {
    if (!(price > 0)) return
    const t = tickers.find(
      (tt) =>
        (tt.kind === 'crypto' || tt.kind === 'equity') &&
        normCompareSym(tt.symbol) === normCompareSym(symbol),
    )
    if (!t) return
    const q = quotes.get(t.id)
    if (!q || !(q.last > 0) || !isSyncedRemoteQuote(q)) return
    const tol = 0.0001 * Math.max(price, q.last)
    if (Math.abs(price - q.last) > tol) return
    found = true
    const ts = Date.parse(q.updatedAt) || 0
    if (ts > newest) newest = ts
  }
  for (const c of data.crypto) check(c.symbol, c.price)
  for (const e of data.equities) check(e.symbol, e.livePrice)
  if (!found) return null
  const age = newest > 0 ? quoteAgeLabel(new Date(newest).toISOString()) : null
  return age ? `from other device · ${age}` : 'from other device'
}

export function ComparePage() {
  const { privacy, portfolios, activeId, switchPortfolio, reload } = usePortfolio()
  const { error: showError, showToast } = useToasts()
  const [selected, setSelected] = useState<string[]>(() =>
    loadCompareSelectedIds(portfolios.map((p) => p.id)),
  )
  const [scanToken, setScanToken] = useState(0)
  const [filling, setFilling] = useState(false)
  const [workspaceSetupOpen, setWorkspaceSetupOpen] = useState(false)
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestInput, setDigestInput] = useState<WeeklyDigestInput | null>(null)
  const [relativeTick, setRelativeTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(portfolios.map((p) => p.id))
      const filtered = prev.filter((id) => valid.has(id))
      if (filtered.length > 0) return filtered
      return portfolios.map((p) => p.id)
    })
  }, [portfolios])

  useEffect(() => {
    saveCompareSelectedIds(selected)
  }, [selected])

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

  const portfolioQuoteAges = useMemo(() => {
    void scanToken
    void filling
    const ages = new Map<string, string>()
    for (const p of portfolios) {
      try {
        ages.set(p.id, quoteAgeLabel(loadPortfolio(p.id).settings.lastPriceUpdate))
      } catch {
        ages.set(p.id, 'unknown')
      }
    }
    return ages
  }, [portfolios, scanToken, filling])

  const portfolioSyncAsOf = useMemo(() => {
    void scanToken
    void filling
    const labels = new Map<string, string>()
    for (const p of portfolios) {
      const label = portfolioSyncQuoteLabel(p.id)
      if (label) labels.set(p.id, label)
    }
    return labels
  }, [portfolios, scanToken, filling])

  const compareSyncAsOf = useMemo(() => {
    void scanToken
    void filling
    void relativeTick
    const quotes = loadMarketQuotesCache()
    const tickers = listMarketTickers()
    let newest = 0
    let syncCount = 0
    for (const t of tickers) {
      if (t.kind !== 'crypto' && t.kind !== 'equity') continue
      const q = quotes.get(t.id)
      if (!q || !(q.last > 0) || !isSyncedRemoteQuote(q)) continue
      syncCount += 1
      const ts = Date.parse(q.updatedAt) || 0
      if (ts > newest) newest = ts
    }
    if (syncCount > 0) {
      const age = newest > 0 ? quoteAgeLabel(new Date(newest).toISOString()) : null
      return age ? `Prices from other device · ${age}` : 'Prices from other device'
    }
    const { updatedAt } = lastSyncedHoldingPrices()
    if (!updatedAt) return null
    const age = quoteAgeLabel(updatedAt)
    return age ? `Holdings from last synced · ${age}` : 'Holdings from last synced'
  }, [scanToken, filling, relativeTick])

  const quoteSlaChip = useMemo(() => {
    void scanToken
    void filling
    void relativeTick
    const list = [...loadMarketQuotesCache().values()].filter((q) => q.last > 0)
    if (!hasStaleSyncedQuotes(list)) return null
    let oldest = 0
    for (const q of list) {
      if (!isSyncedRemoteQuote(q)) continue
      const age = quoteAgeMs(q)
      if (age != null && age > oldest) oldest = age
    }
    if (oldest <= QUOTE_FRESHNESS_SLA_MS) return null
    return `Synced quotes past ${formatSlaAge(QUOTE_FRESHNESS_SLA_MS)} SLA · oldest ${formatSlaAge(oldest)}`
  }, [scanToken, filling, relativeTick])

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
    const paper = Math.max(0, totals.assets - totals.crypto - totals.equity)
    const data: SliceDatum[] = []
    if (crypto > 0) data.push({ name: 'Crypto', value: crypto })
    if (equity > 0) data.push({ name: 'Equities', value: equity })
    if (paper > 0) data.push({ name: 'Commodities', value: paper })
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

  const exportHouseholdSnapshot = async () => {
    const generatedAt = new Date()
    const generatedMessage = `Generated ${generatedAt.toLocaleString('en-GB')}`
    const input = {
      title: 'Household snapshot',
      netWorth: totals.netWorth,
      assets: totals.assets,
      liabilities: totals.liabilities,
      crypto: totals.crypto,
      equity: totals.equity,
      portfolios: rows.map((r) => ({ name: r.name, netWorth: r.netWorth })),
      generatedAt,
    }
    try {
      const result = await shareHouseholdSnapshot(input)
      if (result === 'printed') {
        showToast({
          type: 'info',
          title: 'Snapshot ready',
          message: `Print / save as PDF from the dialog. ${generatedMessage}.`,
        })
      } else if (result === 'shared') {
        showToast({ type: 'success', title: 'Snapshot shared', message: generatedMessage })
      }
    } catch {
      printHouseholdSnapshot(input)
      showToast({
        type: 'info',
        title: 'Snapshot ready',
        message: `Print / save as PDF from the dialog. ${generatedMessage}.`,
      })
    }
  }

  const exportWeeklyDigest = () => {
    let weekDelta: number | null = null
    let history: Array<{ date: string; at?: string; netWorth: number }> = []
    try {
      const active = loadPortfolio(activeId)
      history = active.history ?? []
      weekDelta = weekDeltaFromHistory(history, totals.netWorth)
    } catch {
      weekDelta = null
    }
    setDigestInput({
      title: 'MyDSP weekly digest',
      netWorth: totals.netWorth,
      assets: totals.assets,
      liabilities: totals.liabilities,
      crypto: totals.crypto,
      equity: totals.equity,
      weekDelta,
      history,
      privacy,
      portfolios: rows.map((r) => ({ name: r.name, netWorth: r.netWorth })),
      highlights: [
        `${rows.length} portfolio${rows.length === 1 ? '' : 's'} compared`,
        cacheAgeLabel ? `Holdings cache: ${cacheAgeLabel}` : 'Holdings cache age unknown',
      ],
    })
    setDigestOpen(true)
  }

  const exportWeeklyDigestRef = useRef(exportWeeklyDigest)
  exportWeeklyDigestRef.current = exportWeeklyDigest
  useEffect(() => {
    const open = () => exportWeeklyDigestRef.current()
    window.addEventListener('mydsp-open-weekly-digest', open)
    return () => window.removeEventListener('mydsp-open-weekly-digest', open)
  }, [])

  return (
    <div>
      <WeeklyDigestModal
        open={digestOpen}
        input={digestInput}
        onClose={() => setDigestOpen(false)}
        onFlash={(msg) => showToast({ type: 'success', title: msg })}
      />
      <PageHeader
        eyebrow="Family"
        title="Compare portfolios"
        description="Side-by-side net worth and allocation across David and family workspaces. Week Δ uses a local previous-week snapshot."
        action={
          <PagePrimaryActions
            primaryLabel="Add a portfolio"
            onPrimary={() => setWorkspaceSetupOpen(true)}
            menuLabel="Compare actions"
            className="compare-workspace-setup-btn household-snapshot-btn"
            items={[
              {
                id: 'snapshot',
                label: 'Snapshot PDF',
                disabled: rows.length === 0,
                onClick: () => void exportHouseholdSnapshot(),
              },
              {
                id: 'fill',
                label: filling
                  ? 'Filling…'
                  : cacheAgeLabel
                    ? `Fill from last synced (${cacheAgeLabel})`
                    : 'Fill from last synced',
                disabled: filling || selected.length === 0,
                onClick: fillFromLastSynced,
              },
            ]}
          />
        }
      />

      <div className="compare-sticky-toolbar surface p-5 sm:p-6 mb-8">
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

      {compareSyncAsOf ? (
        <p className="compare-sync-asof text-[11px] text-accent font-medium mb-3" role="status">
          {compareSyncAsOf}
        </p>
      ) : null}

      {quoteSlaChip ? (
        <p
          className="compare-quote-sla-chip mb-3 px-3 py-2 text-xs border border-border bg-surface/50 rounded-lg md:rounded-none"
          role="status"
        >
          {quoteSlaChip}
        </p>
      ) : null}

      <p
        className="compare-week-delta-note text-xs text-text-muted font-light mb-3"
        data-testid="compare-week-delta-note"
      >
        Week Δ compares each portfolio to its previous-week snapshot
        {weekSnap?.capturedAt
          ? ` (baseline captured ${new Date(weekSnap.capturedAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })})`
          : ''}
        — not live week-over-week market moves.
      </p>

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
                  <span
                    className="compare-quote-age-chip mt-2 block w-fit border border-border bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-subtle"
                    title="Age of the latest quote applied to this portfolio"
                  >
                    as of {portfolioQuoteAges.get(r.id) ?? 'unknown'}
                  </span>
                  {portfolioSyncAsOf.get(r.id) ? (
                    <span
                      className="compare-sync-asof mt-1 block w-fit border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] font-semibold text-accent"
                      title="Holdings priced from quotes synced from another device"
                    >
                      {portfolioSyncAsOf.get(r.id)}
                    </span>
                  ) : null}
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

      <Modal
        open={workspaceSetupOpen}
        title="Set up a local family workspace"
        onClose={() => setWorkspaceSetupOpen(false)}
      >
        <div className="compare-workspace-setup-sheet space-y-4 text-sm text-text-muted font-light leading-relaxed">
          <p>
            Create another portfolio as a local family workspace — for example a partner or joint
            book. This does not invite anyone or send a link. Each portfolio keeps its own holdings,
            currency, and tax residency.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-text">
            <li>
              Open{' '}
              <Link
                to="/settings#portfolios"
                className="text-accent hover:underline font-medium"
                onClick={() => setWorkspaceSetupOpen(false)}
              >
                Settings → Portfolios
              </Link>
              .
            </li>
            <li>Enter a unique name (e.g. “Partner” or “Joint”) and create the portfolio — it starts empty.</li>
            <li>
              Switch to it, then add holdings via Markets, import a broker CSV, or run the{' '}
              <Link
                to="/setup/opening"
                className="text-accent hover:underline font-medium"
                onClick={() => setWorkspaceSetupOpen(false)}
              >
                opening-balance wizard
              </Link>
              .
            </li>
            <li>Return here and tick both portfolios under Include to compare side-by-side.</li>
          </ol>
          <p className="text-xs text-text-subtle">
            Encrypted cloud sync can keep these workspaces in step across your devices. Configure the
            same Sync Remote URL and passphrase on each device. Names must be unique; you can rename
            or delete portfolios anytime in Settings.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              to="/settings#portfolios"
              className="btn-primary btn-sm"
              onClick={() => setWorkspaceSetupOpen(false)}
            >
              Open Portfolios
            </Link>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setWorkspaceSetupOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
