import { describe, it, expect } from 'vitest'
import type { MarketQuote } from './markets'
import {
  mergeMarketQuotes,
  quotesMapToRecord,
  quotesRecordToMap,
} from './marketQuotesCache'

function q(partial: Partial<MarketQuote> & Pick<MarketQuote, 'symbol' | 'kind' | 'last'>): MarketQuote {
  return {
    changeAbs: 0,
    changePct: 0,
    sparkline: [],
    unit: 'GBP',
    decimals: 2,
    source: 'coingecko',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...partial,
  }
}

describe('mergeMarketQuotes', () => {
  it('keeps last-good price when the live refresh returns zero', () => {
    const previous = new Map([['t_btc', q({ symbol: 'BTC', kind: 'crypto', last: 50000, changePct: 1 })]])
    const next = new Map([['t_btc', q({ symbol: 'BTC', kind: 'crypto', last: 0, source: 'none' })]])
    const merged = mergeMarketQuotes(previous, next)
    expect(merged.get('t_btc')?.last).toBe(50000)
    expect(merged.get('t_btc')?.source).toBe('stale:coingecko')
  })

  it('prefers a fresh live quote over cache', () => {
    const previous = new Map([['t_btc', q({ symbol: 'BTC', kind: 'crypto', last: 50000 })]])
    const next = new Map([['t_btc', q({ symbol: 'BTC', kind: 'crypto', last: 51000, source: 'yahoo' })]])
    const merged = mergeMarketQuotes(previous, next)
    expect(merged.get('t_btc')?.last).toBe(51000)
    expect(merged.get('t_btc')?.source).toBe('yahoo')
  })

  it('round-trips cache serialization without zeros', () => {
    const map = new Map([
      ['t_btc', q({ symbol: 'BTC', kind: 'crypto', last: 50000 })],
      ['t_bad', q({ symbol: 'X', kind: 'crypto', last: 0 })],
    ])
    const round = quotesRecordToMap(quotesMapToRecord(map))
    expect(round.size).toBe(1)
    expect(round.get('t_btc')?.last).toBe(50000)
  })
})
