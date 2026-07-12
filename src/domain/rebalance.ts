/** Portfolio allocation & rebalance suggestions. */

import type { CryptoHolding, TargetAllocations } from './types'

const CASH_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'GBP', 'GBPT', 'EURC', 'PYUSD'])

export function getCashValue(crypto: CryptoHolding[]): number {
  return crypto
    .filter((c) => c.includeInPortfolio !== false)
    .filter((c) => CASH_SYMBOLS.has(c.symbol.toUpperCase()))
    .reduce((s, c) => s + c.qty * c.price, 0)
}

export function getInvestedCryptoValue(crypto: CryptoHolding[]): number {
  return crypto
    .filter((c) => c.includeInPortfolio !== false)
    .filter((c) => !CASH_SYMBOLS.has(c.symbol.toUpperCase()))
    .reduce((s, c) => s + c.qty * c.price, 0)
}

export interface AllocationBreakdown {
  equity: number
  crypto: number
  cash: number
  total: number
  equityPct: number
  cryptoPct: number
  cashPct: number
}

export function calcAllocation(
  equityValue: number,
  cryptoHoldings: CryptoHolding[],
): AllocationBreakdown {
  const cash = getCashValue(cryptoHoldings)
  const crypto = getInvestedCryptoValue(cryptoHoldings)
  const equity = Math.max(0, equityValue)
  const total = equity + crypto + cash
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  return {
    equity,
    crypto,
    cash,
    total,
    equityPct: pct(equity),
    cryptoPct: pct(crypto),
    cashPct: pct(cash),
  }
}

export function normalizeTargets(t: TargetAllocations): TargetAllocations {
  const sum = t.equity + t.crypto + t.cash
  if (sum <= 0) return { equity: 70, crypto: 25, cash: 5 }
  return {
    equity: (t.equity / sum) * 100,
    crypto: (t.crypto / sum) * 100,
    cash: (t.cash / sum) * 100,
  }
}

export interface RebalanceAction {
  bucket: 'equity' | 'crypto' | 'cash'
  type: 'buy' | 'sell'
  amount: number
  currentPct: number
  targetPct: number
  pctDiff: number
}

export function calcRebalanceActions(
  alloc: AllocationBreakdown,
  targets: TargetAllocations,
  minPctDiff = 1,
): RebalanceAction[] {
  const t = normalizeTargets(targets)
  const rows: { bucket: RebalanceAction['bucket']; current: number; target: number }[] = [
    { bucket: 'equity', current: alloc.equityPct, target: t.equity },
    { bucket: 'crypto', current: alloc.cryptoPct, target: t.crypto },
    { bucket: 'cash', current: alloc.cashPct, target: t.cash },
  ]
  return rows
    .map((r) => {
      const pctDiff = r.target - r.current
      const amount = (pctDiff / 100) * alloc.total
      return {
        bucket: r.bucket,
        type: (pctDiff >= 0 ? 'buy' : 'sell') as 'buy' | 'sell',
        amount: Math.abs(amount),
        currentPct: r.current,
        targetPct: r.target,
        pctDiff,
      }
    })
    .filter((a) => Math.abs(a.pctDiff) >= minPctDiff)
    .sort((a, b) => Math.abs(b.pctDiff) - Math.abs(a.pctDiff))
}

export function driftStatus(
  currentPct: number,
  targetPct: number,
  tolerance = 10,
): 'ok' | 'warning' | 'alert' {
  const d = Math.abs(currentPct - targetPct)
  if (d >= tolerance) return 'alert'
  if (d >= tolerance / 2) return 'warning'
  return 'ok'
}
