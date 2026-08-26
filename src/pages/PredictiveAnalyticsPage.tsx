import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Award } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { BackNav } from '../components/ui/BackNav'
import { ConfirmDialog } from '../components/ui/Modal'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import {
  analyzeSpendingTrends,
  forecastNetWorth,
  detectAnomalies,
  calculateFinancialHealth,
  calculateSavingsRateTrend,
  estimateFireYears,
  projectScenario,
  type SpendingTrend,
} from '../domain/advancedAnalytics'
import { isBudgetSpend } from '../domain/budgetChart'
import { calcCash } from '../domain/calc'
import { compareDebtStrategies } from '../domain/debtStrategies'
import { formatGBP, privacyClass } from '../utils/format'
import { formatChartYTick, formatChartPctTick } from '../domain/chartAxis'
import {
  deleteAnalyticsScenario,
  loadAnalyticsScenarios,
  saveAnalyticsScenario,
} from '../storage/analyticsScenariosStore'
import { planningMonteCarloUrl } from '../domain/deepLinks'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function recommendationAction(rec: string): { to: string; label: string } | null {
  if (/debt/i.test(rec)) return { to: '/liabilities', label: 'Review debt' }
  if (/budget|exceeded/i.test(rec)) return { to: '/budgets', label: 'Open budgets' }
  if (/savings|income/i.test(rec)) return { to: '/budgets', label: 'Plan cashflow' }
  return null
}

function formatProjectionMonths(months: number | null): string {
  if (months == null) return 'Not enough payment data'
  if (months === 0) return 'Already debt-free'
  if (months < 12) return `${months} months`
  return `${months} months (${(months / 12).toFixed(1)} years)`
}

export function PredictiveAnalyticsPage() {
  const { data, privacy, activeId, breakdown } = usePortfolio()
  const { success, warning } = useToasts()
  const [scenario, setScenario] = useState({
    incomeDeltaPct: 0,
    marketReturnPct: 5,
    inflationPct: 3,
  })
  const [savedScenarios, setSavedScenarios] = useState(() => loadAnalyticsScenarios(activeId))
  const [scenarioName, setScenarioName] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(null)

  useEffect(() => {
    setSavedScenarios(loadAnalyticsScenarios(activeId))
    setSelectedScenarioId('')
    setScenarioName('')
  }, [activeId])

  const saveNamedScenario = () => {
    if (!scenarioName.trim()) {
      warning('Name required', 'Enter a name before saving this scenario.')
      return
    }
    const saved = saveAnalyticsScenario(
      activeId,
      scenarioName,
      scenario,
      selectedScenarioId || undefined,
    )
    setSavedScenarios(loadAnalyticsScenarios(activeId))
    setSelectedScenarioId(saved.id)
    setScenarioName(saved.name)
    success('Scenario saved', saved.name)
  }

  const loadNamedScenario = () => {
    const saved = savedScenarios.find((item) => item.id === selectedScenarioId)
    if (!saved) return
    setScenario({
      incomeDeltaPct: saved.incomeDeltaPct,
      marketReturnPct: saved.marketReturnPct,
      inflationPct: saved.inflationPct,
    })
    setScenarioName(saved.name)
    success('Scenario loaded', saved.name)
  }

  const spendingTrends = useMemo(() => 
    analyzeSpendingTrends(data.spending, 12),
    [data.spending]
  )

  const netWorthForecast = useMemo(() => 
    forecastNetWorth(data.history, 12),
    [data.history]
  )

  const anomalies = useMemo(() => 
    detectAnomalies(data.spending, 6),
    [data.spending]
  )

  const budgetGoals = useMemo(() => data.budgetGoals, [data.budgetGoals])

  const totalAssets = breakdown.assets
  const totalLiabilities = breakdown.liabilities

  const monthlyExpenses = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return data.spending
      .filter(s => s.date.startsWith(currentMonth) && isBudgetSpend(s))
      .reduce((sum, s) => sum + Math.abs(s.amount), 0)
  }, [data.spending])

  const financialHealth = useMemo(() => 
    calculateFinancialHealth({
      netWorth: totalAssets - totalLiabilities,
      assets: totalAssets,
      liabilities: totalLiabilities,
      monthlyIncome: data.monthlyIncome,
      monthlyExpenses,
      spending: data.spending,
      budgetGoals,
      cash: calcCash(data),
    }),
    [totalAssets, totalLiabilities, data, data.monthlyIncome, monthlyExpenses, data.spending, budgetGoals]
  )

  const scenarioProjection = useMemo(
    () =>
      projectScenario({
        assets: totalAssets,
        liabilities: totalLiabilities,
        monthlyIncome: data.monthlyIncome,
        monthlyExpenses,
        incomeDeltaPct: scenario.incomeDeltaPct,
        marketReturnPct: scenario.marketReturnPct,
        inflationPct: scenario.inflationPct,
      }),
    [data.monthlyIncome, monthlyExpenses, scenario, totalAssets, totalLiabilities],
  )

  const debtComparison = useMemo(
    () => compareDebtStrategies(data.creditCards, data.loans),
    [data.creditCards, data.loans],
  )

  const debtFreeMonths = useMemo(() => {
    const estimates = [debtComparison.snowball.months, debtComparison.avalanche.months].filter(
      (months): months is number => months != null,
    )
    if (totalLiabilities <= 0) return 0
    return estimates.length ? Math.min(...estimates) : null
  }, [debtComparison, totalLiabilities])

  const fireYears = useMemo(
    () =>
      estimateFireYears({
        assets: totalAssets,
        liabilities: totalLiabilities,
        monthlyIncome: data.monthlyIncome,
        monthlyExpenses,
        annualReturnPct: scenario.marketReturnPct,
      }),
    [data.monthlyIncome, monthlyExpenses, scenario.marketReturnPct, totalAssets, totalLiabilities],
  )

  const savingsRateTrend = useMemo(() => 
    calculateSavingsRateTrend(data.history, 12),
    [data.history]
  )

  const getTrendIcon = (trend: SpendingTrend['trend']) => {
    if (trend === 'increasing') return <TrendingUp size={14} className="text-red-500" />
    if (trend === 'decreasing') return <TrendingDown size={14} className="text-green-500" />
    return <Minus size={14} className="text-text-muted" />
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div>
      <div className="mb-4">
        <BackNav to="/analytics" label="Back to analytics" />
      </div>
      <PageHeader
        eyebrow="Insights"
        title="Predictive Analytics"
        description="Projection models, anomaly detection, and financial health scoring"
      />

      {/* Financial Health Score */}
      <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Award size={20} className={getHealthColor(financialHealth.overall)} />
          Financial Health Score
        </h3>
        
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-surface-hover"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(financialHealth.overall / 100) * 351.86} 351.86`}
                className={getHealthColor(financialHealth.overall)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${getHealthColor(financialHealth.overall)}`}>
                {financialHealth.overall}
              </span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-text-muted mb-1">Savings Rate</p>
              <p className="font-bold">{financialHealth.components.savingsRate.score}/25</p>
              <p className="text-xs text-text-subtle">{financialHealth.components.savingsRate.value}%</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Debt Ratio</p>
              <p className="font-bold">{financialHealth.components.debtRatio.score}/25</p>
              <p className="text-xs text-text-subtle">{financialHealth.components.debtRatio.value}%</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Emergency Fund</p>
              <p className="font-bold">{financialHealth.components.emergencyFund.score}/20</p>
              <p className="text-xs text-text-subtle">{financialHealth.components.emergencyFund.months}mo</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Diversification</p>
              <p className="font-bold">{financialHealth.components.diversification.score}/15</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Budget Adherence</p>
              <p className="font-bold">{financialHealth.components.budgetAdherence.score}/15</p>
              <p className="text-xs text-text-subtle">{financialHealth.components.budgetAdherence.value}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Recommendations:</p>
          {financialHealth.recommendations.map((rec, i) => {
            const action = recommendationAction(rec)
            return (
              <p key={i} className="text-sm text-text-muted">
                • {rec}
                {action ? (
                  <Link to={action.to} className="ml-2 text-accent hover:underline font-medium">
                    {action.label}
                  </Link>
                ) : null}
              </p>
            )
          })}
        </div>
      </div>

      <div
        className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none"
        data-testid="analytics-scenarios"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-lg mb-1">What-if scenarios</h3>
            <p className="text-sm text-text-muted">
              Simple sliders, not AI: adjust income, market return, and inflation assumptions.
            </p>
          </div>
          <p className={`text-sm font-semibold tabular-nums ${privacyClass(privacy)}`}>
            12-mo projected NW {formatGBP(scenarioProjection.projectedNetWorth12Months)}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-subtle font-semibold">
              Income delta
            </span>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={scenario.incomeDeltaPct}
              onChange={(e) =>
                setScenario({ ...scenario, incomeDeltaPct: Number(e.target.value) })
              }
            />
            <span className="text-sm font-semibold tabular-nums">
              {scenario.incomeDeltaPct > 0 ? '+' : ''}{scenario.incomeDeltaPct}%
            </span>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-subtle font-semibold">
              Market return
            </span>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={scenario.marketReturnPct}
              onChange={(e) =>
                setScenario({ ...scenario, marketReturnPct: Number(e.target.value) })
              }
            />
            <span className="text-sm font-semibold tabular-nums">
              {scenario.marketReturnPct > 0 ? '+' : ''}{scenario.marketReturnPct}%
            </span>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-text-subtle font-semibold">
              Inflation
            </span>
            <input
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={scenario.inflationPct}
              onChange={(e) =>
                setScenario({ ...scenario, inflationPct: Number(e.target.value) })
              }
            />
            <span className="text-sm font-semibold tabular-nums">
              {scenario.inflationPct}%
            </span>
          </label>
        </div>
        <div className="border border-border bg-surface-hover/40 p-4 mb-5">
          <p className="label-uppercase mb-3">Named scenarios</p>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
            <label className="block">
              <span className="text-xs text-text-subtle block mb-1">Scenario name</span>
              <input
                type="text"
                value={scenarioName}
                onChange={(event) => setScenarioName(event.target.value)}
                placeholder="e.g. Career break"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-subtle block mb-1">Saved scenario</span>
              <select
                value={selectedScenarioId}
                onChange={(event) => {
                  const id = event.target.value
                  setSelectedScenarioId(id)
                  const saved = savedScenarios.find((item) => item.id === id)
                  if (saved) setScenarioName(saved.name)
                }}
              >
                <option value="">Choose a scenario</option>
                {savedScenarios.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-primary"
              aria-label="Save named analytics scenario"
              onClick={saveNamedScenario}
            >
              Save
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn-secondary btn-sm"
              aria-label="Load selected analytics scenario"
              disabled={!selectedScenarioId}
              onClick={loadNamedScenario}
            >
              Load
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              aria-label="Start a new analytics scenario"
              onClick={() => {
                setSelectedScenarioId('')
                setScenarioName('')
              }}
            >
              Save as new
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm text-red-500"
              aria-label="Delete selected analytics scenario"
              disabled={!selectedScenarioId}
              onClick={() => setDeleteScenarioId(selectedScenarioId || null)}
            >
              Delete
            </button>
            <Link
              to={planningMonteCarloUrl(
                breakdown.netWorth,
                data.fireInputs.savings || 0,
                {
                  meanReturnPct: scenario.marketReturnPct,
                  inflationPct: scenario.inflationPct,
                  scenario: scenarioName.trim() || selectedScenarioId || 'analytics',
                },
              )}
              className="btn-secondary btn-sm"
              data-testid="analytics-open-planning"
              aria-label="Open scenario in Planning Monte Carlo"
            >
              Open in Planning
            </Link>
          </div>
          <p className="text-xs text-text-subtle mt-3">
            Saved locally for the active portfolio. Loading changes assumptions only; it does not
            change portfolio data. Open in Planning seeds Monte Carlo mean return from this scenario.
          </p>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-px ${privacyClass(privacy)}`}>
          <div className="surface-nested p-4">
            <p className="label-uppercase mb-2">Scenario surplus</p>
            <p className="text-lg font-bold tabular-nums">
              {formatGBP(scenarioProjection.monthlySurplus)}/mo
            </p>
          </div>
          <div className="surface-nested p-4">
            <p className="label-uppercase mb-2">Runway</p>
            <p className="text-lg font-bold tabular-nums">
              {scenarioProjection.runwayMonths == null
                ? 'No expenses'
                : `${scenarioProjection.runwayMonths.toFixed(1)} mo`}
            </p>
          </div>
          <div className="surface-nested p-4">
            <p className="label-uppercase mb-2">Adjusted expenses</p>
            <p className="text-lg font-bold tabular-nums">
              {formatGBP(scenarioProjection.adjustedMonthlyExpenses)}/mo
            </p>
          </div>
        </div>
      </div>

      <div
        className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none"
        data-testid="analytics-projections"
      >
        <h3 className="font-bold text-lg mb-4">Debt-free / FIRE-ish projections</h3>
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-px ${privacyClass(privacy)}`}>
          <div className="surface-nested p-5">
            <p className="label-uppercase mb-2">Debt-free estimate</p>
            <p className="text-xl font-bold tabular-nums">{formatProjectionMonths(debtFreeMonths)}</p>
            <p className="text-xs text-text-muted mt-1">
              Uses current minimum payments ({formatGBP(debtComparison.avalanche.monthlyPayment)}/mo)
              and rolls paid-off minimums into remaining debts.
            </p>
          </div>
          <div className="surface-nested p-5">
            <p className="label-uppercase mb-2">FIRE-ish estimate</p>
            <p className="text-xl font-bold tabular-nums">
              {fireYears == null ? 'Needs positive savings rate' : `${fireYears.toFixed(1)} years`}
            </p>
            <p className="text-xs text-text-muted mt-1">
              Uses 25x current annual spend and the market return slider.
            </p>
          </div>
        </div>
      </div>

      {/* Net Worth Forecast */}
      {netWorthForecast.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4">Net Worth Projection (12 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={netWorthForecast}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => formatChartYTick(val)} width={56} />
              <Tooltip
                formatter={(val: any) => formatGBP(Number(val))}
                wrapperClassName={privacyClass(privacy)}
                contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="optimistic"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.1}
                name="Optimistic"
              />
              <Area
                type="monotone"
                dataKey="expected"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                name="Model"
              />
              <Area
                type="monotone"
                dataKey="conservative"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.1}
                name="Conservative"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Spending Trends */}
      {spendingTrends.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4">Category Spending Trends & Projections</h3>
          <div className="space-y-4">
            {spendingTrends.slice(0, 8).map((trend) => (
              <div key={trend.category} className="p-4 bg-surface-hover rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{trend.category}</p>
                    {getTrendIcon(trend.trend)}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${privacyClass(privacy)}`}>{formatGBP(trend.avgMonthly)}/mo</p>
                    <p className={`text-xs ${trend.trend === 'increasing' ? 'text-red-500' : trend.trend === 'decreasing' ? 'text-green-500' : 'text-text-muted'}`}>
                      {trend.trendPercentage > 0 ? '+' : ''}{trend.trendPercentage}%
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-text-muted">3-month projection</p>
                    <p className={`font-medium ${privacyClass(privacy)}`}>{formatGBP(trend.forecast3Month)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">6-month projection</p>
                    <p className={`font-medium ${privacyClass(privacy)}`}>{formatGBP(trend.forecast6Month)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Volatility</p>
                    <p className={`font-medium ${
                      trend.volatility === 'high' ? 'text-red-500' :
                      trend.volatility === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {trend.volatility}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly Detection */}
      {anomalies.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            Spending Anomalies Detected
          </h3>
          <div className="space-y-3">
            {anomalies.slice(0, 10).map((anomaly) => (
              <div
                key={anomaly.id}
                className={`p-3 border-l-4 ${
                  anomaly.severity === 'high' ? 'border-l-red-500 bg-red-500/10' :
                  anomaly.severity === 'medium' ? 'border-l-amber-500 bg-amber-500/10' :
                  'border-l-accent/60 bg-accent/5'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium">{anomaly.description}</p>
                  <span className={`text-xs px-2 py-1 ${
                    anomaly.severity === 'high' ? 'bg-red-500 text-white' :
                    anomaly.severity === 'medium' ? 'bg-amber-500 text-white' :
                    'bg-accent text-white'
                  }`}>
                    {anomaly.severity}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                  <span>{anomaly.date}</span>
                  <span className={privacyClass(privacy)}>Model: {formatGBP(anomaly.expected)}</span>
                  <span className={privacyClass(privacy)}>Actual: {formatGBP(anomaly.actual)}</span>
                  <span className={anomaly.deviation > 0 ? 'text-red-500' : 'text-green-500'}>
                    {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}%
                  </span>
                  <Link to="/budgets" className="text-accent hover:underline font-medium">
                    Adjust budget
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Savings Rate Trend */}
      {savingsRateTrend.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4">Savings Rate Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={savingsRateTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => formatChartPctTick(val)} />
              <Tooltip
                formatter={(val: any) => `${Number(val)}%`}
                contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Savings Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary predictive analytics actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/analytics" className="btn-secondary btn-sm">
          Analytics
        </Link>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
      <ConfirmDialog
        open={deleteScenarioId !== null}
        title="Delete scenario"
        body="Delete this saved what-if scenario?"
        confirmLabel="Delete scenario"
        onClose={() => setDeleteScenarioId(null)}
        onConfirm={() => {
          if (!deleteScenarioId) return
          const deleted = savedScenarios.find((item) => item.id === deleteScenarioId)
          deleteAnalyticsScenario(activeId, deleteScenarioId)
          setSavedScenarios(loadAnalyticsScenarios(activeId))
          if (selectedScenarioId === deleteScenarioId) {
            setSelectedScenarioId('')
            setScenarioName('')
          }
          setDeleteScenarioId(null)
          success('Scenario deleted', deleted?.name)
        }}
      />
    </div>
  )
}
