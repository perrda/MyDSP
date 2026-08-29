import { describe, expect, it } from 'vitest'
import type { MarketQuote, MarketTicker } from '../domain/markets'
import {
  finiteChangePct,
  sectionGroupChangeLabel,
  sectionTotals,
} from '../domain/marketsSectionTotals'
import { formatPct } from '../utils/format'

function ticker(id: string, symbol: string, kind: MarketTicker['kind'] = 'crypto'): MarketTicker {
  return {
    id,
    kind,
    symbol,
    name: symbol,
    createdAt: '2026-08-01T00:00:00.000Z',
    sortOrder: 0,
  }
}

function quote(partial: Partial<MarketQuote> & Pick<MarketQuote, 'symbol'>): MarketQuote {
  return {
    kind: 'crypto',
    last: 0,
    changeAbs: 0,
    changePct: 0,
    sparkline: [],
    unit: 'GBP',
    decimals: 2,
    source: 'cache',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

const btc = ticker('t_btc', 'BTC')
const eth = ticker('t_eth', 'ETH')

describe('markets section group change — no fake 0.00%', () => {
  it('2 tickers with no quotes → Unpriced', () => {
    const totals = sectionTotals([btc, eth], new Map(), new Map())
    expect(totals.changePct).toBeNull()
    expect(totals.avgPct).toBeNull()
    expect(sectionGroupChangeLabel(totals, 2, false, formatPct)).toBe('Unpriced')
  })

  it('empty section → —', () => {
    const totals = sectionTotals([], new Map(), new Map())
    expect(sectionGroupChangeLabel(totals, 0, false, formatPct)).toBe('—')
  })

  it('cached / portfolio coalesced 0 is not a print', () => {
    const quotes = new Map<string, MarketQuote>([
      ['t_btc', quote({ symbol: 'BTC', last: 80000, changePct: 0, changeAbs: 0, source: 'portfolio' })],
      ['t_eth', quote({ symbol: 'ETH', last: 3000, changePct: 0, changeAbs: 0, source: 'cache' })],
    ])
    expect(finiteChangePct(quotes.get('t_btc'))).toBeNull()
    expect(finiteChangePct(quotes.get('t_eth'))).toBeNull()
    const totals = sectionTotals([btc, eth], quotes, new Map())
    expect(totals.avgPct).toBeNull()
    expect(totals.changePct).toBeNull()
    expect(sectionGroupChangeLabel(totals, 2, false, formatPct)).toBe('Unpriced')
    expect(sectionGroupChangeLabel(totals, 2, false, formatPct)).not.toMatch(/0\.00%/)
  })

  it('stale last-good 0 is Unpriced; live yahoo 0.00% stays a real flat', () => {
    const stale = quote({
      symbol: 'BTC',
      last: 80000,
      changePct: 0,
      source: 'stale:yahoo',
    })
    const liveFlat = quote({
      symbol: 'ETH',
      last: 3000,
      changePct: 0,
      source: 'yahoo',
    })
    expect(finiteChangePct(stale)).toBeNull()
    expect(finiteChangePct(liveFlat)).toBe(0)
    const unpriced = sectionTotals([btc], new Map([['t_btc', stale]]), new Map())
    expect(sectionGroupChangeLabel(unpriced, 1, false, formatPct)).toBe('Unpriced')
    const flat = sectionTotals([eth], new Map([['t_eth', liveFlat]]), new Map())
    expect(sectionGroupChangeLabel(flat, 1, false, formatPct)).toBe('0.00%')
  })

  it('live session % still prints', () => {
    const quotes = new Map<string, MarketQuote>([
      ['t_btc', quote({ symbol: 'BTC', last: 80000, changePct: 2.1, changeAbs: 1600, source: 'coingecko' })],
      ['t_eth', quote({ symbol: 'ETH', last: 3000, changePct: -1.5, changeAbs: -45, source: 'yahoo' })],
    ])
    const totals = sectionTotals([btc, eth], quotes, new Map())
    expect(totals.avgPct).toBeCloseTo(0.3, 5)
    expect(sectionGroupChangeLabel(totals, 2, false, formatPct)).toBe('+0.30%')
  })

  it('holdings with missing change do not invent a weighted 0.00%', () => {
    const quotes = new Map<string, MarketQuote>([
      ['t_btc', quote({ symbol: 'BTC', last: 80000, changePct: 0, source: 'portfolio' })],
      ['t_eth', quote({ symbol: 'ETH', last: 3000, changePct: 0, source: 'stale:coingecko' })],
    ])
    const holdings = new Map([
      ['BTC', 4000],
      ['ETH', 1500],
    ])
    const totals = sectionTotals([btc, eth], quotes, holdings)
    expect(totals.matched).toBe(2)
    expect(totals.changePct).toBeNull()
    expect(sectionGroupChangeLabel(totals, 2, false, formatPct)).toBe('Unpriced')
  })
})
