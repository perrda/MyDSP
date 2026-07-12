/** Ensure equity live prices are stored in GBP (US quotes converted once). */

import type { PortfolioData } from './types'
import { equityNeedsUsdToGbp } from './equityCurrency'
import { readHoldingHistory } from './holdingHistory'
import { type FxRates, usdToGbp } from '../services/fx'

/**
 * Convert equity livePrice values that were stored as raw USD quotes into GBP.
 * Does not touch avgCost (user/trade GBP cost basis).
 * Clears auto equity holdingHistory for USD tickers (rebuild from GBP static + refresh).
 * Idempotent via extras.equityPricesAreGbp.
 */
export function migrateEquityLivePricesToGbp(
  data: PortfolioData,
  rates: FxRates,
): { data: PortfolioData; migrated: boolean } {
  if (data.extras?.equityPricesAreGbp === true) {
    return { data, migrated: false }
  }

  const equities = data.equities.map((e) => {
    if (!equityNeedsUsdToGbp(e.symbol) || !(e.livePrice > 0)) return e
    return { ...e, livePrice: usdToGbp(e.livePrice, rates) }
  })

  const hist = readHoldingHistory(data)
  const nextHist = { ...hist }
  for (const key of Object.keys(nextHist)) {
    if (!key.startsWith('equity:')) continue
    const sym = key.slice('equity:'.length)
    if (!equityNeedsUsdToGbp(sym)) continue
    delete nextHist[key]
  }

  return {
    data: {
      ...data,
      equities,
      extras: {
        ...data.extras,
        holdingHistory: nextHist,
        equityPricesAreGbp: true,
      },
    },
    migrated: true,
  }
}
