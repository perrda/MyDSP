/** Add portfolio holdings that are missing from the Markets watchlist. */

import { addMarketTicker, listMarketTickers } from '../storage/marketsStore'
import { normalizeMarketSymbol } from './markets'

export type HoldingSymbol = { symbol: string; name: string }

export function holdingsMissingFromWatchlist(
  holdings: HoldingSymbol[],
  kind: 'equity' | 'crypto',
): HoldingSymbol[] {
  const watched = new Set(
    listMarketTickers(kind).map((t) => normalizeMarketSymbol(t.symbol)),
  )
  const out: HoldingSymbol[] = []
  const seen = new Set<string>()
  for (const h of holdings) {
    const sym = normalizeMarketSymbol(h.symbol)
    if (!sym || watched.has(sym) || seen.has(sym)) continue
    seen.add(sym)
    out.push({ symbol: sym, name: h.name.trim() || sym })
  }
  return out
}

export function addHoldingsMissingFromWatchlist(
  holdings: HoldingSymbol[],
  kind: 'equity' | 'crypto',
): { added: string[]; skipped: string[]; errors: string[] } {
  const missing = holdingsMissingFromWatchlist(holdings, kind)
  const added: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  for (const h of missing) {
    try {
      addMarketTicker({ kind, symbol: h.symbol, name: h.name })
      added.push(h.symbol)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add'
      if (/already/i.test(msg)) skipped.push(h.symbol)
      else errors.push(`${h.symbol}: ${msg}`)
    }
  }
  return { added, skipped, errors }
}
