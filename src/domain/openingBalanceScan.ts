/** Scan one or all portfolios for holdings that need an opening buy. */

import type { PortfolioData, PortfolioMeta } from './types'
import { needsOpeningBalance, openingBalanceDraft, type TradeInput, type TradeKind } from './trades'
import { listPortfolios, loadPortfolio } from '../storage/portfolioStore'

export interface OpeningBalanceItem {
  portfolioId: string
  portfolioName: string
  kind: TradeKind
  symbol: string
  name: string
  draft: TradeInput
}

export function scanPortfolioOpeningBalances(
  meta: PortfolioMeta,
  data: PortfolioData,
): OpeningBalanceItem[] {
  const out: OpeningBalanceItem[] = []
  for (const c of data.crypto) {
    if (!needsOpeningBalance(data, c.symbol, 'crypto')) continue
    const draft = openingBalanceDraft(data, c.symbol, 'crypto')
    if (!draft) continue
    out.push({
      portfolioId: meta.id,
      portfolioName: meta.name,
      kind: 'crypto',
      symbol: c.symbol,
      name: c.name,
      draft,
    })
  }
  for (const e of data.equities) {
    if (!needsOpeningBalance(data, e.symbol, 'equity')) continue
    const draft = openingBalanceDraft(data, e.symbol, 'equity')
    if (!draft) continue
    out.push({
      portfolioId: meta.id,
      portfolioName: meta.name,
      kind: 'equity',
      symbol: e.symbol,
      name: e.name,
      draft,
    })
  }
  return out
}

export function scanAllOpeningBalances(): OpeningBalanceItem[] {
  const items: OpeningBalanceItem[] = []
  for (const meta of listPortfolios()) {
    items.push(...scanPortfolioOpeningBalances(meta, loadPortfolio(meta.id)))
  }
  return items
}
