import type { PortfolioData } from './types'
import { equityUnitPriceGbp } from './migrateEquityGbp'

const KEY = 'mydsp_portfolio_concentration_pct'
export const DEFAULT_PORTFOLIO_CONCENTRATION_PCT = 25

export type PortfolioConcentrationHit = {
  kind: 'crypto' | 'equity'
  id: number
  symbol: string
  name: string
  value: number
  weightPct: number
}

export function loadPortfolioConcentrationThresholdPct(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null || raw === '') return DEFAULT_PORTFOLIO_CONCENTRATION_PCT
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PORTFOLIO_CONCENTRATION_PCT
    return Math.min(100, Math.max(1, n))
  } catch {
    return DEFAULT_PORTFOLIO_CONCENTRATION_PCT
  }
}

export function savePortfolioConcentrationThresholdPct(pct: number): void {
  const n =
    Number.isFinite(pct) && pct > 0
      ? Math.min(100, Math.max(1, pct))
      : DEFAULT_PORTFOLIO_CONCENTRATION_PCT
  try {
    localStorage.setItem(KEY, String(n))
    window.dispatchEvent(new CustomEvent('mydsp-portfolio-concentration'))
  } catch {
    /* ignore */
  }
}

export function includedPortfolioHoldingValue(data: PortfolioData): number {
  let total = 0
  for (const c of data.crypto) {
    if (c.includeInPortfolio === false) continue
    total += c.qty * c.price
  }
  for (const e of data.equities) {
    if (e.includeInPortfolio === false) continue
    total += e.shares * equityUnitPriceGbp(e)
  }
  return total
}

export function portfolioConcentrationHits(
  data: PortfolioData,
  thresholdPct: number = loadPortfolioConcentrationThresholdPct(),
): PortfolioConcentrationHit[] {
  const total = includedPortfolioHoldingValue(data)
  if (!(total > 0)) return []

  const hits: PortfolioConcentrationHit[] = []
  for (const c of data.crypto) {
    if (c.includeInPortfolio === false) continue
    const value = c.qty * c.price
    const weightPct = (value / total) * 100
    if (value > 0 && weightPct >= thresholdPct) {
      hits.push({ kind: 'crypto', id: c.id, symbol: c.symbol, name: c.name, value, weightPct })
    }
  }
  for (const e of data.equities) {
    if (e.includeInPortfolio === false) continue
    const value = e.shares * equityUnitPriceGbp(e)
    const weightPct = (value / total) * 100
    if (value > 0 && weightPct >= thresholdPct) {
      hits.push({ kind: 'equity', id: e.id, symbol: e.symbol, name: e.name, value, weightPct })
    }
  }
  return hits.sort((a, b) => b.weightPct - a.weightPct)
}
