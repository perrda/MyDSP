/** Budget vs actual monthly series for sparklines. */

import type { SpendingEntry } from './types'

export interface MonthSpendPoint {
  month: string // YYYY-MM
  spent: number
  limit: number
}

export function monthKeysLastN(n: number, now = new Date()): string[] {
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function categoryMonthlySeries(
  spending: SpendingEntry[],
  category: string,
  limit: number,
  months = 6,
  now = new Date(),
): MonthSpendPoint[] {
  const cat = category.toLowerCase()
  const keys = monthKeysLastN(months, now)
  const spent = new Map<string, number>()
  for (const s of spending) {
    const m = s.date.slice(0, 7)
    if (!keys.includes(m)) continue
    if (String(s.category).toLowerCase() !== cat) continue
    spent.set(m, (spent.get(m) ?? 0) + Math.abs(s.amount))
  }
  return keys.map((month) => ({
    month,
    spent: spent.get(month) ?? 0,
    limit,
  }))
}

export function worstBudgetOffenders(
  spending: SpendingEntry[],
  budgetGoals: Record<string, number>,
  now = new Date(),
): { category: string; spent: number; limit: number; ratio: number }[] {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const spent = new Map<string, number>()
  for (const s of spending) {
    if (!s.date.startsWith(ym)) continue
    const cat = String(s.category).toLowerCase()
    spent.set(cat, (spent.get(cat) ?? 0) + Math.abs(s.amount))
  }
  return Object.entries(budgetGoals)
    .map(([category, limit]) => {
      const s = spent.get(category.toLowerCase()) ?? 0
      return {
        category: category.toLowerCase(),
        spent: s,
        limit,
        ratio: limit > 0 ? s / limit : 0,
      }
    })
    .filter((r) => r.limit > 0)
    .sort((a, b) => b.ratio - a.ratio)
}
