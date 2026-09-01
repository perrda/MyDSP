import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.148 Refresh fetches live FX with prices', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.148')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.148')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.148',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
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
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Refresh fetches live FX \(v1\.2\.148\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.148/)
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
    expect(body).toMatch(/applyLastSyncedQuotesToHoldings/)
    expect(ctx).toMatch(/fetchFxRates/)
    expect(read('../components/layout/AppShell.tsx')).toMatch(/if \(!r\.skipped\) await refreshFx\(\)/)
  })

  it('Settings Prices copy: Refresh pulls FX; Cloudflare is not a feed', () => {
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/fresh GBP FX/)
    expect(settings).toMatch(/Cloudflare Workers Paid is/)
    expect(settings).toMatch(/not a price feed/)
    expect(settings).toMatch(/Finnhub/)
    expect(settings).toMatch(/CoinGecko/)
  })
})
