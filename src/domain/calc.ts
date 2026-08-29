import type {
  AssetTotals,
  CryptoHolding,
  LiabilityTotals,
  NetWorthBreakdown,
  PortfolioData,
} from './types'

function included<T extends { includeInPortfolio?: boolean }>(items: T[]): T[] {
  return items.filter((i) => i.includeInPortfolio !== false)
}

/** Stables / cash-like crypto used for emergency-fund and allocation cash. */
export const CASH_CRYPTO_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'GBP',
  'GBPT',
  'EURC',
  'PYUSD',
])

export function isCashCryptoSymbol(symbol: string): boolean {
  return CASH_CRYPTO_SYMBOLS.has(symbol.trim().toUpperCase())
}

/** Symbols treated as “owned” for News / YouTube / Markets screener. */
export function ownedHoldingSymbols(data: Pick<PortfolioData, 'crypto' | 'equities'>): string[] {
  const out: string[] = []
  for (const e of included(data.equities)) {
    const s = e.symbol.trim().toUpperCase()
    if (s) out.push(s)
  }
  for (const c of included(data.crypto)) {
    const s = c.symbol.trim().toUpperCase()
    if (s) out.push(s)
  }
  return out
}

/** Live quote only — cost/qty is a display mark, not a live print. */
export function hasLiveCryptoQuote(c: Pick<CryptoHolding, 'price'>): boolean {
  return c.price > 0
}

export function hasLiveEquityQuote(e: { livePrice?: number }): boolean {
  return (e.livePrice ?? 0) > 0
}

/**
 * Display mark for a crypto line (live, else cost/qty).
 * Net worth / mix / drift use live quotes only — see `hasLiveCryptoQuote`.
 */
export function cryptoMarkPrice(c: Pick<CryptoHolding, 'qty' | 'price' | 'cost'>): number {
  if (c.price > 0) return c.price
  if (c.qty > 0 && c.cost > 0) return c.cost / c.qty
  return 0
}

/**
 * Do not write cost into `price`. That would fake a live quote and pull
 * unpriced lines back into NW / mix / drift.
 */
export function applyCryptoCostFallback(data: PortfolioData): PortfolioData {
  return data
}

/** Included + unpriced (no live quote). Named so the UI can say the exclusion. */
export function listUnpricedHoldings(data: PortfolioData): Array<{
  kind: 'crypto' | 'equity'
  id: number
  symbol: string
  name: string
}> {
  const out: Array<{ kind: 'crypto' | 'equity'; id: number; symbol: string; name: string }> = []
  for (const c of included(data.crypto)) {
    if (hasLiveCryptoQuote(c)) continue
    if (!(c.qty > 0)) continue
    out.push({ kind: 'crypto', id: c.id, symbol: c.symbol, name: c.name })
  }
  for (const e of included(data.equities)) {
    if (hasLiveEquityQuote(e)) continue
    if (!(e.shares > 0)) continue
    out.push({ kind: 'equity', id: e.id, symbol: e.symbol, name: e.name })
  }
  return out
}

export function unpricedExclusionCopy(count: number): string | null {
  if (!(count > 0)) return null
  return `${count} holding${count === 1 ? '' : 's'} unpriced — excluded from net worth, mix, drift, and Buy/Sell`
}

export function isEmergencyFundGoal(goal: { name?: string }): boolean {
  return /^emergency fund$/i.test((goal.name ?? '').trim())
}

export function calcCrypto(data: PortfolioData): AssetTotals {
  let value = 0
  let cost = 0
  for (const c of included(data.crypto)) {
    if (hasLiveCryptoQuote(c)) value += c.qty * c.price
    cost += c.cost
  }
  const pnl = value - cost
  return { value, cost, pnl, pct: cost > 0 ? (pnl / cost) * 100 : 0 }
}

export function calcCash(data: PortfolioData): number {
  let value = 0
  for (const c of included(data.crypto)) {
    if (!isCashCryptoSymbol(c.symbol)) continue
    value += c.qty * cryptoMarkPrice(c)
  }
  return value
}

export function calcEquity(data: PortfolioData): AssetTotals {
  let value = 0
  let cost = 0
  for (const e of included(data.equities)) {
    if (hasLiveEquityQuote(e)) value += e.shares * e.livePrice
    cost += e.shares * e.avgCost
  }
  const pnl = value - cost
  return { value, cost, pnl, pct: cost > 0 ? (pnl / cost) * 100 : 0 }
}

/** One debt balance — cards + loans (included book). */
export function calcDebtBalance(data: PortfolioData): number {
  return calcLiabilities(data).total
}

/** Descending pay-down: paid / (start − target). */
export function debtPaydownProgress(start: number, current: number, target: number): number {
  if (start <= 0) return current <= target ? 100 : 0
  const paid = start - current
  const need = start - target
  if (need <= 0) return 100
  return Math.max(0, Math.min(100, (paid / need) * 100))
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
export function goalCurrent(
  data: PortfolioData,
  metric: string,
  goal?: { name?: string },
): number {
  const resolved =
    goal && isEmergencyFundGoal(goal) ? 'cash' : metric
  switch (resolved) {
    case 'cc':
      return calcLiabilities(data).cc
    case 'debt':
      return calcDebtBalance(data)
    case 'networth':
      return calcNetWorth(data)
    case 'equity':
      return calcEquity(data).value
    case 'crypto':
      return calcCrypto(data).value
    case 'cash':
      return calcCash(data)
    default:
      return 0
  }
}

export function goalProgress(data: PortfolioData, goal: PortfolioData['goals'][number]): number {
  const current = goalCurrent(data, goal.metric, goal)
  if (goal.metric === 'cc' || goal.metric === 'debt') {
    const start = goal.startVal ?? current
    return debtPaydownProgress(start, current, goal.target)
  }
  if (goal.target <= 0) return 0
  return Math.max(0, Math.min(100, (current / goal.target) * 100))
}
