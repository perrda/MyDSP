// Advanced Analytics Dashboard - ML-style insights and predictions

import { useMemo } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { 
  linearRegression, 
  detectOutliers, 
  detectTrend, 
  detectSeasonality,
  mean
} from '../domain/advancedMath'
import { formatGBP } from '../utils/format'
import { TrendingUp, AlertTriangle, Lightbulb, Target, Zap } from 'lucide-react'

interface AdvancedInsight {
  type: 'trend' | 'anomaly' | 'prediction' | 'recommendation' | 'warning' | 'opportunity'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  confidence: number
  data?: any
}

export function AdvancedAnalyticsDashboard() {
  const { data } = usePortfolio()

  // Calculate advanced insights
  const insights = useMemo(() => {
    if (!data) return []

    const results: AdvancedInsight[] = []

    try {
      // 1. NET WORTH TREND ANALYSIS
      if (data.history && data.history.length >= 10) {
        const historyData = data.history.slice(-30) // Last 30 points
        const values = historyData.map(h => h.netWorth)
        const xValues = historyData.map((_, i) => i)

        // Linear regression
        const regression = linearRegression(xValues, values)
        const trendDirection = regression.slope > 0 ? 'increasing' : 'decreasing'
        const trendStrength = Math.abs(regression.r)

        results.push({
          type: 'trend',
          title: `Net Worth ${trendDirection === 'increasing' ? 'Growing' : 'Declining'}`,
          description: `Your net worth is ${trendDirection} at ${formatGBP(Math.abs(regression.slope))} per day on average. Trend confidence: ${(trendStrength * 100).toFixed(1)}%`,
          impact: trendStrength > 0.7 ? 'high' : trendStrength > 0.4 ? 'medium' : 'low',
          confidence: trendStrength,
          data: { slope: regression.slope, r2: regression.r2, direction: trendDirection }
        })

        // 3-month forecast
        const futureDays = 90
        const futureValue = regression.predict(xValues.length + futureDays)
        const currentValue = values[values.length - 1]
        const change = futureValue - currentValue

        results.push({
          type: 'prediction',
          title: '90-Day Net Worth Forecast',
          description: `Based on current trends, your net worth could ${change > 0 ? 'increase' : 'decrease'} by ${formatGBP(Math.abs(change))} in the next 3 months (projected: ${formatGBP(futureValue)})`,
          impact: Math.abs(change) > 10000 ? 'high' : Math.abs(change) > 5000 ? 'medium' : 'low',
          confidence: trendStrength,
          data: { current: currentValue, predicted: futureValue, change }
        })
      }

      // 2. SPENDING ANOMALY DETECTION
      if (data.spending && data.spending.length >= 30) {
        const last30Days = data.spending.slice(-30)
        const dailySpending = last30Days.map(s => s.amount)
        
        const outliers = detectOutliers(dailySpending)
        if (outliers.length > 0) {
          const avgOutlier = mean(outliers.map(o => dailySpending[o]))
          const avgNormal = mean(dailySpending.filter((_, i) => !outliers.includes(i)))
          
          results.push({
            type: 'anomaly',
            title: `${outliers.length} Unusual Spending Day${outliers.length > 1 ? 's' : ''} Detected`,
            description: `You had ${outliers.length} day(s) with abnormally high spending (avg ${formatGBP(avgOutlier)} vs normal ${formatGBP(avgNormal)})`,
            impact: outliers.length > 5 ? 'high' : outliers.length > 2 ? 'medium' : 'low',
            confidence: 0.85,
            data: { outliers, avgOutlier, avgNormal }
          })
        }
      }

      // 3. SPENDING TREND ANALYSIS
      if (data.spending && data.spending.length >= 14) {
        const last14Days = data.spending.slice(-14).map(s => s.amount)
        const trend = detectTrend(last14Days)
        
        if (trend !== 'stable') {
          const avgLast7 = mean(last14Days.slice(-7))
          const avgFirst7 = mean(last14Days.slice(0, 7))
          const change = ((avgLast7 - avgFirst7) / avgFirst7) * 100

          results.push({
            type: trend === 'increasing' ? 'warning' : 'opportunity',
            title: trend === 'increasing' ? 'Spending Increasing' : 'Spending Decreasing',
            description: `Your spending has ${trend === 'increasing' ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% over the last 2 weeks (${formatGBP(avgFirst7)} → ${formatGBP(avgLast7)})`,
            impact: Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low',
            confidence: 0.75,
            data: { trend, change, avgFirst7, avgLast7 }
          })
        }
      }

      // 4. SEASONALITY DETECTION
      if (data.spending && data.spending.length >= 60) {
        const last60Days = data.spending.slice(-60).map(s => s.amount)
        const seasonality = detectSeasonality(last60Days, 7) // Weekly seasonality
        
        if (seasonality) {
          results.push({
            type: 'trend',
            title: 'Weekly Spending Pattern Detected',
            description: `Your spending follows a weekly pattern. Understanding this can help optimize your budget planning.`,
            impact: 'medium',
            confidence: 0.70,
            data: { seasonality: true, period: 7 }
          })
        }
      }

      // 5. DEBT RECOMMENDATIONS
      if (data.creditCards && data.creditCards.length > 0) {
        const highUtilization = data.creditCards.filter(cc => {
          const utilization = (cc.balance / cc.limit) * 100
          return utilization > 70
        })

        if (highUtilization.length > 0) {
          const totalHighUtil = highUtilization.reduce((sum, cc) => sum + cc.balance, 0)
          
          results.push({
            type: 'warning',
            title: `High Credit Utilization Detected`,
            description: `${highUtilization.length} card(s) above 70% utilization (${formatGBP(totalHighUtil)} total). Consider paying down to improve credit score.`,
            impact: 'high',
            confidence: 1.0,
            data: { cards: highUtilization.length, total: totalHighUtil }
          })
        }
      }

      // 6. GOAL PROGRESS ANALYSIS
      if (data.goals && data.goals.length > 0) {
        data.goals.forEach(goal => {
          // Calculate current value based on goal metric
          let currentValue = 0
          if (goal.metric === 'networth') {
            currentValue = data.history && data.history.length > 0 
              ? data.history[data.history.length - 1].netWorth 
              : 0
          } else if (goal.metric === 'debt') {
            const totalDebt = (data.creditCards?.reduce((sum, cc) => sum + cc.balance, 0) || 0) +
                             (data.loans?.reduce((sum, l) => sum + l.balance, 0) || 0)
            currentValue = totalDebt
          }

          const progress = (currentValue / goal.target) * 100
          const deadline = new Date(goal.deadline)
          const now = new Date()
          const daysRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          
          if (daysRemaining > 0 && progress < 80) {
            const remaining = goal.target - currentValue
            const dailyRequired = remaining / daysRemaining

            results.push({
              type: 'recommendation',
              title: `${goal.name} - Action Required`,
              description: `You need to ${goal.type === 'debt' ? 'pay down' : 'save'} ${formatGBP(Math.abs(dailyRequired))} per day to reach your goal of ${formatGBP(goal.target)} by ${goal.deadline}. Current progress: ${progress.toFixed(1)}%`,
              impact: progress < 50 ? 'high' : progress < 70 ? 'medium' : 'low',
              confidence: 0.90,
              data: { goalId: goal.id, progress, dailyRequired, remaining, daysRemaining }
            })
          }
        })
      }

      // 7. FINANCIAL HEALTH SCORE
      const healthFactors = {
        debtToIncome: 0,
        savingsRate: 0,
        emergencyFund: 0,
        creditUtilization: 0,
        diversification: 0
      }

      // Calculate health score (0-100)
      let totalScore = 0
      let factorCount = 0

      // Credit utilization (if applicable)
      if (data.creditCards && data.creditCards.length > 0) {
        const totalBalance = data.creditCards.reduce((sum, cc) => sum + cc.balance, 0)
        const totalLimit = data.creditCards.reduce((sum, cc) => sum + cc.limit, 0)
        const utilization = (totalBalance / totalLimit) * 100
        healthFactors.creditUtilization = Math.max(0, 100 - utilization)
        totalScore += healthFactors.creditUtilization
        factorCount++
      }

      // Portfolio diversification
      if (data.crypto && data.equities) {
        const cryptoCount = data.crypto.filter((c: any) => c.includeInPortfolio !== false).length
        const equityCount = data.equities.filter((e: any) => e.includeInPortfolio !== false).length
        const totalHoldings = cryptoCount + equityCount
        
        if (totalHoldings > 0) {
          // Reward diversification (more holdings = better)
          healthFactors.diversification = Math.min(100, (totalHoldings / 10) * 100)
          totalScore += healthFactors.diversification
          factorCount++
        }
      }

      if (factorCount > 0) {
        const avgScore = totalScore / factorCount
        
        results.push({
          type: avgScore > 70 ? 'opportunity' : avgScore > 40 ? 'recommendation' : 'warning',
          title: `Financial Health Score: ${avgScore.toFixed(0)}/100`,
          description: `Your financial health is ${avgScore > 70 ? 'excellent' : avgScore > 40 ? 'good' : 'needs improvement'}. ${avgScore > 70 ? 'Keep up the great work!' : avgScore > 40 ? 'Consider improving your credit utilization and diversification.' : 'Focus on reducing debt and building savings.'}`,
          impact: avgScore < 40 ? 'high' : avgScore < 70 ? 'medium' : 'low',
          confidence: 0.80,
          data: { score: avgScore, factors: healthFactors }
        })
      }

    } catch (error) {
      console.error('Error calculating insights:', error)
    }

    return results.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 }
      return impactOrder[b.impact] - impactOrder[a.impact]
    })
  }, [data])

  const iconMap = {
    trend: <TrendingUp className="w-5 h-5" />,
    anomaly: <AlertTriangle className="w-5 h-5" />,
    prediction: <Target className="w-5 h-5" />,
    recommendation: <Lightbulb className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    opportunity: <Zap className="w-5 h-5" />
  }

  const colorMap = {
    high: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100',
    medium: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100',
    low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Advanced Analytics</h2>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered insights and predictions based on your financial data
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
          <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            Not enough data yet. Keep tracking your finances to unlock AI-powered insights!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-6 rounded-lg border-2 ${colorMap[insight.impact]}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {iconMap[insight.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{insight.title}</h3>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-white dark:bg-gray-700 opacity-75">
                      {(insight.confidence * 100).toFixed(0)}% confident
                    </span>
                  </div>
                  <p className="text-sm opacity-90">{insight.description}</p>
                  
                  <div className="mt-3 flex items-center gap-2 text-xs opacity-75">
                    <span className="capitalize">{insight.type}</span>
                    <span>•</span>
                    <span className="capitalize">{insight.impact} impact</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
