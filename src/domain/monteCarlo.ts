/** Monte Carlo portfolio projection (monthly steps, Box–Muller). */

export interface MonteCarloInputs {
  currentValue: number
  monthlyContribution: number
  years: number
  simulations: number
  meanReturn: number
  stdDev: number
}

export interface MonteCarloResult {
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
  expected: number
  /** Year-end percentile paths for charting (length = years + 1 including t0) */
  bands: { year: number; p5: number; p50: number; p95: number }[]
}

function gaussian(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

export function runMonteCarlo(inputs: MonteCarloInputs): MonteCarloResult {
  const years = Math.max(1, Math.min(50, Math.floor(inputs.years) || 10))
  const sims = Math.max(100, Math.min(20000, Math.floor(inputs.simulations) || 5000))
  const months = years * 12
  const monthlyMean = inputs.meanReturn / 12
  const monthlyVol = inputs.stdDev / Math.sqrt(12)
  const contribution = Number.isFinite(inputs.monthlyContribution) ? inputs.monthlyContribution : 0
  const start = Math.max(0, Number.isFinite(inputs.currentValue) ? inputs.currentValue : 0)

  const finals: number[] = []
  const yearEnds: number[][] = Array.from({ length: years + 1 }, () => [])

  for (let s = 0; s < sims; s++) {
    let value = start
    yearEnds[0].push(value)
    for (let m = 1; m <= months; m++) {
      const z = gaussian()
      const monthReturn = monthlyMean + monthlyVol * z
      value = Math.max(0, value * (1 + monthReturn) + contribution)
      if (m % 12 === 0) yearEnds[m / 12].push(value)
    }
    finals.push(value)
  }

  finals.sort((a, b) => a - b)
  const bands = yearEnds.map((arr, year) => {
    const sorted = [...arr].sort((a, b) => a - b)
    return {
      year,
      p5: percentile(sorted, 5),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
    }
  })

  return {
    p5: percentile(finals, 5),
    p25: percentile(finals, 25),
    p50: percentile(finals, 50),
    p75: percentile(finals, 75),
    p95: percentile(finals, 95),
    expected: finals.reduce((a, b) => a + b, 0) / finals.length,
    bands,
  }
}
