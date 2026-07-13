// Advanced Analytics and Forecasting Engine
// ML-style predictions, anomaly detection, and financial insights

import type { SpendingEntry, HistoryPoint } from '../domain/types'

export interface SpendingTrend {
  category: string
  avgMonthly: number
  trend: 'increasing' | 'decreasing' | 'stable'
  trendPercentage: number
  volatility: 'high' | 'medium' | 'low'
  forecast3Month: number
  forecast6Month: number
  forecast12Month: number
}

export interface NetWorthForecast {
  month: string
  conservative: number
  expected: number
  optimistic: number
  confidence: number
}

export interface AnomalyDetection {
  id: string
  type: 'spending' | 'income' | 'category'
  severity: 'high' | 'medium' | 'low'
  date: string
  description: string
  expected: number
  actual: number
  deviation: number
}

export interface FinancialHealthScore {
  overall: number // 0-100
  components: {
    savingsRate: { score: number; value: number }
    debtRatio: { score: number; value: number }
    emergencyFund: { score: number; months: number }
    diversification: { score: number; value: number }
    budgetAdherence: { score: number; value: number }
  }
  recommendations: string[]
}

// Linear regression for trend analysis
function linearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number; r2: number } {
  const n = xValues.length
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 }

  const sumX = xValues.reduce((a, b) => a + b, 0)
  const sumY = yValues.reduce((a, b) => a + b, 0)
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R²
  const yMean = sumY / n
  const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0)
  const ssResidual = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + intercept
    return sum + Math.pow(y - predicted, 2)
  }, 0)
  const r2 = 1 - (ssResidual / ssTotal)

  return { slope, intercept, r2: isNaN(r2) ? 0 : r2 }
}

// Calculate standard deviation
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map(value => Math.pow(value - mean, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquareDiff)
}

// Analyze spending trends by category
export function analyzeSpendingTrends(spending: SpendingEntry[], months: number = 12): SpendingTrend[] {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - months)
  
  const recentSpending = spending.filter(s => new Date(s.date) >= cutoffDate)
  
  // Group by category and month
  const categoryMonthly = new Map<string, Map<string, number>>()
  
  recentSpending.forEach(s => {
    const category = s.category.toLowerCase()
    const month = s.date.slice(0, 7) // YYYY-MM
    
    if (!categoryMonthly.has(category)) {
      categoryMonthly.set(category, new Map())
    }
    
    const monthlyMap = categoryMonthly.get(category)!
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + Math.abs(s.amount))
  })
  
  const trends: SpendingTrend[] = []
  
  categoryMonthly.forEach((monthlyData, category) => {
    const months = Array.from(monthlyData.keys()).sort()
    const amounts = months.map(m => monthlyData.get(m) || 0)
    
    if (amounts.length < 3) return // Need at least 3 months for meaningful analysis
    
    // Calculate average
    const avgMonthly = amounts.reduce((a, b) => a + b, 0) / amounts.length
    
    // Perform linear regression
    const xValues = amounts.map((_, i) => i)
    const { slope } = linearRegression(xValues, amounts)
    
    // Determine trend
    const trendPercentage = (slope / avgMonthly) * 100
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (Math.abs(trendPercentage) > 5) {
      trend = trendPercentage > 0 ? 'increasing' : 'decreasing'
    }
    
    // Calculate volatility
    const stdDev = standardDeviation(amounts)
    const coefficientOfVariation = stdDev / avgMonthly
    let volatility: 'high' | 'medium' | 'low' = 'low'
    if (coefficientOfVariation > 0.3) volatility = 'high'
    else if (coefficientOfVariation > 0.15) volatility = 'medium'
    
    // Forecast using linear regression
    const lastIndex = amounts.length - 1
    const forecast3Month = Math.max(0, slope * (lastIndex + 3) + (avgMonthly - slope * lastIndex))
    const forecast6Month = Math.max(0, slope * (lastIndex + 6) + (avgMonthly - slope * lastIndex))
    const forecast12Month = Math.max(0, slope * (lastIndex + 12) + (avgMonthly - slope * lastIndex))
    
    trends.push({
      category,
      avgMonthly,
      trend,
      trendPercentage: Math.round(trendPercentage * 10) / 10,
      volatility,
      forecast3Month: Math.round(forecast3Month),
      forecast6Month: Math.round(forecast6Month),
      forecast12Month: Math.round(forecast12Month),
    })
  })
  
  return trends.sort((a, b) => b.avgMonthly - a.avgMonthly)
}

// Forecast net worth
export function forecastNetWorth(history: HistoryPoint[], monthsAhead: number = 12): NetWorthForecast[] {
  if (history.length < 3) return []
  
  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const recentHistory = sortedHistory.slice(-12) // Use last 12 months
  
  const xValues = recentHistory.map((_, i) => i)
  const yValues = recentHistory.map(h => h.netWorth)
  
  const { slope, intercept, r2 } = linearRegression(xValues, yValues)
  
  // Calculate volatility for confidence intervals
  const stdDev = standardDeviation(yValues)
  
  const forecasts: NetWorthForecast[] = []
  const lastIndex = recentHistory.length - 1
  const lastDate = new Date(recentHistory[recentHistory.length - 1].date)
  
  for (let i = 1; i <= monthsAhead; i++) {
    const forecastDate = new Date(lastDate)
    forecastDate.setMonth(forecastDate.getMonth() + i)
    const month = forecastDate.toISOString().slice(0, 7)
    
    const expected = slope * (lastIndex + i) + intercept
    const conservative = expected - stdDev * 1.5
    const optimistic = expected + stdDev * 1.5
    
    // Confidence decreases over time
    const confidence = Math.max(0, Math.min(100, r2 * 100 * (1 - i / (monthsAhead * 2))))
    
    forecasts.push({
      month,
      conservative: Math.round(Math.max(0, conservative)),
      expected: Math.round(Math.max(0, expected)),
      optimistic: Math.round(Math.max(0, optimistic)),
      confidence: Math.round(confidence),
    })
  }
  
  return forecasts
}

// Detect spending anomalies
export function detectAnomalies(spending: SpendingEntry[], monthsToAnalyze: number = 6): AnomalyDetection[] {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToAnalyze)
  
  const recentSpending = spending.filter(s => new Date(s.date) >= cutoffDate)
  
  // Group by category
  const categorySpending = new Map<string, number[]>()
  
  recentSpending.forEach(s => {
    const category = s.category.toLowerCase()
    const amount = Math.abs(s.amount)
    
    if (!categorySpending.has(category)) {
      categorySpending.set(category, [])
    }
    categorySpending.get(category)!.push(amount)
  })
  
  const anomalies: AnomalyDetection[] = []
  
  categorySpending.forEach((amounts, category) => {
    if (amounts.length < 5) return // Need enough data
    
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const stdDev = standardDeviation(amounts)
    
    // Find outliers (>2 standard deviations from mean)
    amounts.forEach((amount) => {
      const zScore = Math.abs((amount - mean) / stdDev)
      
      if (zScore > 2) {
        const deviation = ((amount - mean) / mean) * 100
        const severity: 'high' | 'medium' | 'low' = 
          zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low'
        
        // Find the actual transaction
        const transaction = recentSpending.find(
          s => s.category.toLowerCase() === category && Math.abs(s.amount) === amount
        )
        
        if (transaction) {
          anomalies.push({
            id: `anomaly-${transaction.id}`,
            type: 'category',
            severity,
            date: transaction.date,
            description: `Unusual ${category} spending: ${transaction.description}`,
            expected: Math.round(mean),
            actual: Math.round(amount),
            deviation: Math.round(deviation),
          })
        }
      }
    })
  })
  
  return anomalies.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

// Calculate financial health score
export function calculateFinancialHealth(data: {
  netWorth: number
  assets: number
  liabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  spending: SpendingEntry[]
  budgetGoals: Record<string, number>
  emergencyFundMonths?: number
}): FinancialHealthScore {
  const recommendations: string[] = []
  
  // 1. Savings Rate (0-25 points)
  const savingsRate = ((data.monthlyIncome - data.monthlyExpenses) / data.monthlyIncome) * 100
  const savingsScore = Math.min(25, Math.max(0, (savingsRate / 20) * 25))
  if (savingsRate < 10) recommendations.push('Increase savings rate to at least 10% of income')
  
  // 2. Debt Ratio (0-25 points)
  const debtRatio = data.assets > 0 ? (data.liabilities / data.assets) * 100 : 0
  const debtScore = Math.min(25, Math.max(0, 25 - (debtRatio / 40) * 25))
  if (debtRatio > 30) recommendations.push('Reduce debt to below 30% of assets')
  
  // 3. Emergency Fund (0-20 points)
  const emergencyMonths = data.emergencyFundMonths || 
    (data.assets > 0 ? data.assets / (data.monthlyExpenses * 12) : 0)
  const emergencyScore = Math.min(20, (emergencyMonths / 6) * 20)
  if (emergencyMonths < 3) recommendations.push('Build emergency fund to cover 3-6 months expenses')
  
  // 4. Diversification (0-15 points) - placeholder
  const diversificationScore = 10 // Would need asset allocation data
  
  // 5. Budget Adherence (0-15 points)
  const ym = new Date().toISOString().slice(0, 7)
  const monthSpending = data.spending.filter(s => s.date.startsWith(ym))
  const categorySpending = new Map<string, number>()
  
  monthSpending.forEach(s => {
    const cat = s.category.toLowerCase()
    categorySpending.set(cat, (categorySpending.get(cat) || 0) + Math.abs(s.amount))
  })
  
  let budgetViolations = 0
  let totalCategories = 0
  
  Object.entries(data.budgetGoals).forEach(([category, limit]) => {
    totalCategories++
    const spent = categorySpending.get(category.toLowerCase()) || 0
    if (spent > limit) budgetViolations++
  })
  
  const budgetScore = totalCategories > 0 
    ? 15 * (1 - (budgetViolations / totalCategories))
    : 15
  
  if (budgetViolations > 0) {
    recommendations.push(`${budgetViolations} budget(s) exceeded this month`)
  }
  
  const overall = Math.round(savingsScore + debtScore + emergencyScore + diversificationScore + budgetScore)
  
  return {
    overall,
    components: {
      savingsRate: { score: Math.round(savingsScore), value: Math.round(savingsRate) },
      debtRatio: { score: Math.round(debtScore), value: Math.round(debtRatio) },
      emergencyFund: { score: Math.round(emergencyScore), months: Math.round(emergencyMonths * 10) / 10 },
      diversification: { score: Math.round(diversificationScore), value: 50 },
      budgetAdherence: { score: Math.round(budgetScore), value: Math.round(((totalCategories - budgetViolations) / totalCategories) * 100) },
    },
    recommendations: recommendations.length > 0 ? recommendations : ['Great job! Keep up the good financial habits.'],
  }
}

// Calculate savings rate trend
export function calculateSavingsRateTrend(history: HistoryPoint[], months: number = 12): Array<{ month: string; rate: number }> {
  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-months)
  
  return sortedHistory.slice(1).map((snapshot, i) => {
    const prev = sortedHistory[i]
    const growth = snapshot.netWorth - prev.netWorth
    const rate = prev.netWorth > 0 ? (growth / prev.netWorth) * 100 : 0
    
    return {
      month: snapshot.date.slice(0, 7),
      rate: Math.round(rate * 100) / 100,
    }
  })
}
