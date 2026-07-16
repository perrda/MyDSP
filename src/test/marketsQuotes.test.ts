import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listMarketTickers,
  loadMarketsState,
  saveMarketsState,
} from '../storage/marketsStore'
import { createEmptyMarketsState } from '../domain/markets'
import { refreshMarketQuotes } from '../services/marketsQuotes'

vi.mock('../services/prices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/prices')>()
  return {
    ...actual,
    fetchCryptoMarketQuotesGbp: vi.fn(async (items: Array<{ symbol: string; coingeckoId?: string }>) => {
      const out: Array<{
        symbol: string
        priceGbp: number
        changePct: number
        sparkline?: number[]
        coingeckoId?: string
        source: 'coingecko' | 'yahoo'
      }> = []
      for (const item of items) {
        const u = item.symbol.toUpperCase()
        if (u === 'BTC') {
          out.push({
            symbol: 'BTC',
            priceGbp: 50000,
            changePct: 1.2,
            sparkline: [49000, 49500, 50000],
            coingeckoId: 'bitcoin',
            source: 'coingecko',
          })
        } else if (u === 'ETH') {
          out.push({
            symbol: 'ETH',
            priceGbp: 2500,
            changePct: -0.5,
            sparkline: [2520, 2510, 2500],
            coingeckoId: 'ethereum',
            source: 'coingecko',
          })
        } else if (u === 'ADA') {
          out.push({
            symbol: 'ADA',
            priceGbp: 0.42,
            changePct: 2.1,
            sparkline: [0.41, 0.415, 0.42],
            coingeckoId: 'cardano',
            source: 'coingecko',
          })
        } else if (u === 'USDC') {
          out.push({
            symbol: 'USDC',
            priceGbp: 0.79,
            changePct: 0.01,
            sparkline: [0.79, 0.79, 0.79],
            coingeckoId: 'usd-coin',
            source: 'coingecko',
          })
        } else if (u === 'NIGHT') {
          out.push({
            symbol: 'NIGHT',
            priceGbp: 0.022,
            changePct: -3.5,
            sparkline: [0.023, 0.0225, 0.022],
            coingeckoId: 'midnight-3',
            source: 'coingecko',
          })
        } else if (u === 'SOL') {
          out.push({
            symbol: 'SOL',
            priceGbp: 120,
            changePct: 1.5,
            source: 'yahoo',
          })
        } else {
          out.push({ symbol: u, priceGbp: 0, changePct: 0, source: 'yahoo' })
        }
      }
      return out
    }),
    fetchCryptoGbpSparkline: vi.fn(async () => [1, 2, 3, 2.5]),
    fetchEquityMarketQuote: vi.fn(async (symbol: string) => {
      if (symbol.toUpperCase() === 'AAPL') {
        return {
          price: 190,
          previousClose: 188,
          changePct: 1.06,
          changeAbs: 2,
          sparkline: [180, 185, 190],
          source: 'yahoo' as const,
        }
      }
      return null
    }),
    fetchFxPairQuote: vi.fn(async (base: string, quote: string) => {
      if (base === 'GBP' && quote === 'USD') {
        return {
          last: 1.27,
          previousClose: 1.26,
          changeAbs: 0.01,
          changePct: 0.79,
          sparkline: [1.26, 1.265, 1.27],
          source: 'yahoo',
        }
      }
      return null
    }),
    fetchCryptoCrossQuote: vi.fn(async (base: string, quote: string) => {
      if (base === 'ADA' && quote === 'BTC') {
        return {
          last: 0.42 / 50000,
          previousClose: 0.4 / 50000,
          changeAbs: 0.02 / 50000,
          changePct: 5,
          sparkline: [],
          source: 'coingecko',
        }
      }
      return null
    }),
    fetchIndexQuote: vi.fn(async (symbol: string) => {
      if (symbol === '^GSPC' || symbol.toUpperCase() === 'SPX') {
        return {
          price: 5500,
          previousClose: 5450,
          changePct: 0.92,
          changeAbs: 50,
          sparkline: [5400, 5450, 5500],
          source: 'yahoo' as const,
        }
      }
      return null
    }),
  }
})

vi.mock('../services/fx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/fx')>()
  return {
    ...actual,
    ensureFxRates: vi.fn(async () => ({
      rates: { GBP: 1, USD: 1.27 },
      asOf: new Date().toISOString(),
      source: 'cache' as const,
    })),
    usdToGbp: (n: number) => n / 1.27,
  }
})

describe('refreshMarketQuotes', () => {
  beforeEach(() => {
    localStorage.clear()
    const now = new Date().toISOString()
    saveMarketsState({
      ...createEmptyMarketsState(),
      tickers: [
        { id: 't_btc', kind: 'crypto', symbol: 'BTC', name: 'Bitcoin', createdAt: now, sortOrder: 0 },
        { id: 't_ada', kind: 'crypto', symbol: 'ADA', name: 'Cardano', createdAt: now, sortOrder: 1 },
        { id: 't_usdc', kind: 'crypto', symbol: 'USDC', name: 'USDC', createdAt: now, sortOrder: 2 },
        { id: 't_night', kind: 'crypto', symbol: 'NIGHT', name: 'NIGHT', createdAt: now, sortOrder: 3 },
        { id: 't_aapl', kind: 'equity', symbol: 'AAPL', name: 'Apple', createdAt: now, sortOrder: 4 },
        { id: 't_gbpusd', kind: 'fx', symbol: 'GBP/USD', name: 'GBP / USD', createdAt: now, sortOrder: 5 },
        { id: 't_adabtc', kind: 'cross', symbol: 'ADA/BTC', name: 'ADA / BTC', createdAt: now, sortOrder: 6 },
      ],
    })
  })

  it('fills live GBP quotes for ADA, USDC, and NIGHT', async () => {
    const tickers = listMarketTickers()
    const quotes = await refreshMarketQuotes(tickers)

    const bySym = new Map(
      [...quotes.values()].map((q) => [q.symbol.toUpperCase(), q]),
    )
    expect(bySym.get('BTC')?.last).toBe(50000)
    expect(bySym.get('ADA')?.last).toBe(0.42)
    expect(bySym.get('ADA')?.changePct).toBe(2.1)
    expect(bySym.get('USDC')?.last).toBe(0.79)
    expect(bySym.get('NIGHT')?.last).toBe(0.022)
    expect(bySym.get('NIGHT')?.changePct).toBe(-3.5)
    expect(bySym.get('BTC')?.sparkline?.length).toBeGreaterThan(1)
  })

  it('persists resolved CoinGecko ids onto crypto tickers', async () => {
    const tickers = listMarketTickers()
    await refreshMarketQuotes(tickers)
    const night = loadMarketsState().tickers.find((t) => t.symbol === 'NIGHT')
    const ada = loadMarketsState().tickers.find((t) => t.symbol === 'ADA')
    expect(night?.coingeckoId).toBe('midnight-3')
    expect(ada?.coingeckoId).toBe('cardano')
  })

  it('refreshes equity, FX, and crypto crosses', async () => {
    const tickers = listMarketTickers()
    const quotes = await refreshMarketQuotes(tickers)
    const bySym = new Map(
      [...quotes.values()].map((q) => [q.symbol.toUpperCase(), q]),
    )
    expect(bySym.get('AAPL')?.last).toBeCloseTo(190 / 1.27, 5)
    expect(bySym.get('GBP/USD')?.last).toBe(1.27)
    expect(bySym.get('ADA/BTC')?.last).toBeCloseTo(0.42 / 50000, 10)
  })
})
