/** Simple projected goal date from monthly surplus (estimate). */

import type { Goal, GoalMetric, PortfolioData, SpendingEntry } from './types'
import { goalCurrent } from './calc'

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isDebtMetric(metric: GoalMetric): boolean {
  return metric === 'cc' || metric === 'debt'
}

/** Remaining amount to close the goal (pay down or grow to target). */
export function goalRemaining(goal: Goal, current: number): number {
  if (isDebtMetric(goal.metric)) {
    return Math.max(0, current - goal.target)
  }
  return Math.max(0, goal.target - current)
}

/**
 * Monthly surplus estimate:
 * 1) monthlyIncome − monthlyExpenses when income &gt; 0 and expenses set
 * 2) else monthlyIncome − avg monthly spend from spending entries (last ~3 months)
 * 3) null when income unavailable or surplus ≤ 0
 */
export function estimateMonthlySurplus(data: PortfolioData, now = new Date()): number | null {
  const income = data.monthlyIncome ?? 0
  if (!(income > 0)) return null

  let expenses = data.monthlyExpenses ?? 0
  if (!(expenses > 0)) {
    expenses = avgMonthlySpend(data.spending, now)
  }
  const surplus = income - expenses
  return surplus > 0 ? surplus : null
}

function avgMonthlySpend(spending: SpendingEntry[] | undefined, now = new Date()): number {
  const list = spending ?? []
  if (list.length === 0) return 0
  const months = new Map<string, number>()
  for (const s of list) {
    const ym = (s.date ?? '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(ym)) continue
    months.set(ym, (months.get(ym) ?? 0) + Math.abs(s.amount))
  }
  if (months.size === 0) return 0
  // Prefer last 3 calendar months including current
  const keys: string[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const used = keys.filter((k) => months.has(k))
  if (used.length === 0) {
    const vals = [...months.values()]
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }
  return used.reduce((s, k) => s + (months.get(k) ?? 0), 0) / used.length
}

export interface GoalProjection {
  goal: Goal
  remaining: number
  monthlySurplus: number
  months: number
  projectedDate: string
}

export function projectGoalDate(
  goal: Goal,
  current: number,
  monthlySurplus: number,
  now = new Date(),
): GoalProjection | null {
  if (!(monthlySurplus > 0)) return null
  const remaining = goalRemaining(goal, current)
  if (remaining <= 0) return null
  const months = remaining / monthlySurplus
  if (!Number.isFinite(months) || months > 600) return null
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setMonth(d.getMonth() + Math.ceil(months))
  return {
    goal,
    remaining,
    monthlySurplus,
    months,
    projectedDate: ymdLocal(d),
  }
}

/** Nearest incomplete goal by remaining / surplus (soonest projected date). */
export function nearestGoalProjection(
  data: PortfolioData,
  now = new Date(),
): GoalProjection | null {
  const surplus = estimateMonthlySurplus(data, now)
  if (surplus == null) return null
  let best: GoalProjection | null = null
  for (const g of data.goals ?? []) {
    const current = goalCurrent(data, g.metric)
    const proj = projectGoalDate(g, current, surplus, now)
    if (!proj) continue
    if (!best || proj.projectedDate < best.projectedDate) best = proj
  }
  return best
}

export function formatGoalProjectionLine(
  proj: GoalProjection,
  formatDate: (d: string) => string,
): string {
  const m = proj.months < 1 ? '<1' : String(Math.ceil(proj.months))
  return `Est. ${formatDate(proj.projectedDate)} if surplus holds (~${m} mo)`
}
