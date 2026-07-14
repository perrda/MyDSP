import { describe, expect, it, vi } from 'vitest'
import {
  fetchCryptoMarketQuotesGbp,
  KNOWN_CRYPTO_SYMBOLS,
  resolveGeckoId,
} from '../services/prices'

describe('crypto quote resolution', () => {
  it('maps NIGHT to midnight-3 and known symbols to CoinGecko ids', () => {
    expect(resolveGeckoId('NIGHT')).toBe('midnight-3')
    expect(resolveGeckoId('ADA')).toBe('cardano')
    expect(resolveGeckoId('USDC')).toBe('usd-coin')
    expect(KNOWN_CRYPTO_SYMBOLS).toContain('NIGHT')
  })

  it('falls back to Yahoo when CoinGecko batch misses a symbol', async () => {
    const urlOf = (input: RequestInfo | URL) => {
      if (typeof input === 'string') return input
      if (input instanceof URL) return input.href
      if (typeof Request !== 'undefined' && input instanceof Request) return input.url
      return String(input)
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = urlOf(input as RequestInfo | URL)
      if (url.includes('coingecko.com/api/v3/simple/price')) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (
        url.includes('ADA-USD') ||
        url.includes('finance.yahoo.com') ||
        url.includes('corsproxy') ||
        url.includes('allorigins')
      ) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 0.55,
                    chartPreviousClose: 0.5,
                    currency: 'USD',
                  },
                  indicators: { quote: [{ close: [0.5, 0.52, 0.55] }] },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      // FX / anything else
      return new Response(
        JSON.stringify({ rates: { GBP: 1, USD: 1.27 }, result: 'success', conversion_rates: { GBP: 1, USD: 1.27 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })

    try {
      const rows = await fetchCryptoMarketQuotesGbp([{ symbol: 'ADA' }])
      expect(rows[0]?.source).toBe('yahoo')
      expect(rows[0]?.priceGbp).toBeGreaterThan(0)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
