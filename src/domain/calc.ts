import type {
  AssetTotals,
  LiabilityTotals,
  NetWorthBreakdown,
  PortfolioData,
} from './types'

function included<T extends { includeInPortfolio?: boolean }>(items: T[]): T[] {
  return items.filter((i) => i.includeInPortfolio !== false)
}

export function calcCrypto(data: PortfolioData): AssetTotals {
  let value = 0
  let cost = 0
  for (const c of included(data.crypto)) {
    value += c.qty * c.price
    cost += c.cost
  }
  const pnl = value - cost
  return { value, cost, pnl, pct: cost > 0 ? (pnl / cost) * 100 : 0 }
}

export function calcEquity(data: PortfolioData): AssetTotals {
  let value = 0
  let cost = 0
  for (const e of included(data.equities)) {
    const price = e.livePrice || e.avgCost
    value += e.shares * price
    cost += e.shares * e.avgCost
  }
  const pnl = value - cost
  return { value, cost, pnl, pct: cost > 0 ? (pnl / cost) * 100 : 0 }
}

export function calcLiabilities(data: PortfolioData): LiabilityTotals {
  const cc = included(data.creditCards).reduce((s, c) => s + c.balance, 0)
  const loans = included(data.loans).reduce((s, l) => s + l.balance, 0)
  const monthly =
    included(data.creditCards).reduce((s, c) => s + c.minPay, 0) +
    included(data.loans).reduce((s, l) => s + l.minPay, 0)
  return { cc, loans, total: cc + loans, monthly }
}

export function calcNetWorth(data: PortfolioData): number {
  return calcCrypto(data).value + calcEquity(data).value - calcLiabilities(data).total
}

export function calcTotalAssets(data: PortfolioData): number {
  return calcCrypto(data).value + calcEquity(data).value
}

export function calcBreakdown(data: PortfolioData): NetWorthBreakdown {
  const crypto = calcCrypto(data)
  const equity = calcEquity(data)
  const liability = calcLiabilities(data)
  const assets = crypto.value + equity.value
  return {
    netWorth: assets - liability.total,
    assets,
    liabilities: liability.total,
    crypto,
    equity,
    liability,
  }
}

/** Current value for a goal metric (FCC getGoalCurrent). */
export function goalCurrent(data: PortfolioData, metric: string): number {
  switch (metric) {
    case 'cc':
      return calcLiabilities(data).cc
    case 'debt':
      return calcLiabilities(data).total
    case 'networth':
      return calcNetWorth(data)
    case 'equity':
      return calcEquity(data).value
    case 'crypto':
      return calcCrypto(data).value
    default:
      return 0
  }
}

export function goalProgress(data: PortfolioData, goal: PortfolioData['goals'][number]): number {
  const current = goalCurrent(data, goal.metric)
  if (goal.metric === 'cc' || goal.metric === 'debt') {
    // Debt goals: target is usually 0 — progress = how much paid down from start
    const start = goal.startVal ?? current
    if (start <= 0) return current <= goal.target ? 100 : 0
    const paid = start - current
    const need = start - goal.target
    if (need <= 0) return 100
    return Math.max(0, Math.min(100, (paid / need) * 100))
  }
  if (goal.target <= 0) return 0
  return Math.max(0, Math.min(100, (current / goal.target) * 100))
}
