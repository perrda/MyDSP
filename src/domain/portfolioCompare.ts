/** Cross-portfolio snapshot for comparison views. */

import { calcBreakdownWithPaper } from './netWorthWithPaper'
import type { NetWorthBreakdown, PortfolioMeta } from './types'
import { listPortfolios, loadPortfolio } from '../storage/portfolioStore'

export interface PortfolioCompareRow {
  id: string
  name: string
  isPrimary: boolean
  currency: string
  taxResidency: string
  netWorth: number
  assets: number
  liabilities: number
  crypto: number
  equity: number
  pnl: number
  historyPoints: number
  journalTrades: number
}

export function buildPortfolioComparison(
  metas: PortfolioMeta[] = listPortfolios(),
): PortfolioCompareRow[] {
  return metas.map((meta) => {
    const data = loadPortfolio(meta.id)
    const b: NetWorthBreakdown = calcBreakdownWithPaper(data)
    return {
      id: meta.id,
      name: meta.name,
      isPrimary: meta.id === 'default',
      currency: data.settings.currency || 'GBP',
      taxResidency: data.settings.taxResidency || 'GB',
      netWorth: b.netWorth,
      assets: b.assets,
      liabilities: b.liabilities,
      crypto: b.crypto.value,
      equity: b.equity.value,
      pnl: b.crypto.pnl + b.equity.pnl,
      historyPoints: data.history.length,
      journalTrades: data.journal.filter((j) => {
        const t = j.type.toLowerCase()
        return t === 'buy' || t === 'sell'
      }).length,
    }
  })
}

export function comparisonTotals(rows: PortfolioCompareRow[]) {
  return rows.reduce(
    (acc, r) => ({
      netWorth: acc.netWorth + r.netWorth,
      assets: acc.assets + r.assets,
      liabilities: acc.liabilities + r.liabilities,
      crypto: acc.crypto + r.crypto,
      equity: acc.equity + r.equity,
    }),
    { netWorth: 0, assets: 0, liabilities: 0, crypto: 0, equity: 0 },
  )
}
