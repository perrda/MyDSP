import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COINCAP_BTC_CORS_URLS,
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

  it('CoinCap walks CORS-ok GraphQL then v2 until a numeric last', () => {
    expect(COINCAP_BTC_CORS_URLS[0]).toMatch(/graphql\.coincap\.io/)
    expect(COINCAP_BTC_CORS_URLS[0]).toMatch(/asset\(id:"bitcoin"\)/)
    expect(COINCAP_BTC_CORS_URLS.some((u) => u.includes('api.coincap.io/v2/assets/bitcoin'))).toBe(true)
  })

  it('CoinCap probe OK on GraphQL priceUsd when v2 is blocked', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (url.includes('api.coincap.io')) {
        throw new TypeError('Failed to fetch')
      }
      if (url.includes('graphql.coincap.io')) {
        return new Response(
          JSON.stringify({ data: { asset: { priceUsd: '78806.25' } } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const r = await probeCoinCapBtc()
    expect(r.ok).toBe(true)
    expect(r.skipped).toBeFalsy()
    expect(r.detail).toMatch(/78806/)
  })

  it('CoinCap walks past empty GraphQL body to the next CORS URL last', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (url.includes('graphql.coincap.io')) {
        return new Response('', { status: 200 })
      }
      if (url.includes('api.coincap.io/v2/assets/bitcoin')) {
        return new Response(
          JSON.stringify({ data: { priceUsd: '79111.0' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const r = await probeCoinCapBtc()
    expect(r.ok).toBe(true)
    expect(r.skipped).toBeFalsy()
    expect(r.detail).toMatch(/79111/)
  })

  it('CoinCap empty after every URL is a fail, not a skip', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 200 })) as typeof fetch
    const r = await probeCoinCapBtc()
    expect(r.ok).toBe(false)
    expect(r.skipped).toBeFalsy()
    expect(r.detail).toMatch(/empty quote/)
  })

  it('CoinCap BTC last records OK even when CoinGecko already filled this tick', async () => {
    let geckoProbeCalls = 0
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (url.includes('graphql.coincap.io') || (url.includes('coincap') && url.includes('bitcoin'))) {
        return new Response(
          JSON.stringify({ data: { asset: { priceUsd: '79000.5' } } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const outcomes = await pingAllMarketsProviders({
      finnhubKey: '',
      sampledThisTick: [{ source: 'coingecko', last: 50000 }],
      probes: {
        coingecko: async () => {
          geckoProbeCalls += 1
          return { ok: true, detail: 'must not run' }
        },
        yahoo: async () => ({ ok: true }),
        coincap: probeCoinCapBtc,
        coinbase: async () => ({ ok: true }),
        fx: async () => ({ ok: true }),
      },
    })
    expect(geckoProbeCalls).toBe(0)
    expect(outcomes.coingecko).toBe('ok')
    expect(outcomes.coincap).toBe('ok')
    const cap = getMarketsProviderHealth().find((p) => p.id === 'coincap')!
    expect(cap.lastSuccessAt).toBeTruthy()
    expect(cap.consecutiveFailures).toBe(0)
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
