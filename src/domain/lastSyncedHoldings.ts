/** Apply last-good Markets quote cache to crypto/equity holdings. */

import type { PortfolioData } from './types'
import { listMarketTickers, loadMarketQuotesCache } from '../storage/marketsStore'
import { appendHoldingPrices } from './holdingHistory'

function normSym(s: string): string {
  return s.trim().toUpperCase().replace(/^\^/, '')
}

/**
 * Build a symbol → GBP last map from the Markets quote cache
 * (crypto + equity tickers only).
 */
export function lastSyncedHoldingPrices(): {
  crypto: Map<string, number>
  equities: Map<string, number>
  updatedAt: string | null
} {
  const quotes = loadMarketQuotesCache()
  const tickers = listMarketTickers()
  const crypto = new Map<string, number>()
  const equities = new Map<string, number>()
  let updatedAt: string | null = null

  for (const t of tickers) {
    if (t.kind !== 'crypto' && t.kind !== 'equity') continue
    const q = quotes.get(t.id)
    if (!q || !(q.last > 0)) continue
    const key = normSym(t.symbol)
    if (t.kind === 'crypto') crypto.set(key, q.last)
    else equities.set(key, q.last)
    if (!updatedAt || (q.updatedAt && q.updatedAt > updatedAt)) {
      updatedAt = q.updatedAt ?? updatedAt
    }
  }
  return { crypto, equities, updatedAt }
}

/**
 * Fill missing/zero holding prices from last-synced Markets quotes.
 * When `overwrite` is true, also replace positive prices that match a cache hit.
 */
export function applyLastSyncedQuotesToHoldings(
  data: PortfolioData,
  opts: { overwrite?: boolean } = {},
): { data: PortfolioData; crypto: number; equities: number } {
  const { crypto: cryptoMap, equities: equityMap } = lastSyncedHoldingPrices()
  const overwrite = Boolean(opts.overwrite)
  let cryptoN = 0
  let equitiesN = 0
  const now = new Date().toISOString()

  const crypto = data.crypto.map((c) => {
    const hit = cryptoMap.get(normSym(c.symbol))
    if (!(hit && hit > 0)) return c
    if (!overwrite && c.price > 0) return c
    if (c.price === hit) return c
    cryptoN++
    return { ...c, price: hit }
  })

  const equities = data.equities.map((e) => {
    const hit = equityMap.get(normSym(e.symbol))
    if (!(hit && hit > 0)) return e
    if (!overwrite && e.livePrice > 0) return e
    if (e.livePrice === hit) return e
    equitiesN++
    return { ...e, livePrice: hit }
  })

  if (cryptoN === 0 && equitiesN === 0) {
    return { data, crypto: 0, equities: 0 }
  }

  let next: PortfolioData = {
    ...data,
    crypto,
    equities,
    settings: { ...data.settings, lastPriceUpdate: now },
  }
  const holdingUpdates = [
    ...crypto
      .filter((c) => c.price > 0)
      .map((c) => ({ kind: 'crypto' as const, symbol: c.symbol, price: c.price })),
    ...equities
      .filter((e) => e.livePrice > 0)
      .map((e) => ({ kind: 'equity' as const, symbol: e.symbol, price: e.livePrice })),
  ]
  next = appendHoldingPrices(next, holdingUpdates, now)
  return { data: next, crypto: cryptoN, equities: equitiesN }
}
