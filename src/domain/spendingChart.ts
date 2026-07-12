/** Aggregate spending into chart series for ChartRange toolbar. */

import { filterByRange, type ChartRange } from './history'
import type { SpendingEntry } from './types'

export interface DailySpendPoint {
  date: string
  total: number
  [category: string]: string | number
}

export function buildDailySpendSeries(
  spending: SpendingEntry[],
  range: ChartRange,
  topN = 5,
): { points: DailySpendPoint[]; categories: string[]; totalInRange: number } {
  const inRange = filterByRange(
    spending.map((s) => ({ ...s, date: s.date.slice(0, 10) })),
    range,
  )
  const catTotals = new Map<string, number>()
  for (const s of inRange) {
    const cat = String(s.category || 'other').toLowerCase()
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + Math.abs(s.amount))
  }
  const categories = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([c]) => c)

  const byDay = new Map<string, DailySpendPoint>()
  let totalInRange = 0
  for (const s of inRange) {
    const day = s.date.slice(0, 10)
    const amt = Math.abs(s.amount)
    totalInRange += amt
    const row =
      byDay.get(day) ??
      ({
        date: day,
        total: 0,
        ...Object.fromEntries(categories.map((c) => [c, 0])),
        other: 0,
      } as DailySpendPoint)
    row.total = Number(row.total) + amt
    const cat = String(s.category || 'other').toLowerCase()
    if (categories.includes(cat)) {
      row[cat] = Number(row[cat] ?? 0) + amt
    } else {
      row.other = Number(row.other ?? 0) + amt
    }
    byDay.set(day, row)
  }

  const points = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  // Running cumulative for burn chart
  let run = 0
  const cumulative = points.map((p) => {
    run += Number(p.total)
    return { ...p, cumulative: run }
  })

  return {
    points: cumulative as DailySpendPoint[],
    categories: [...categories, ...(catTotals.size > topN ? ['other'] : [])],
    totalInRange,
  }
}
