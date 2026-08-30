import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeCoinCapBtc, probeYahooAapl } from './prices'
import {
  pingAllMarketsProviders,
  getMarketsProviderHealth,
  resetMarketsProviderHealth,
} from './marketsProviderHealth'

const urlOf = (input: RequestInfo | URL) => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return String(input)
}

describe('provider probes (1.2.131 recut)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    resetMarketsProviderHealth()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('Yahoo probe OK on a last close (no regularMarketPrice)', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (
        url.includes('AAPL') ||
        url.includes('finance.yahoo.com') ||
        url.includes('corsproxy') ||
        url.includes('allorigins') ||
        url.includes('codetabs') ||
        url.includes('mydsp-quote')
      ) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { chartPreviousClose: 230.5, previousClose: 230.5 },
                  indicators: { quote: [{ close: [228, null, 230.5] }] },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const r = await probeYahooAapl()
    expect(r.ok).toBe(true)
    expect(r.skipped).toBeFalsy()
    expect(r.detail).toMatch(/AAPL/)
    expect(r.detail).toMatch(/230/)
  })

  it('CoinCap probe OK on BTC last price', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (url.includes('coincap.io') && url.includes('bitcoin')) {
        return new Response(
          JSON.stringify({
            data: { id: 'bitcoin', priceUsd: '65123.45', changePercent24Hr: '1.2' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const r = await probeCoinCapBtc()
    expect(r.ok).toBe(true)
    expect(r.detail).toMatch(/65123/)
  })

  it('missing Finnhub key still skip', async () => {
    localStorage.removeItem('finnhub_key')
    const ok = async () => ({ ok: true as const })
    const outcomes = await pingAllMarketsProviders({
      finnhubKey: '',
      probes: {
        coingecko: ok,
        yahoo: ok,
        coincap: ok,
        coinbase: ok,
        fx: ok,
        finnhub: async () => ({ ok: true, detail: 'must not run' }),
      },
    })
    expect(outcomes.finnhub).toBe('skip')
    const row = getMarketsProviderHealth().find((p) => p.id === 'finnhub')!
    expect(row.lastSuccessAt).toBeUndefined()
    expect(row.consecutiveFailures).toBe(0)
  })
})
