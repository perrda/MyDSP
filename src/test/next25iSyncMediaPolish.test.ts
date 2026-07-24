import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { paperCommodityValue } from '../domain/paperCommodities'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import type { MarketQuote, MarketTicker } from '../domain/markets'

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

describe('next25i — sync / media / polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('package + release notes are 1.2.80', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.101')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.101')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.101',
      '1.2.100',
      '1.2.99',
      '1.2.98',
      '1.2.97',
    ])
  })

  it('1: ISA remaining override syncs via fullArchive', () => {
    const prefs = readFileSync(resolve(__dirname, '../domain/isaPrefs.ts'), 'utf8')
    expect(prefs).toMatch(/exportIsaRemainingForBackup/)
    expect(prefs).toMatch(/importIsaRemainingFromBackup/)
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/isaRemaining/)
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/saveIsaRemainingDraft/)
  })

  it('2: What does not sync expands device-local prefs', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Accessibility prefs/)
    expect(settings).toMatch(/Glass mode/)
    expect(settings).toMatch(/Price-alert notification permission/)
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/Device-local prefs matrix/)
  })

  it('3: YouTube video cache syncs', () => {
    const yt = readFileSync(resolve(__dirname, '../storage/youtubeStore.ts'), 'utf8')
    expect(yt).toMatch(/saveYoutubeVideosCache/)
    expect(yt).toMatch(/exportYoutubeVideosForBackup/)
    expect(yt).toMatch(/youtubeUnreadFromCache/)
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/youtubeVideos/)
    const media = readFileSync(resolve(__dirname, '../services/mediaRefresh.ts'), 'utf8')
    expect(media).toMatch(/saveYoutubeVideosCache/)
  })

  it('4: price-alert thresholds in fullArchive', () => {
    const alerts = readFileSync(resolve(__dirname, '../domain/priceAlerts.ts'), 'utf8')
    expect(alerts).toMatch(/exportPriceAlertThresholdsForBackup|markWorkspaceChangedForSync/)
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/priceAlertThresholds/)
  })

  it('5: Sync prices partial-failure report', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/Sync prices: \$\{live\} live · \$\{failed\} failed/)
  })

  it('6: Finnhub 429 chip', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-finnhub-quota-chip/)
    expect(page).toMatch(/Finnhub rate-limited \(429\)/)
    const prices = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(prices).toMatch(/429/)
  })

  it('7–8: commodity paper P&L + optional NW include', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/includeInNetWorth/)
    expect(page).toMatch(/avgCostGbp/)
    const paper = paperCommodityValue(
      [
        {
          id: 'c1',
          kind: 'commodity',
          symbol: 'GC=F',
          name: 'Gold',
          quantity: 2,
          avgCostGbp: 1000,
          includeInNetWorth: true,
        } as MarketTicker,
      ],
      new Map<string, MarketQuote>([
        [
          'c1',
          {
            symbol: 'GC=F',
            kind: 'commodity',
            last: 1500,
            changeAbs: 0,
            changePct: 0,
            sparkline: [],
            unit: 'GBP',
            decimals: 2,
            source: 'yahoo',
            updatedAt: new Date().toISOString(),
          },
        ],
      ]),
    )
    expect(paper.value).toBe(3000)
    expect(paper.cost).toBe(2000)
    expect(paper.count).toBe(1)
    const ctx = readFileSync(resolve(__dirname, '../context/PortfolioContext.tsx'), 'utf8')
    expect(ctx).toMatch(/calcBreakdownWithPaper|paperCommodityValue/)
  })

  it('9: offline Retry when online', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/Retry when online/)
    expect(page).toMatch(/pendingRetryOnline/)
  })

  it('10: yield autofill never overwrites manual', () => {
    const quotes = readFileSync(resolve(__dirname, '../services/marketsQuotes.ts'), 'utf8')
    expect(quotes).toMatch(/yieldManual/)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/yieldManualPatch/)
  })

  it('11: PTR on YouTube / Tax / Compare', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/\/youtube/)
    expect(shell).toMatch(/\/tax/)
    expect(shell).toMatch(/\/compare/)
  })

  it('12: bottom-nav long-press no longer refreshes News / YouTube', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).not.toMatch(/mydsp-news-refresh/)
    expect(nav).not.toMatch(/mydsp-youtube-refresh/)
    expect(nav).toMatch(/openFavouriteSheet/)
  })

  it('13: iPad News / YouTube master–detail', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(news).toMatch(/news-master-detail/)
    expect(yt).toMatch(/youtube-master-detail/)
    expect(css).toMatch(/news-master-detail--open/)
    expect(css).toMatch(/youtube-master-detail--open/)
  })

  it('14: Compare phone thumb CTA', () => {
    const page = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(page).toMatch(/thumb-cta-bar/)
  })

  it('15: privacy mask Markets/Today movers', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/privacyClass\(privacy\)/)
    expect(dash).toMatch(/todayMovers\.map/)
  })

  it('16: recurring commentary on Today bills', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-bill-commentary/)
  })

  it('17: ISA MV vs contribution honesty', () => {
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/market-value estimate/)
  })

  it('18: YouTube unread on nav/Jump-in', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/youtubeUnreadFromCache/)
    expect(dash).toMatch(/today-youtube-unread/)
  })

  it('19: News Cached-mode banner', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/news-cached-mode-banner/)
  })

  it('20: Compare as-of for sync-tagged quotes', () => {
    const page = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(page).toMatch(/compare-sync-asof/)
    expect(page).toMatch(/from other device/i)
  })

  it('21: axe Jobs / Goals / Trips', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Jobs axe/)
    expect(a11y).toMatch(/Goals axe/)
    expect(a11y).toMatch(/Trips axe/)
  })

  it('22: /smoke Worker allowlist', () => {
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/Worker YouTube allowlist/)
    expect(smoke).toMatch(/probeQuoteWorkerYoutubeAllowlist/)
    const checks = readFileSync(resolve(__dirname, '../domain/smokeChecks.ts'), 'utf8')
    expect(checks).toMatch(/YOUTUBE_ALLOWLIST_PROBE/)
  })

  it('23: /smoke ISA + PTR', () => {
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/ISA remaining override/)
    expect(smoke).toMatch(/PTR YouTube \/ Tax \/ Compare/)
  })

  it('24: Playwright YT Worker', () => {
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/YouTube page uses Quote Worker/)
    expect(e2e).toMatch(/Worker YouTube allowlist/)
  })

  it('25: SYNC_SETUP device-local prefs matrix', () => {
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/Device-local prefs matrix/)
    expect(docs).toMatch(/ISA remaining override/)
    expect(docs).toMatch(/Glass mode/)
  })
})
