/** Net-worth helpers that fold optional paper commodity MV into portfolio breakdown. */

import { calcBreakdown } from './calc'
import { paperCommodityValue } from './paperCommodities'
import type { NetWorthBreakdown, PortfolioData } from './types'
import { listMarketTickers, loadMarketQuotesCache } from '../storage/marketsStore'

/** Portfolio breakdown plus Markets paper commodities marked includeInNetWorth. */
export function calcBreakdownWithPaper(data: PortfolioData): NetWorthBreakdown {
  const base = calcBreakdown(data)
  const paper = paperCommodityValue(listMarketTickers(), loadMarketQuotesCache())
  if (paper.value <= 0) return base
  return {
    ...base,
    assets: base.assets + paper.value,
    netWorth: base.netWorth + paper.value,
  }
}
