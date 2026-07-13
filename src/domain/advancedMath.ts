// Advanced mathematical and statistical utilities for financial analysis

// === STATISTICAL FUNCTIONS ===

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function mode(values: number[]): number | null {
  if (values.length === 0) return null
  
  const frequency = new Map<number, number>()
  values.forEach(v => frequency.set(v, (frequency.get(v) || 0) + 1))
  
  let maxFreq = 0
  let modeValue = values[0]
  
  frequency.forEach((freq, value) => {
    if (freq > maxFreq) {
      maxFreq = freq
      modeValue = value
    }
  })
  
  return maxFreq > 1 ? modeValue : null
}

export function variance(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
}

export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values))
}

export function coefficientOfVariation(values: number[]): number {
  const avg = mean(values)
  return avg === 0 ? 0 : standardDeviation(values) / avg
}

export function skewness(values: number[]): number {
  if (values.length < 3) return 0
  
  const avg = mean(values)
  const stdDev = standardDeviation(values)
  
  if (stdDev === 0) return 0
  
  const n = values.length
  const sum = values.reduce((s, v) => s + Math.pow((v - avg) / stdDev, 3), 0)
  
  return (n / ((n - 1) * (n - 2))) * sum
}

export function kurtosis(values: number[]): number {
  if (values.length < 4) return 0
  
  const avg = mean(values)
  const stdDev = standardDeviation(values)
  
  if (stdDev === 0) return 0
  
  const n = values.length
  const sum = values.reduce((s, v) => s + Math.pow((v - avg) / stdDev, 4), 0)
  
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum -
         (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3))
}

// === CORRELATION AND REGRESSION ===

export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0
  
  const meanX = mean(x)
  const meanY = mean(y)
  
  return x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / x.length
}

export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0
  
  const stdX = standardDeviation(x)
  const stdY = standardDeviation(y)
  
  if (stdX === 0 || stdY === 0) return 0
  
  return covariance(x, y) / (stdX * stdY)
}

export interface RegressionResult {
  slope: number
  intercept: number
  r: number
  r2: number
  predict: (x: number) => number
}

export function linearRegression(x: number[], y: number[]): RegressionResult {
  if (x.length !== y.length || x.length === 0) {
    return { slope: 0, intercept: 0, r: 0, r2: 0, predict: () => 0 }
  }
  
  const n = x.length
  const sumX = x.reduce((s, v) => s + v, 0)
  const sumY = y.reduce((s, v) => s + v, 0)
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0)
  const sumX2 = x.reduce((s, v) => s + v * v, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  const r = correlation(x, y)
  const r2 = r * r
  
  return {
    slope,
    intercept,
    r,
    r2,
    predict: (xVal: number) => slope * xVal + intercept
  }
}

export function polynomialRegression(
  x: number[],
  y: number[],
  degree: number
): { coefficients: number[]; predict: (x: number) => number } {
  // Simplified polynomial regression (degree 2 for now)
  if (degree !== 2 || x.length !== y.length || x.length === 0) {
    return { coefficients: [0], predict: () => 0 }
  }
  
  // For quadratic: y = ax² + bx + c
  const n = x.length
  const sumX = x.reduce((s, v) => s + v, 0)
  const sumX2 = x.reduce((s, v) => s + v * v, 0)
  const sumX3 = x.reduce((s, v) => s + Math.pow(v, 3), 0)
  const sumY = y.reduce((s, v) => s + v, 0)
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0)
  const sumX2Y = x.reduce((s, xi, i) => s + xi * xi * y[i], 0)
  
  // Solve system of equations using matrix operations (simplified)
  const a = (sumX2Y * sumX2 - sumXY * sumX3) / (sumX2 * sumX2 - sumX3 * sumX)
  const b = (sumXY - a * sumX2) / sumX
  const c = (sumY - b * sumX - a * sumX2) / n
  
  return {
    coefficients: [c, b, a],
    predict: (xVal: number) => a * xVal * xVal + b * xVal + c
  }
}

// === EXPONENTIAL SMOOTHING ===

export function exponentialSmoothing(
  values: number[],
  alpha: number = 0.3
): number[] {
  if (values.length === 0) return []
  
  const smoothed: number[] = [values[0]]
  
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1])
  }
  
  return smoothed
}

export function doubleExponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.3
): number[] {
  if (values.length < 2) return values
  
  let level = values[0]
  let trend = values[1] - values[0]
  const smoothed: number[] = [values[0]]
  
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level
    level = alpha * values[i] + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    smoothed.push(level + trend)
  }
  
  return smoothed
}

// === MOVING AVERAGES ===

export function simpleMovingAverage(
  values: number[],
  period: number
): number[] {
  if (values.length < period) return []
  
  const result: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0)
    result.push(sum / period)
  }
  
  return result
}

export function exponentialMovingAverage(
  values: number[],
  period: number
): number[] {
  if (values.length === 0) return []
  
  const alpha = 2 / (period + 1)
  const ema: number[] = [values[0]]
  
  for (let i = 1; i < values.length; i++) {
    ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1])
  }
  
  return ema
}

export function weightedMovingAverage(
  values: number[],
  period: number
): number[] {
  if (values.length < period) return []
  
  const result: number[] = []
  const weights = Array.from({ length: period }, (_, i) => i + 1)
  const weightSum = weights.reduce((s, w) => s + w, 0)
  
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1)
    const weightedSum = window.reduce((s, v, idx) => s + v * weights[idx], 0)
    result.push(weightedSum / weightSum)
  }
  
  return result
}

// === PERCENTILES AND QUARTILES ===

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  if (p < 0 || p > 100) return 0
  
  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  
  if (lower === upper) return sorted[lower]
  
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

export function quartiles(values: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  const q1 = percentile(values, 25)
  const q2 = percentile(values, 50)
  const q3 = percentile(values, 75)
  const iqr = q3 - q1
  
  return { q1, q2, q3, iqr }
}

// === FINANCIAL CALCULATIONS ===

export function compoundAnnualGrowthRate(
  initialValue: number,
  finalValue: number,
  years: number
): number {
  if (initialValue <= 0 || years <= 0) return 0
  return Math.pow(finalValue / initialValue, 1 / years) - 1
}

export function sharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length === 0) return 0
  
  const excessReturns = returns.map(r => r - riskFreeRate)
  const avgExcessReturn = mean(excessReturns)
  const stdDev = standardDeviation(excessReturns)
  
  return stdDev === 0 ? 0 : avgExcessReturn / stdDev
}

export function maxDrawdown(values: number[]): { maxDD: number; peak: number; trough: number } {
  if (values.length === 0) return { maxDD: 0, peak: 0, trough: 0 }
  
  let maxDD = 0
  let peak = values[0]
  let peakIdx = 0
  let troughIdx = 0
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i]
      peakIdx = i
    }
    
    const drawdown = (peak - values[i]) / peak
    if (drawdown > maxDD) {
      maxDD = drawdown
      troughIdx = i
    }
  }
  
  return {
    maxDD,
    peak: peakIdx,
    trough: troughIdx
  }
}

export function volatility(returns: number[], annualize: boolean = true): number {
  const vol = standardDeviation(returns)
  return annualize ? vol * Math.sqrt(252) : vol // 252 trading days
}

export function beta(assetReturns: number[], marketReturns: number[]): number {
  if (assetReturns.length !== marketReturns.length) return 0
  
  const cov = covariance(assetReturns, marketReturns)
  const marketVar = variance(marketReturns)
  
  return marketVar === 0 ? 0 : cov / marketVar
}

// === VALUE AT RISK ===

export function valueAtRisk(
  returns: number[],
  confidenceLevel: number = 0.95
): number {
  if (returns.length === 0) return 0
  
  const sorted = [...returns].sort((a, b) => a - b)
  const index = Math.floor((1 - confidenceLevel) * sorted.length)
  
  return sorted[index]
}

export function conditionalValueAtRisk(
  returns: number[],
  confidenceLevel: number = 0.95
): number {
  if (returns.length === 0) return 0
  
  const var95 = valueAtRisk(returns, confidenceLevel)
  const tailReturns = returns.filter(r => r <= var95)
  
  return tailReturns.length === 0 ? 0 : mean(tailReturns)
}

// === TIME SERIES ANALYSIS ===

export function autocorrelation(values: number[], lag: number): number {
  if (values.length <= lag) return 0
  
  const avg = mean(values)
  
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < values.length; i++) {
    denominator += Math.pow(values[i] - avg, 2)
    if (i >= lag) {
      numerator += (values[i] - avg) * (values[i - lag] - avg)
    }
  }
  
  return denominator === 0 ? 0 : numerator / denominator
}

export function detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 3) return 'stable'
  
  const x = Array.from({ length: values.length }, (_, i) => i)
  const { slope, r2 } = linearRegression(x, values)
  
  if (r2 < 0.5) return 'stable' // Low correlation, no clear trend
  
  return slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable'
}

export function detectSeasonality(
  values: number[],
  period: number
): boolean {
  if (values.length < period * 2) return false
  
  const correlations: number[] = []
  
  for (let lag = period; lag <= period * 2; lag += period) {
    correlations.push(Math.abs(autocorrelation(values, lag)))
  }
  
  return correlations.some(c => c > 0.5)
}

// === OUTLIER DETECTION ===

export function detectOutliers(values: number[], method: 'iqr' | 'zscore' = 'iqr'): number[] {
  if (values.length === 0) return []
  
  if (method === 'iqr') {
    const { q1, q3, iqr } = quartiles(values)
    const lowerBound = q1 - 1.5 * iqr
    const upperBound = q3 + 1.5 * iqr
    
    return values.filter(v => v < lowerBound || v > upperBound)
  } else {
    const avg = mean(values)
    const stdDev = standardDeviation(values)
    
    return values.filter(v => Math.abs(v - avg) > 3 * stdDev)
  }
}

// === NORMALIZATION ===

export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return []
  
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal
  
  if (range === 0) return values.map(() => 0)
  
  return values.map(v => (v - minVal) / range)
}

export function zScoreNormalize(values: number[]): number[] {
  if (values.length === 0) return []
  
  const avg = mean(values)
  const stdDev = standardDeviation(values)
  
  if (stdDev === 0) return values.map(() => 0)
  
  return values.map(v => (v - avg) / stdDev)
}
