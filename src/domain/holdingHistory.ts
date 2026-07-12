/** Per-holding price history stored in portfolio extras. */

import type { PortfolioData } from './types'

export interface HoldingPricePoint {
  date: string
  price: number
  at?: string
  source?: 'auto' | 'manual'
}

export type HoldingHistoryMap = Record<string, HoldingPricePoint[]>

const MAX_POINTS = 2000

export function holdingHistoryKey(kind: 'crypto' | 'equity', symbol: string): string {
  return `${kind}:${symbol.toUpperCase()}`
}

export function readHoldingHistory(data: PortfolioData): HoldingHistoryMap {
  const raw = data.extras?.holdingHistory
  if (!raw || typeof raw !== 'object') return {}
  const out: HoldingHistoryMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue
    out[k] = v
      .filter((p): p is HoldingPricePoint => {
        if (!p || typeof p !== 'object') return false
        const row = p as HoldingPricePoint
        return typeof row.date === 'string' && typeof row.price === 'number' && row.price > 0
      })
      .map((p) => ({
        date: p.date.slice(0, 10),
        price: p.price,
        at: typeof p.at === 'string' ? p.at : undefined,
        source: p.source === 'manual' ? 'manual' : 'auto',
      }))
  }
  return out
}

export function appendHoldingPrices(
  data: PortfolioData,
  updates: { kind: 'crypto' | 'equity'; symbol: string; price: number }[],
  at = new Date().toISOString(),
): PortfolioData {
  if (updates.length === 0) return data
  const map = readHoldingHistory(data)
  const day = at.slice(0, 10)
  for (const u of updates) {
    if (!(u.price > 0)) continue
    const key = holdingHistoryKey(u.kind, u.symbol)
    const series = [...(map[key] ?? [])]
    const last = series[series.length - 1]
    // Collapse updates within 15 minutes into one point
    if (last?.at) {
      const gap = new Date(at).getTime() - new Date(last.at).getTime()
      if (gap >= 0 && gap < 15 * 60_000) {
        series[series.length - 1] = { date: day, price: u.price, at, source: 'auto' }
        map[key] = series.slice(-MAX_POINTS)
        continue
      }
    }
    if (last && last.date === day && !last.at && Math.abs(last.price - u.price) < 1e-9) {
      continue
    }
    series.push({ date: day, price: u.price, at, source: 'auto' })
    map[key] = series.slice(-MAX_POINTS)
  }
  return {
    ...data,
    extras: { ...data.extras, holdingHistory: map },
  }
}

/** Seed a minimal series for charting when no history yet. */
export function seedHoldingSeries(
  _kind: 'crypto' | 'equity',
  _symbol: string,
  currentPrice: number,
  costBasisUnit?: number,
): HoldingPricePoint[] {
  const today = new Date().toISOString().slice(0, 10)
  const points: HoldingPricePoint[] = []
  if (costBasisUnit && costBasisUnit > 0 && Math.abs(costBasisUnit - currentPrice) > 1e-9) {
    points.push({ date: today, price: costBasisUnit, source: 'manual' })
  }
  if (currentPrice > 0) {
    points.push({ date: today, price: currentPrice, at: new Date().toISOString(), source: 'auto' })
  }
  return points
}
