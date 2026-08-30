import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  holdingsQuoteProxyCandidates,
  probeCoinCapBtc,
  probeYahooAapl,
} from './prices'
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

describe('provider probes (1.2.131 this-tick + holdings proxies)', () => {
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

  it('Yahoo uses the holdings CORS-proxy stack', () => {
    const urls = holdingsQuoteProxyCandidates(
      'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d',
    )
    expect(urls.some((u) => u.includes('mydsp-quote.dave-perry.workers.dev/quote?url='))).toBe(true)
    expect(urls.some((u) => u.includes('api.allorigins.win/raw?url='))).toBe(true)
    expect(urls.some((u) => u.includes('api.codetabs.com/v1/proxy?quest='))).toBe(true)
    expect(urls.some((u) => u.includes('corsproxy.io/?'))).toBe(true)
    expect(urls.some((u) => u.includes('query1.finance.yahoo.com'))).toBe(true)
    expect(urls.some((u) => u.includes('query2.finance.yahoo.com'))).toBe(true)
  })

  it('Yahoo probe OK on last close after empty proxy bodies (not a 200 {} success)', async () => {
    const yahooUrls = holdingsQuoteProxyCandidates(
      'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d',
    )
    let chartHits = 0
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)
      const isYahooRelay = yahooUrls.includes(url) || url.includes('finance.yahoo.com')
      if (isYahooRelay) {
        chartHits += 1
        if (chartHits < 3) {
          return new Response('', { status: 200 })
        }
        if (chartHits === 3) {
          return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { chartPreviousClose: 230.5 },
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
    expect(r.detail).toMatch(/230/)
    expect(chartHits).toBeGreaterThan(3)
  })

  it('empty/undefined Yahoo body is not success', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const r = await probeYahooAapl()
    expect(r.ok).toBe(false)
    expect(r.skipped).toBe(true)
    expect(r.detail).not.toMatch(/empty quote/)
  })

  it('CoinCap probe OK on BTC last via holdings failover helper', async () => {
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

  it('CoinCap CORS-blocked / empty body is skip, not empty-quote fail', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const r = await probeCoinCapBtc()
    expect(r.ok).toBe(false)
    expect(r.skipped).toBe(true)
    expect(r.detail).not.toMatch(/empty quote/)
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
