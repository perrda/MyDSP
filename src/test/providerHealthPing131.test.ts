import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  fetchCryptoMarketQuotesGbp,
  fetchEquityMarketQuote,
} from '../services/prices'
import {
  getMarketsProviderHealth,
  resetMarketsProviderHealth,
} from '../services/marketsProviderHealth'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.131 provider health ping-all', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.131')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.131')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.131',
      '1.2.130',
      '1.2.129',
      '1.2.128',
      '1.2.127',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.131\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/[Pp]ing-all/)
    expect(section).toMatch(/Provider health/)
    expect(section).toMatch(/header Refresh/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.130/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
  })

  it('header Refresh invokes ping-all after refreshPrices / refreshFx', () => {
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/pingAllMarketsProviders/)
    const onRefresh = shell.indexOf('const onRefresh = async')
    const prices = shell.indexOf('await refreshPrices()', onRefresh)
    const fx = shell.indexOf('if (!r.skipped) await refreshFx()', onRefresh)
    const ping = shell.indexOf('await pingAllMarketsProviders', onRefresh)
    expect(prices).toBeGreaterThan(onRefresh)
    expect(fx).toBeGreaterThan(prices)
    expect(ping).toBeGreaterThan(fx)
    expect(shell).toMatch(/sampledThisTick/)
    expect(shell).toMatch(/r\.quotes/)
    const toast = shell.indexOf('Updated ${r.crypto} crypto', onRefresh)
    expect(toast).toBeGreaterThan(ping)
  })

  it('does not change Mini-as-book sync, orange lock, or 1.2.129/130 nav', () => {
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/origin-lock|ORIGIN|allowlist|thisDeviceIsTheBook|applyRemoteAsBook/)
    const book = read('../services/sync/localBook.ts')
    expect(book).toMatch(/thisDeviceIsTheBook|localBookIsSourceOfTruth/)
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/applyRemoteAsBook|runOneButtonSync/)
    const toolbar = read('../components/layout/ToolbarControls.tsx')
    expect(toolbar).toMatch(/toolbar-refresh/)
    expect(toolbar).not.toMatch(/MediaChromeChips/)
    const nav = read('../components/layout/BottomNav.tsx')
    expect(nav).toMatch(/PHONE_MEDIA_NAV/)
    expect(nav).toMatch(/bottom-nav-media/)
    const css = read('../index.css')
    expect(css).toMatch(/#F7931A/)
    const sidebar = read('../domain/primaryNav.ts')
    expect(sidebar).toMatch(/News/)
    expect(sidebar).toMatch(/YouTube/)
  })

  it('probes reuse existing quote helpers and honour CoinGecko backoff', () => {
    const prices = read('../services/prices.ts')
    expect(prices).toMatch(/export async function probeCoinGeckoBitcoinGbp/)
    expect(prices).toMatch(/simple\/price\?ids=bitcoin&vs_currencies=gbp/)
    expect(prices).toMatch(/if \(geckoCoolingDown\(\)\)/)
    expect(prices).toMatch(/export function holdingsQuoteProxyCandidates/)
    expect(prices).toMatch(/export async function fetchViaHoldingsProxies/)
    expect(prices).toMatch(/export async function probeYahooAapl/)
    expect(prices).toMatch(/fetchYahooLastCloseViaHoldingsProxies/)
    expect(prices).toMatch(/holdingsQuoteProxyCandidates\(yahoo\)/)
    expect(prices).toMatch(/export async function probeCoinCapBtc/)
    expect(prices).toMatch(/graphql\.coincap\.io/)
    expect(prices).toMatch(/COINCAP_BTC_CORS_URLS/)
    expect(prices).toMatch(/fetchCoinCapUsd\('BTC'\)/)
    expect(prices).toMatch(/export async function probeCoinbaseBtc/)
    expect(prices).toMatch(/fetchCoinbaseUsd\('BTC'\)/)
    expect(prices).toMatch(/export async function probeFxGbp/)
    expect(prices).toMatch(/fetchFrankfurterFxQuote\('GBP', 'USD'\)/)
    expect(prices).toMatch(/fetchExchangerateApiSpot\('GBP', 'USD'\)/)
  })

  it('Settings health list still prints OK · time from lastSuccessAt', () => {
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/OK · \$\{new Date\(row\.lastSuccessAt\)\.toLocaleTimeString\(\)\}/)
    expect(settings).toMatch(/No hits yet/)
    expect(settings).toMatch(/fail\(s\)/)
    expect(settings).toMatch(/getMarketsProviderHealth\(\)\.map/)
  })
})

describe('cascade quote path does not need failovers', () => {
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

  it('CoinGecko fill skips CoinCap / Coinbase / Yahoo crypto', async () => {
    const called: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      called.push(url)
      if (url.includes('api.coingecko.com') && url.includes('simple/price')) {
        return new Response(JSON.stringify({ bitcoin: { gbp: 50000, gbp_24h_change: 1 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('exchangerate-api.com')) {
        return new Response(JSON.stringify({ rates: { USD: 1.27, THB: 46 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const quotes = await fetchCryptoMarketQuotesGbp([{ symbol: 'BTC' }])
    expect(quotes).toHaveLength(1)
    expect(quotes[0]?.source).toBe('coingecko')
    expect(quotes[0]?.priceGbp).toBe(50000)
    expect(called.some((u) => u.includes('api.coincap.io'))).toBe(false)
    expect(called.some((u) => u.includes('api.coinbase.com'))).toBe(false)
    expect(called.some((u) => u.includes('finance.yahoo.com') && u.includes('BTC'))).toBe(false)
  })

  it('Finnhub equity fill does not need Yahoo for the price', async () => {
    const called: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      called.push(url)
      if (url.includes('finnhub.io/api/v1/quote')) {
        return new Response(JSON.stringify({ c: 190, d: 1, dp: 0.5, pc: 189 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('finnhub.io/api/v1/stock/candle')) {
        return new Response(
          JSON.stringify({ s: 'ok', c: [188, 189, 190], t: [1, 2, 3] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const q = await fetchEquityMarketQuote('AAPL', 'test-key')
    expect(q?.source).toBe('finnhub')
    expect(q?.price).toBe(190)
    expect(called.some((u) => u.includes('finance.yahoo.com'))).toBe(false)
    expect(getMarketsProviderHealth().find((p) => p.id === 'yahoo')?.consecutiveFailures).toBe(0)
  })
})
