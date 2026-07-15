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

  it('keeps prior sparkline when live price has none', () => {
    const previous = new Map([
      [
        't_ada',
        q({
          symbol: 'ADA',
          kind: 'crypto',
          last: 0.12,
          changePct: 2.1,
          sparkline: [0.1, 0.11, 0.12, 0.115, 0.12],
          source: 'yahoo',
        }),
      ],
    ])
    const next = new Map([
      [
        't_ada',
        q({
          symbol: 'ADA',
          kind: 'crypto',
          last: 0.1217,
          changePct: 2.26,
          sparkline: [],
          source: 'coingecko',
        }),
      ],
    ])
    const merged = mergeMarketQuotes(previous, next)
    expect(merged.get('t_ada')?.last).toBe(0.1217)
    expect(merged.get('t_ada')?.sparkline.length).toBeGreaterThan(1)
    expect(merged.get('t_ada')?.changePct).toBe(2.26)
  })

  it('keeps prior FX change+spark when live is exchangerate spot-only', () => {
    const previous = new Map([
      [
        't_fx',
        q({
          symbol: 'GBP/USD',
          kind: 'fx',
          last: 1.33,
          changePct: 0.4,
          changeAbs: 0.005,
          sparkline: [1.32, 1.325, 1.33],
          source: 'yahoo',
          unit: 'USD',
        }),
      ],
    ])
    const next = new Map([
      [
        't_fx',
        q({
          symbol: 'GBP/USD',
          kind: 'fx',
          last: 1.34,
          changePct: 0,
          changeAbs: 0,
          sparkline: [],
          source: 'exchangerate-api',
          unit: 'USD',
        }),
      ],
    ])
    const merged = mergeMarketQuotes(previous, next)
    expect(merged.get('t_fx')?.last).toBe(1.34)
    expect(merged.get('t_fx')?.sparkline.length).toBeGreaterThan(1)
    expect(merged.get('t_fx')?.changePct).toBe(0.4)
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
