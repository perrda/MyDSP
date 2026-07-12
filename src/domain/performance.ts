/** Time-weighted / money-weighted performance from journal + history. */

import type { HistoryPoint, JournalEntry, PortfolioData } from './types'
import { isTradeType } from './trades'
import { filterByRange, type ChartRange } from './history'

export interface PerformanceSummary {
  netChange: number
  simplePct: number
  approxMwrPct: number
  /** True time-weighted return (%) with sub-period breakpoints at trade dates. */
  twrPct: number
  subPeriods: number
  netContributions: number
  startNw: number
  endNw: number
}

function tradeCashflow(j: JournalEntry): number {
  const fees = j.fees || 0
  const notional = j.qty * j.price
  if (j.type.toLowerCase() === 'buy') return notional + fees
  if (j.type.toLowerCase() === 'sell') return -(Math.max(0, notional - fees))
  return 0
}

function nwOnOrBefore(hist: HistoryPoint[], date: string): number | null {
  let best: HistoryPoint | null = null
  for (const h of hist) {
    if (h.date > date) break
    best = h
  }
  return best ? best.netWorth : null
}

/**
 * True TWR: product of (1+r_i) − 1 where sub-periods break at external cashflow dates.
 * r_i = (V_end − CF) / V_start − 1, with CF = net contributions on the end date.
 */
export function timeWeightedReturn(
  history: HistoryPoint[],
  journal: JournalEntry[],
  range: ChartRange = 'ALL',
): { twrPct: number; subPeriods: number } | null {
  const hist = filterByRange(history, range)
  if (hist.length < 2) return null
  const startDate = hist[0].date
  const endDate = hist[hist.length - 1].date

  const flowDates = new Set<string>()
  for (const j of journal) {
    if (!isTradeType(j.type)) continue
    const d = j.date.slice(0, 10)
    if (d > startDate && d <= endDate) flowDates.add(d)
  }

  const breakpoints = [
    startDate,
    ...[...flowDates].sort((a, b) => a.localeCompare(b)),
    endDate,
  ].filter((d, i, arr) => i === 0 || d !== arr[i - 1])

  if (breakpoints.length < 2) {
    const start = hist[0].netWorth
    const end = hist[hist.length - 1].netWorth
    if (start === 0) return { twrPct: 0, subPeriods: 0 }
    return { twrPct: ((end - start) / Math.abs(start)) * 100, subPeriods: 1 }
  }

  let product = 1
  let periods = 0
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const t0 = breakpoints[i]
    const t1 = breakpoints[i + 1]
    const vStart = nwOnOrBefore(hist, t0)
    const vEnd = nwOnOrBefore(hist, t1)
    if (vStart == null || vEnd == null || vStart === 0) continue
    const cf = journal
      .filter((j) => isTradeType(j.type) && j.date.slice(0, 10) === t1)
      .reduce((s, j) => s + tradeCashflow(j), 0)
    const r = (vEnd - cf) / vStart - 1
    if (!Number.isFinite(r)) continue
    product *= 1 + r
    periods += 1
  }
  if (periods === 0) return null
  return { twrPct: (product - 1) * 100, subPeriods: periods }
}

export function performanceSummary(
  history: HistoryPoint[],
  journal: JournalEntry[],
  range: ChartRange = 'ALL',
): PerformanceSummary | null {
  const hist = filterByRange(history, range)
  if (hist.length < 2) return null
  const startNw = hist[0].netWorth
  const endNw = hist[hist.length - 1].netWorth
  const startDate = hist[0].date
  const endDate = hist[hist.length - 1].date

  const flows = journal
    .filter((j) => isTradeType(j.type))
    .filter((j) => j.date >= startDate && j.date <= endDate)
    .map((j) => ({ date: j.date, amount: tradeCashflow(j) }))

  const netContributions = flows.reduce((s, f) => s + f.amount, 0)
  const netChange = endNw - startNw
  const simplePct = startNw !== 0 ? (netChange / Math.abs(startNw)) * 100 : 0

  const startMs = new Date(startDate).getTime()
  const endMs = new Date(endDate).getTime()
  const span = Math.max(1, endMs - startMs)
  let weighted = 0
  for (const f of flows) {
    const w = (endMs - new Date(f.date).getTime()) / span
    weighted += f.amount * w
  }
  const denom = startNw + weighted
  const gain = endNw - startNw - netContributions
  const approxMwrPct = denom !== 0 ? (gain / Math.abs(denom)) * 100 : 0

  const twr = timeWeightedReturn(history, journal, range)

  return {
    netChange,
    simplePct,
    approxMwrPct,
    twrPct: twr?.twrPct ?? simplePct,
    subPeriods: twr?.subPeriods ?? 0,
    netContributions,
    startNw,
    endNw,
  }
}

export function holdingCostBasisFromJournal(
  data: PortfolioData,
  symbol: string,
): { qty: number; cost: number; avgCost: number } {
  const s = symbol.toUpperCase()
  const crypto = data.crypto.find((c) => c.symbol.toUpperCase() === s)
  if (crypto) {
    return {
      qty: crypto.qty,
      cost: crypto.cost,
      avgCost: crypto.qty > 0 ? crypto.cost / crypto.qty : 0,
    }
  }
  const eq = data.equities.find((e) => e.symbol.toUpperCase() === s)
  if (eq) {
    return {
      qty: eq.shares,
      cost: eq.shares * eq.avgCost,
      avgCost: eq.avgCost,
    }
  }
  return { qty: 0, cost: 0, avgCost: 0 }
}
