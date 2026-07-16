/** Optional paper commodity positions rolled into net worth. */

import type { MarketQuote, MarketTicker } from './markets'

export function paperCommodityValue(
  tickers: Iterable<MarketTicker>,
  quotes: Map<string, MarketQuote>,
): { value: number; cost: number; count: number } {
  let value = 0
  let cost = 0
  let count = 0
  for (const t of tickers) {
    if (t.kind !== 'commodity') continue
    if (!t.includeInNetWorth) continue
    if (!(t.quantity != null && t.quantity > 0)) continue
    const q = quotes.get(t.id)
    if (!q || !(q.last > 0)) continue
    value += t.quantity * q.last
    if (t.avgCostGbp != null && t.avgCostGbp >= 0) {
      cost += t.quantity * t.avgCostGbp
    }
    count += 1
  }
  return { value, cost, count }
}
