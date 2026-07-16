/** Daily spend series per category for a selected YYYY-MM month. */

import type { SpendingEntry } from './types'

export interface CategorySparkRow {
  category: string
  total: number
  /** One value per calendar day in the month (0 when no spend). */
  daily: number[]
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return 30
  return new Date(y, m, 0).getDate()
}

/**
 * Top categories by spend in `ym`, each with a daily sparkline for that month.
 */
export function categorySparklinesForMonth(
  spending: SpendingEntry[] | undefined,
  ym: string,
  topN = 5,
): CategorySparkRow[] {
  if (!/^\d{4}-\d{2}$/.test(ym)) return []
  const nDays = daysInMonth(ym)
  const byCat = new Map<string, { total: number; daily: number[] }>()

  for (const s of spending ?? []) {
    const date = (s.date ?? '').slice(0, 10)
    if (!date.startsWith(ym)) continue
    const day = Number(date.slice(8, 10))
    if (!Number.isFinite(day) || day < 1 || day > nDays) continue
    const cat = String(s.category || 'other').toLowerCase()
    let row = byCat.get(cat)
    if (!row) {
      row = { total: 0, daily: Array.from({ length: nDays }, () => 0) }
      byCat.set(cat, row)
    }
    const amt = Math.abs(s.amount)
    row.total += amt
    row.daily[day - 1] = (row.daily[day - 1] ?? 0) + amt
  }

  return [...byCat.entries()]
    .map(([category, v]) => ({ category, total: v.total, daily: v.daily }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
}
