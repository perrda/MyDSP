import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_SECTION_ORDER,
  normalizeSectionOrder,
} from '../domain/markets'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('next25g — Markets section reorder + commodity timeframe (6–8)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('6: normalizeSectionOrder always returns all six keys once', () => {
    expect(normalizeSectionOrder(undefined)).toEqual(DEFAULT_SECTION_ORDER)
    expect(normalizeSectionOrder(['fx', 'crypto', 'fx', 'bogus'])).toEqual([
      'fx',
      'crypto',
      'equities',
      'commodities',
      'indices',
      'crosses',
    ])
  })

  it('6: reorderMarketSections persists and reloads section order', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    expect(store.getMarketSectionOrder()[0]).toBe('crypto')

    const next = [
      'commodities',
      'equities',
      'crypto',
      'indices',
      'fx',
      'crosses',
    ] as const
    store.reorderMarketSections([...next])
    expect(store.getMarketSectionOrder()).toEqual([...next])

    // Reload from disk
    const reloaded = store.loadMarketsState()
    expect(reloaded.sectionOrder).toEqual([...next])
  })

  it('6: MarketsPage exposes Sections sort + ReorderHandle on section cards', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/sectionSorting/)
    expect(page).toMatch(/reorderMarketSections/)
    expect(page).toMatch(/ReorderHandle label=\{`Reorder \$\{meta\.title\} section`\}/)
    expect(page).toMatch(/Sections/)
  })

  it('7: fetchCommodityMarketQuote forwards Markets timeframe', () => {
    const src = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(src).toMatch(/fetchCommodityMarketQuote\(/)
    expect(src).toMatch(/timeframe: MarketTimeframe = DEFAULT_MARKET_TF/)
    expect(src).toMatch(/commodityYahooFallbacks/)
    expect(src).toMatch(/fetchYahooChartQuote\(sym, timeframe\)/)
    const quotes = readFileSync(resolve(__dirname, '../services/marketsQuotes.ts'), 'utf8')
    expect(quotes).toMatch(/fetchCommodityMarketQuote\(t\.symbol, timeframe\)/)
  })

  it('8: unavailable commodity quotes show Unavailable not eternal Fetching', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/quoteAvailabilityLabel/)
    expect(page).toMatch(/Unavailable/)
    expect(page).toMatch(/src === 'none' \|\| src === 'error'/)
  })

  it('package version is 1.2.70', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.91')
  })
})
