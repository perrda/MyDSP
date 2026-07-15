import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Award } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import {
  analyzeSpendingTrends,
  forecastNetWorth,
  detectAnomalies,
  calculateFinancialHealth,
  calculateSavingsRateTrend,
  type SpendingTrend,
} from '../domain/advancedAnalytics'
import { formatGBP } from '../utils/format'
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

export function PredictiveAnalyticsPage() {
  const { data } = usePortfolio()

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

  const totalAssets = useMemo(() => 
    data.crypto.reduce((sum, c) => sum + c.qty * c.cost, 0) +
    data.equities.reduce((sum, e) => sum + e.shares * e.avgCost, 0),
    [data.crypto, data.equities]
  )

  const totalLiabilities = useMemo(() => 
    data.creditCards.reduce((sum, c) => sum + c.balance, 0) +
    data.loans.reduce((sum, l) => sum + l.balance, 0),
    [data.creditCards, data.loans]
  )

  const monthlyExpenses = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return data.spending
      .filter(s => s.date.startsWith(currentMonth))
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
    }),
    [totalAssets, totalLiabilities, data.monthlyIncome, monthlyExpenses, data.spending, budgetGoals]
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
      <PageHeader
        eyebrow="Insights"
        title="Predictive Analytics"
        description="AI-powered forecasting, anomaly detection, and financial health scoring"
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
          {financialHealth.recommendations.map((rec, i) => (
            <p key={i} className="text-sm text-text-muted">• {rec}</p>
          ))}
        </div>
      </div>

      {/* Net Worth Forecast */}
      {netWorthForecast.length > 0 && (
        <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4">Net Worth Forecast (12 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={netWorthForecast}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => formatGBP(val)} />
              <Tooltip
                formatter={(val: any) => formatGBP(Number(val))}
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
                name="Expected"
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
          <h3 className="font-bold text-lg mb-4">Category Spending Trends & Forecasts</h3>
          <div className="space-y-4">
            {spendingTrends.slice(0, 8).map((trend) => (
              <div key={trend.category} className="p-4 bg-surface-hover rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{trend.category}</p>
                    {getTrendIcon(trend.trend)}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatGBP(trend.avgMonthly)}/mo</p>
                    <p className={`text-xs ${trend.trend === 'increasing' ? 'text-red-500' : trend.trend === 'decreasing' ? 'text-green-500' : 'text-text-muted'}`}>
                      {trend.trendPercentage > 0 ? '+' : ''}{trend.trendPercentage}%
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-text-muted">3-month forecast</p>
                    <p className="font-medium">{formatGBP(trend.forecast3Month)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">6-month forecast</p>
                    <p className="font-medium">{formatGBP(trend.forecast6Month)}</p>
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
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>{anomaly.date}</span>
                  <span>Expected: {formatGBP(anomaly.expected)}</span>
                  <span>Actual: {formatGBP(anomaly.actual)}</span>
                  <span className={anomaly.deviation > 0 ? 'text-red-500' : 'text-green-500'}>
                    {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}%
                  </span>
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
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
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
    </div>
  )
}
