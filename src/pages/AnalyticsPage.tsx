import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { AllocationRing } from '../components/charts/AllocationRing'
import { PortfolioSeriesChart } from '../components/charts/PortfolioSeriesChart'
import { 
  MonthlySpendingTrend,
  CategoryBreakdownChart,
  SpendingDistributionPie,
  WeekdaySpendingPattern,
  FinancialHealthRadar,
} from '../components/charts/AdvancedCharts'
import { ExportReportButton } from '../components/ExportReport'
import { AdvancedAnalyticsDashboard } from '../components/AdvancedAnalyticsDashboard'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { performanceSummary } from '../domain/performance'
import { syncNow } from '../services/sync/autoSyncService'
import { formatGBP, formatPct, privacyClass } from '../utils/format'

export function AnalyticsPage() {
  const { data, breakdown, privacy } = usePortfolio()
  const { success } = useToasts()
  const { netWorth, assets, liabilities, crypto, equity, liability } = breakdown

  const debtRatio = assets > 0 ? (liabilities / assets) * 100 : 0

  const monthSpend = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return data.spending
      .filter((s) => s.date.startsWith(ym))
      .reduce((sum, s) => sum + Math.abs(s.amount), 0)
  }, [data.spending])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of data.spending) {
      map.set(s.category, (map.get(s.category) ?? 0) + Math.abs(s.amount))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [data.spending])

  const historyDelta = useMemo(() => {
    if (data.history.length < 2) return null
    const first = data.history[0]
    const last = data.history[data.history.length - 1]
    return last.netWorth - first.netWorth
  }, [data.history])

  const perf = useMemo(
    () => performanceSummary(data.history, data.journal, 'YTD'),
    [data.history, data.journal],
  )

  const allocationSlices = useMemo(
    () =>
      [
        { name: 'Crypto', value: crypto.value },
        { name: 'Equities', value: equity.value },
      ].filter((s) => s.value > 0),
    [crypto.value, equity.value],
  )

  const spendSlices = useMemo(
    () => byCategory.map(([name, value]) => ({ name, value })),
    [byCategory],
  )

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="KPI snapshot from live portfolio and spending data."
        action={
          <ExportReportButton
            data={data}
            breakdown={breakdown}
            options={{
              includeHoldings: true,
              includeSpending: true,
              includeBudgets: true,
              includeGoals: true,
              includeTodos: false,
              includeJobs: false,
            }}
            label="Export Full Report"
          />
        }
      />

      {/* Predictive Analytics Link */}
      <Link
        to="/analytics/predictive"
        className="surface p-6 mb-8 rounded-xl md:rounded-none shadow-sm md:shadow-none flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
            <Brain size={24} className="text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Predictive Analytics</h3>
            <p className="text-sm text-text-muted">
              AI-powered forecasting, anomaly detection, and financial health scoring
            </p>
          </div>
        </div>
        <svg
          className="w-6 h-6 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      <div
        className={`analytics-kpi-row grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}
      >
        <StatCard label="Net worth" value={formatGBP(netWorth)} />
        <StatCard label="Debt ratio" value={`${debtRatio.toFixed(1)}%`} hint="Liabilities / assets" />
        <StatCard
          label="Portfolio P&L"
          value={formatGBP(crypto.pnl + equity.pnl, { signed: true })}
          hint={`Crypto ${formatPct(crypto.pct)} · Equity ${formatPct(equity.pct)}`}
          tone="positive"
        />
        <StatCard label="Spend this month" value={formatGBP(monthSpend)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px mb-8">
        <AllocationRing
          data={allocationSlices}
          privacy={privacy}
          eyebrow="Mix"
          title="Asset allocation"
          donut
        />
        <AllocationRing
          data={spendSlices}
          privacy={privacy}
          eyebrow="Spend"
          title="Top categories"
          donut
          emptyText="No spending data yet."
          linkForSlice={(name) => `/spending?category=${encodeURIComponent(name)}`}
        />
      </div>

      <div className="mb-8">
        <PortfolioSeriesChart
          history={data.history}
          privacy={privacy}
          title="Portfolio over time"
          eyebrow="Performance"
          primary="netWorth"
          allowLayers
          defaultRange="YTD"
        />
      </div>

      {perf && (
        <div className={`surface p-5 sm:p-6 mb-8 ${privacyClass(privacy)}`}>
          <p className="label-uppercase mb-1">Returns (YTD)</p>
          <h3 className="text-base font-bold tracking-tight mb-3">
            Performance vs contributions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1">NW Δ</p>
              <p className="text-lg font-bold tabular-nums">
                {formatGBP(perf.netChange, { signed: true })}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Simple %</p>
              <p className="text-lg font-bold tabular-nums">{formatPct(perf.simplePct)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1">TWR</p>
              <p className="text-lg font-bold tabular-nums text-accent">{formatPct(perf.twrPct)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
                Approx MWR
              </p>
              <p className="text-lg font-bold tabular-nums">{formatPct(perf.approxMwrPct)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
                Net buys
              </p>
              <p className="text-lg font-bold tabular-nums">
                {formatGBP(perf.netContributions, { signed: true })}
              </p>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-3 font-light">
            TWR compounds sub-period returns at journal trade dates ({perf.subPeriods} periods). MWR
            is Modified Dietz.
          </p>
        </div>
      )}

      {/* Advanced Charts Section */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <MonthlySpendingTrend spending={data.spending} privacy={privacy} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryBreakdownChart spending={data.spending} privacy={privacy} />
          <SpendingDistributionPie spending={data.spending} privacy={privacy} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeekdaySpendingPattern spending={data.spending} privacy={privacy} />
          <FinancialHealthRadar 
            data={{
              netWorth,
              assets,
              liabilities,
              monthlyIncome: monthSpend * 1.2, // Estimate
              monthlyExpenses: monthSpend,
              savingsRate: assets > 0 ? Math.max(0, (1 - monthSpend / (assets * 0.05)) * 100) : 0,
            }}
            privacy={privacy}
          />
        </div>
      </div>

      <div className="surface p-5 sm:p-6 mb-8">
        <p className="label-uppercase mb-2">Liabilities</p>
        <p className={`text-xl font-bold tabular-nums ${privacyClass(privacy)}`}>
          {formatGBP(liabilities)}
        </p>
        <p className="text-sm text-text-muted mt-1">
          Monthly service {formatGBP(liability.monthly)}
          {historyDelta !== null && (
            <>
              {' '}
              · History Δ{' '}
              <span className="text-accent font-semibold">
                {formatGBP(historyDelta, { signed: true })}
              </span>
            </>
          )}
        </p>
      </div>

      <AdvancedAnalyticsDashboard />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary analytics actions">
        <ExportReportButton
          data={data}
          breakdown={breakdown}
          options={{
            includeHoldings: true,
            includeSpending: true,
            includeBudgets: true,
            includeGoals: true,
            includeTodos: false,
            includeJobs: false,
          }}
          label="Export report"
        />
        <Link to="/analytics/predictive" className="btn-secondary btn-sm">
          Predictive
        </Link>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            void syncNow().then(() => success('Sync now finished'))
          }}
        >
          Sync now
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
