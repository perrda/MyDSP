import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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

describe('markets watchlist store', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('seeds crypto, equities, FX and crypto crosses', async () => {
    const store = await import('../storage/marketsStore')
    const domain = await import('../domain/markets')
    const state = store.loadMarketsState()
    expect(state.tickers.length).toBeGreaterThanOrEqual(7)
    expect(store.listMarketTickers('fx').map((t) => t.symbol)).toEqual(
      expect.arrayContaining(['GBP/USD', 'GBP/THB']),
    )
    expect(store.listMarketTickers('cross').some((t) => t.symbol === 'ADA/BTC')).toBe(true)
    expect(domain.parseRatePair('gbp-usd')).toEqual({ base: 'GBP', quote: 'USD' })
  })

  it('supports CRUD for FX and rejects bad pairs / duplicates', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()

    const eur = store.addMarketTicker({
      kind: 'fx',
      symbol: 'eur/usd',
      name: 'Euro / US Dollar',
    })
    expect(eur.symbol).toBe('EUR/USD')

    expect(() =>
      store.addMarketTicker({ kind: 'fx', symbol: 'EUR/USD', name: 'dup' }),
    ).toThrow(/already/i)

    expect(() =>
      store.addMarketTicker({ kind: 'fx', symbol: 'GBP', name: 'bad' }),
    ).toThrow(/pair/i)

    store.updateMarketTicker(eur.id, { name: 'EURUSD' })
    expect(store.listMarketTickers('fx').find((t) => t.id === eur.id)?.name).toBe('EURUSD')

    store.removeMarketTicker(eur.id)
    expect(store.listMarketTickers('fx').some((t) => t.symbol === 'EUR/USD')).toBe(false)
  })

  it('migrates existing watchlists to include default FX/cross rates', async () => {
    const store = await import('../storage/marketsStore')
    mem.set(
      'mydsp_markets_v1',
      JSON.stringify({
        version: 1,
        tickers: [
          {
            id: 'mkt_crypto_btc',
            kind: 'crypto',
            symbol: 'BTC',
            name: 'Bitcoin',
            createdAt: '2026-01-01',
            sortOrder: 0,
          },
        ],
        collapsed: { crypto: false, equities: false },
      }),
    )
    const state = store.loadMarketsState()
    expect(state.tickers.some((t) => t.symbol === 'GBP/USD')).toBe(true)
    expect(state.tickers.some((t) => t.symbol === 'GBP/THB')).toBe(true)
    expect(state.tickers.some((t) => t.symbol === 'ADA/BTC')).toBe(true)
    expect(state.collapsed.fx).toBe(false)
    expect(state.collapsed.crosses).toBe(false)
  })

  it('exports and imports backup payload with rates', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    store.addMarketTicker({ kind: 'cross', symbol: 'ETH/BTC', name: 'Ethereum / Bitcoin' })
    const exported = store.exportMarketsForBackup()
    mem.clear()
    store.importMarketsFromBackup(exported)
    expect(store.listMarketTickers('cross').some((t) => t.symbol === 'ETH/BTC')).toBe(true)
    expect(store.listMarketTickers('fx').some((t) => t.symbol === 'GBP/USD')).toBe(true)
  })
})

describe('markets domain helpers', () => {
  it('normalizes pairs and formats rate quotes', async () => {
    const domain = await import('../domain/markets')
    expect(domain.normalizeMarketSymbol(' gbp / usd ')).toBe('GBP/USD')
    expect(domain.parseRatePair('ADA/BTC')).toEqual({ base: 'ADA', quote: 'BTC' })
    expect(domain.rateDecimals('BTC')).toBe(8)
    expect(domain.rateDecimals('THB')).toBe(2)
    expect(domain.rateDecimals('USD')).toBe(4)

    const q = {
      symbol: 'GBP/USD',
      kind: 'fx' as const,
      last: 1.2745,
      changeAbs: -0.0021,
      changePct: -0.16,
      sparkline: [1.27, 1.275],
      unit: 'USD',
      decimals: 4,
      source: 'yahoo',
      updatedAt: new Date().toISOString(),
    }
    expect(domain.formatMarketLast(q)).toContain('1.2745')
    expect(domain.formatMarketLast(q)).toContain('USD')
    expect(domain.formatMarketChangeAbs(q)).toMatch(/USD/)
  })

  it('maps Yahoo FX symbols', async () => {
    const prices = await import('../services/prices')
    expect(prices.yahooFxSymbol('GBP', 'USD')).toBe('GBPUSD=X')
    expect(prices.yahooFxSymbol('GBP', 'THB')).toBe('GBPTHB=X')
  })
})
