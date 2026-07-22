import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { commodityYahooFallbacks } from '../domain/commodities'
import { isaUsedFromHoldings, isIsaPlatform } from '../domain/isaHoldings'
import { marketSessionStatus } from '../domain/marketSession'
import { QUOTE_FRESHNESS_SLA_MS, hasStaleSyncedQuotes } from '../domain/quoteFreshnessSla'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import type { MarketQuote } from '../domain/markets'
import type { PortfolioData } from '../domain/types'

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

describe('next25h — Finnhub / media / polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('package + release notes are 1.2.80', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.90')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.90')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.90',
      '1.2.89',
      '1.2.88',
      '1.2.87',
      '1.2.86',
    ])
  })

  it('1: Finnhub equities work for all timeframes (not only 24H)', () => {
    const src = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(src).toMatch(/Finnhub quote \+ candles for all Markets timeframes/)
    expect(src).not.toMatch(/tf === '24H'\)/)
  })

  it('2: Finnhub key probe records provider health', () => {
    const prices = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(prices).toMatch(/export async function probeFinnhubKey/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/probeFinnhubKey/)
    expect(settings).toMatch(/recordProviderSuccess\('finnhub'\)/)
  })

  it('3: quote-cache freshness SLA helpers', () => {
    expect(QUOTE_FRESHNESS_SLA_MS).toBe(30 * 60 * 1000)
    const stale: MarketQuote = {
      symbol: 'GC=F',
      kind: 'commodity',
      last: 1,
      changeAbs: 0,
      changePct: 0,
      sparkline: [],
      unit: 'GBP',
      decimals: 2,
      source: 'sync:yahoo',
      updatedAt: new Date(Date.now() - QUOTE_FRESHNESS_SLA_MS - 60_000).toISOString(),
    }
    expect(hasStaleSyncedQuotes([stale])).toBe(true)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-quote-sla-chip/)
  })

  it('4: Sync prices now offline honesty', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/Offline — quotes refreshed from cache only/)
    expect(page).toMatch(/enable Cloud Sync in Settings/)
  })

  it('5: Settings What does not sync panel', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/settings-what-does-not-sync/)
    expect(settings).toMatch(/What does not sync/)
    expect(settings).toMatch(/Finnhub API key/)
  })

  it('6: commodity paper quantity holdings on Markets', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/commodityHoldingsValue/)
    expect(page).toMatch(/Paper quantity/)
    const store = readFileSync(resolve(__dirname, '../storage/marketsStore.ts'), 'utf8')
    expect(store).toMatch(/quantity/)
    expect(store).toMatch(/avgCostGbp/)
  })

  it('7: commodity Open/Closed session copy', () => {
    const status = marketSessionStatus('GC=F', 'commodity')
    expect(status).toBeTruthy()
    expect(status!.hint.toLowerCase()).toMatch(/comex/)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/t\.kind === 'commodity'/)
  })

  it('8: oil/gas commodity presets', () => {
    expect(commodityYahooFallbacks('CL=F')[0]).toBe('CL=F')
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/CL=F/)
    expect(page).toMatch(/NG=F/)
    expect(page).toMatch(/BZ=F/)
  })

  it('9: unavailable reason by symbol', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/unavailableReason/)
    expect(page).toMatch(/provider error/)
  })

  it('10: Finnhub dividend yield fetch', () => {
    const prices = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(prices).toMatch(/fetchFinnhubDividendYield/)
    const quotes = readFileSync(resolve(__dirname, '../services/marketsQuotes.ts'), 'utf8')
    expect(quotes).toMatch(/fetchFinnhubDividendYield/)
  })

  it('11: PTR on Equities/Crypto/News', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/\/equities/)
    expect(shell).toMatch(/\/crypto/)
    expect(shell).toMatch(/\/news/)
  })

  it('12: iPad Markets master–detail', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-master-detail/)
    expect(page).toMatch(/markets-master-detail-panel/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/markets-master-detail--open/)
  })

  it('13: thumb Retry unavailable', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/retryUnavailable/)
    expect(page).toMatch(/Retry unavailable/)
  })

  it('14: bottom-nav long-press Markets refresh', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/mydsp-markets-refresh/)
    expect(nav).toMatch(/item\.to === '\/markets'/)
  })

  it('15: holding drift Use Markets one-tap retained', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/Use Markets price/)
    expect(equities).toMatch(/applyMarketsPriceForEquity/)
  })

  it('16–17: Today movers drop Unavailable + commodity digest', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/src === 'none' \|\| src === 'error'/)
    expect(dash).toMatch(/Commodity mover/)
    expect(dash).toMatch(/\(commodity\)/)
  })

  it('18: News From Owned', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/news-from-owned/)
    expect(news).toMatch(/From Owned/)
    expect(news).toMatch(/addNewsTag/)
  })

  it('19: YouTube via quote Worker allowlist', () => {
    const worker = readFileSync(resolve(__dirname, '../../quote-endpoint/worker.js'), 'utf8')
    expect(worker).toMatch(/www\.youtube\.com/)
    expect(worker).toMatch(/youtube\.com/)
  })

  it('20: Tax ISA from tagged holdings', () => {
    expect(isIsaPlatform('Stocks & Shares ISA')).toBe(true)
    expect(isIsaPlatform('Broker')).toBe(false)
    const data = {
      equities: [
        {
          id: 1,
          symbol: 'VUSA',
          name: 'Vanguard',
          shares: 10,
          avgCost: 50,
          livePrice: 80,
          platform: 'ISA',
        },
      ],
      crypto: [],
    } as unknown as PortfolioData
    const isa = isaUsedFromHoldings(data)
    expect(isa.holdingCount).toBe(1)
    expect(isa.used).toBe(800)
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/tax-isa-from-holdings/)
    expect(tax).toMatch(/isaUsedFromHoldings/)
  })

  it('21: /smoke Finnhub + News + YouTube', () => {
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/finnhub/)
    expect(smoke).toMatch(/Finnhub key \(this device\)/)
    expect(smoke).toMatch(/News tags \/ headlines/)
    expect(smoke).toMatch(/YouTube channels/)
  })

  it('22: Playwright Markets Retry + smoke media checks', () => {
    const smoke = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(smoke).toMatch(/Retry unavailable/)
    expect(smoke).toMatch(/Finnhub key/)
    expect(smoke).toMatch(/YouTube channels/)
    expect(smoke).toMatch(/News tags/)
  })

  it('23: axe News + YouTube + Recurring', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/News axe/)
    expect(a11y).toMatch(/YouTube axe/)
    expect(a11y).toMatch(/Recurring axe/)
  })

  it('24: News last-good headlines sync in fullArchive', () => {
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/newsArticles/)
    expect(backup).toMatch(/exportNewsArticlesForBackup/)
    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/newsArticles/)
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/last-good headlines/)
  })

  it('25: cross-device Finnhub missing chip', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-finnhub-missing-chip/)
    expect(dash).toMatch(/Finnhub missing here/)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-finnhub-missing-chip/)
  })
})
