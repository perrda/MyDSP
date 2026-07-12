/** Achievement definitions + evaluation (FCC-style, computed). */

import type { Goal, NetWorthBreakdown, PortfolioData } from './types'
import { getCashValue } from './rebalance'

export interface AchievementContext {
  data: PortfolioData
  breakdown: NetWorthBreakdown
  goalProgress: (goal: Goal) => number
}

export interface AchievementDef {
  id: string
  name: string
  desc: string
  icon: string
  xp: number
  category: 'networth' | 'debt' | 'goals' | 'habits' | 'portfolio'
  check: (ctx: AchievementContext) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_snapshot',
    name: 'Time traveller',
    desc: 'Record your first net worth snapshot',
    icon: '⏱',
    xp: 50,
    category: 'habits',
    check: (c) => c.data.history.length >= 1,
  },
  {
    id: 'week_streak',
    name: 'Week streak',
    desc: 'Have at least 7 history points',
    icon: '🔥',
    xp: 100,
    category: 'habits',
    check: (c) => c.data.history.length >= 7,
  },
  {
    id: 'month_streak',
    name: 'Month of data',
    desc: 'Have at least 30 history points',
    icon: '📅',
    xp: 250,
    category: 'habits',
    check: (c) => c.data.history.length >= 30,
  },
  {
    id: 'net_worth_100k',
    name: 'Six figures',
    desc: 'Reach £100k net worth',
    icon: '£',
    xp: 200,
    category: 'networth',
    check: (c) => c.breakdown.netWorth >= 100_000,
  },
  {
    id: 'net_worth_500k',
    name: 'Half million',
    desc: 'Reach £500k net worth',
    icon: '◆',
    xp: 400,
    category: 'networth',
    check: (c) => c.breakdown.netWorth >= 500_000,
  },
  {
    id: 'net_worth_1m',
    name: 'Millionaire',
    desc: 'Reach £1M net worth',
    icon: '★',
    xp: 800,
    category: 'networth',
    check: (c) => c.breakdown.netWorth >= 1_000_000,
  },
  {
    id: 'debt_free',
    name: 'Debt free',
    desc: 'Bring liabilities to zero',
    icon: '✓',
    xp: 500,
    category: 'debt',
    check: (c) => c.breakdown.liabilities <= 0,
  },
  {
    id: 'debt_under_50k',
    name: 'Debt crusher',
    desc: 'Get total debt under £50k',
    icon: '↓',
    xp: 200,
    category: 'debt',
    check: (c) => c.breakdown.liabilities > 0 && c.breakdown.liabilities < 50_000,
  },
  {
    id: 'first_goal',
    name: 'Goal getter',
    desc: 'Complete any goal (100%)',
    icon: '◎',
    xp: 150,
    category: 'goals',
    check: (c) => c.data.goals.some((g) => c.goalProgress(g) >= 100),
  },
  {
    id: 'diversified',
    name: 'Diversified',
    desc: 'Hold both crypto and equities',
    icon: '⬡',
    xp: 100,
    category: 'portfolio',
    check: (c) => c.breakdown.crypto.value > 0 && c.breakdown.equity.value > 0,
  },
  {
    id: 'cash_buffer',
    name: 'Cash cushion',
    desc: 'Hold at least £5k in stables/cash',
    icon: '◇',
    xp: 120,
    category: 'portfolio',
    check: (c) => getCashValue(c.data.crypto) >= 5000,
  },
  {
    id: 'journal_10',
    name: 'Ledger keeper',
    desc: 'Log 10 journal entries',
    icon: '☰',
    xp: 80,
    category: 'habits',
    check: (c) => c.data.journal.length >= 10,
  },
]

export interface AchievementEval {
  unlocked: AchievementDef[]
  locked: AchievementDef[]
  xp: number
  level: number
  levelProgress: number
  score: number
}

export function calcFinancialScore(ctx: AchievementContext): number {
  let score = 500
  const nw = ctx.breakdown.netWorth
  if (nw >= 1_000_000) score += 200
  else if (nw >= 500_000) score += 120
  else if (nw >= 100_000) score += 60
  else if (nw >= 0) score += 20

  const assets = ctx.breakdown.assets
  const debtRatio = assets > 0 ? ctx.breakdown.liabilities / assets : 1
  if (debtRatio <= 0) score += 150
  else if (debtRatio < 0.1) score += 100
  else if (debtRatio < 0.3) score += 50
  else if (debtRatio > 0.6) score -= 80

  if (ctx.breakdown.crypto.value > 0 && ctx.breakdown.equity.value > 0) score += 40
  if (ctx.data.history.length >= 30) score += 40
  else if (ctx.data.history.length >= 7) score += 20

  return Math.max(0, Math.min(1000, Math.round(score)))
}

export function evaluateAchievements(ctx: AchievementContext): AchievementEval {
  const unlocked = ACHIEVEMENTS.filter((a) => {
    try {
      return a.check(ctx)
    } catch {
      return false
    }
  })
  const locked = ACHIEVEMENTS.filter((a) => !unlocked.includes(a))
  const xp = unlocked.reduce((s, a) => s + a.xp, 0) + ctx.data.history.length * 10
  const level = Math.floor(xp / 1000) + 1
  const levelProgress = ((xp % 1000) / 1000) * 100
  return {
    unlocked,
    locked,
    xp,
    level,
    levelProgress,
    score: calcFinancialScore(ctx),
  }
}
