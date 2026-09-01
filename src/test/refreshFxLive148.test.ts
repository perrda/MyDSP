import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.148 Refresh fetches live FX with prices', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.159')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.159')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.159',
      '1.2.158',
      '1.2.157',
      '1.2.156',
      '1.2.155',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.148\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/fetchFxRates/)
    expect(section).toMatch(/TSLA/)
    expect(section).toMatch(/MSTR/)
    expect(section).toMatch(/CoinGecko/)
    expect(section).toMatch(/Finnhub/)
    expect(section).toMatch(/Cloudflare/)
    expect(section).toMatch(/not a price feed/)
    expect(section).toMatch(/VWRL/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Refresh fetches live FX \(v1\.2\.148\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.159/)
    expect(read('../services/fx.ts')).toMatch(/Header Refresh always calls fetchFxRates/)
  })

  it('refreshPrices fetches FX before quotes and still last-sync fills £0 lines', () => {
    const ctx = read('../context/PortfolioContext.tsx')
    const start = ctx.indexOf('const refreshPrices = useCallback')
    const body = ctx.slice(start, ctx.indexOf('const familyPriceAttempted', start))
    expect(body).toMatch(/const rates = await fetchFxRates\(\)/)
    expect(body).not.toMatch(/ensureFxRates\(/)
    expect(body).toMatch(/fetchCryptoPricesGbp/)
    expect(body).toMatch(/fetchEquityPrices/)
    expect(body).toMatch(/refreshLiveQuotesForBookDevice/)
    expect(body).toMatch(/applyLastSyncedQuotesToHoldings/)
    expect(ctx).toMatch(/fetchFxRates/)
    expect(read('../components/layout/AppShell.tsx')).toMatch(/if \(!r\.skipped\) await refreshFx\(\)/)
    expect(read('../services/marketsQuotes.ts')).toMatch(/opts\?\.fx \?\? \(await fetchFxRates\(\)\)/)
    expect(read('../services/marketsQuotes.ts')).not.toMatch(/await ensureFxRates\(/)
    expect(read('../services/marketsQuotes.ts')).toMatch(/holdings Refresh must still apply/)
    expect(read('../services/prices.ts')).toMatch(/rates \?\? \(await fetchFxRates\(\)\)/)
    expect(read('../services/prices.ts')).not.toMatch(/ensureFxRates/)
    expect(read('../services/fx.ts')).toMatch(/let fxInFlight/)
    expect(read('../domain/equityCurrency.ts')).toMatch(/VWRL\.L/)
    expect(read('../services/prices.ts')).toMatch(/yahooVenueEquitySymbol/)
    expect(read('../services/prices.ts')).toMatch(/regularMarketPrice/)
    expect(read('../services/prices.ts')).toMatch(/accept\?: \(data: T\) => boolean/)
    expect(read('../services/prices.ts')).toMatch(/isQuoteWorkerCandidate/)
    expect(read('../services/prices.ts')).toMatch(/workerFirst/)
  })

  it('Settings Prices copy: Refresh pulls FX; Cloudflare is not a feed', () => {
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/fresh GBP FX/)
    expect(settings).toMatch(/even if you are not on Markets/)
    expect(settings).toMatch(/Cloudflare Workers Paid is/)
    expect(settings).toMatch(/not a price feed/)
    expect(settings).toMatch(/Finnhub/)
    expect(settings).toMatch(/CoinGecko/)
  })
})
