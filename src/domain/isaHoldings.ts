/** Derive ISA allowance used from holdings whose platform mentions ISA. */

import type { CryptoHolding, EquityHolding, PortfolioData } from './types'

export const ISA_ALLOWANCE_GBP = 20_000

export function isIsaPlatform(platform: string | undefined): boolean {
  if (!platform) return false
  return /\bisa\b/i.test(platform.trim())
}

/** Market value of a holding included in the portfolio. */
function equityValue(e: EquityHolding): number {
  if (e.includeInPortfolio === false) return 0
  const px = e.livePrice > 0 ? e.livePrice : e.avgCost
  return Math.max(0, e.shares * px)
}

function cryptoValue(c: CryptoHolding): number {
  if (c.includeInPortfolio === false) return 0
  const px = c.price > 0 ? c.price : c.cost
  return Math.max(0, c.qty * px)
}

/**
 * Sum of ISA-tagged holding market values (platform contains "ISA").
 * Used as a proxy for ISA allowance used this tax year (not contributions).
 */
export function isaUsedFromHoldings(data: PortfolioData): {
  used: number
  remaining: number
  holdingCount: number
  symbols: string[]
} {
  const symbols: string[] = []
  let used = 0
  for (const e of data.equities ?? []) {
    if (!isIsaPlatform(e.platform)) continue
    used += equityValue(e)
    symbols.push(e.symbol)
  }
  for (const c of data.crypto ?? []) {
    if (!isIsaPlatform(c.platform)) continue
    used += cryptoValue(c)
    symbols.push(c.symbol)
  }
  used = Math.min(ISA_ALLOWANCE_GBP, Math.max(0, used))
  return {
    used,
    remaining: Math.max(0, ISA_ALLOWANCE_GBP - used),
    holdingCount: symbols.length,
    symbols,
  }
}
