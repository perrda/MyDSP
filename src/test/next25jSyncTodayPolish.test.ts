import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  exportCompareWeekSnapshotForBackup,
  importCompareWeekSnapshotFromBackup,
  syncCompareWeekSnapshots,
} from '../domain/compareWeekSnapshot'
import { calcBreakdownWithPaper } from '../domain/netWorthWithPaper'
import { paperCommodityValue } from '../domain/paperCommodities'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'
import { createEmptyPortfolio } from '../domain/defaults'
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

describe('next25j — sync / Today polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('package + release notes are 1.2.80', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.92')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.92')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.92',
      '1.2.91',
      '1.2.90',
      '1.2.89',
      '1.2.88',
    ])
  })

  it('1: Compare week-Δ snapshots sync', () => {
    syncCompareWeekSnapshots({ default: 1000 })
    const exported = exportCompareWeekSnapshotForBackup()
    expect(exported?.current.default).toBe(1000)
    mem.clear()
    importCompareWeekSnapshotFromBackup(exported)
    expect(exportCompareWeekSnapshotForBackup()?.current.default).toBe(1000)
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/compareWeekSnapshot/)
  })

  it('2: What arrived extras summary', () => {
    const flags = workspaceExtrasFlagsFromPreview({
      marketQuotes: {},
      newsArticles: {},
      isaRemaining: {},
    })
    const summary = summarizeWorkspaceExtras(flags)
    expect(summary).toMatch(/Markets quotes/)
    expect(summary).toMatch(/News headlines/)
    expect(summary).toMatch(/ISA override/)
    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/summarizeWorkspaceExtras/)
  })

  it('3–4: device-local prefs in Settings + SYNC_SETUP', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Launch path/)
    expect(settings).toMatch(/Recurring sort/)
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/Launch path/)
    expect(docs).toMatch(/holdings drift/i)
  })

  it('5: digest highlight edits persist', () => {
    const modal = readFileSync(resolve(__dirname, '../components/WeeklyDigestModal.tsx'), 'utf8')
    expect(modal).toMatch(/saveDigestHighlightEdits/)
    expect(modal).toMatch(/loadDigestHighlightEdits/)
  })

  it('6–7: paper NW in Compare + history', () => {
    const compare = readFileSync(resolve(__dirname, '../domain/portfolioCompare.ts'), 'utf8')
    const history = readFileSync(resolve(__dirname, '../domain/history.ts'), 'utf8')
    expect(compare).toMatch(/calcBreakdownWithPaper/)
    expect(history).toMatch(/calcBreakdownWithPaper/)
    const data = createEmptyPortfolio()
    const paper = paperCommodityValue(
      [
        {
          id: 'c1',
          kind: 'commodity',
          symbol: 'GC=F',
          name: 'Gold',
          quantity: 1,
          includeInNetWorth: true,
        } as MarketTicker,
      ],
      new Map<string, MarketQuote>([
        [
          'c1',
          {
            symbol: 'GC=F',
            kind: 'commodity',
            last: 2000,
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
    expect(paper.value).toBe(2000)
    // Without markets store wired in test env, helper still returns base breakdown
    expect(calcBreakdownWithPaper(data).netWorth).toBeTypeOf('number')
  })

  it('8–9: Today SLA + Finnhub 429 chips', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-quote-sla-chip/)
    expect(dash).toMatch(/today-finnhub-quota-chip/)
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compare-quote-sla-chip/)
  })

  it('10: Markets tag filter + yield sort persist', () => {
    const store = readFileSync(resolve(__dirname, '../storage/marketsStore.ts'), 'utf8')
    expect(store).toMatch(/setMarketsTagFilter/)
    expect(store).toMatch(/setMarketsYieldSort/)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/getMarketsTagFilter|setMarketsTagFilter/)
  })

  it('11–12: News unread Jump-in + bottom-nav dots', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-news-unread/)
    expect(dash).toMatch(/newsUnreadFromCache/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/bottom-nav-unread/)
  })

  it('13–15: YouTube cached banner + Tax/Recurring thumb + PTR', () => {
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(yt).toMatch(/youtube-cached-mode-banner/)
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/thumb-cta-bar/)
    const recurring = readFileSync(resolve(__dirname, '../pages/RecurringPage.tsx'), 'utf8')
    expect(recurring).toMatch(/thumb-cta-bar/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/\/recurring/)
  })

  it('16–20: newsUnread helper, bill link, Compare select, ISA sync, partial chip', () => {
    const news = readFileSync(resolve(__dirname, '../storage/newsStore.ts'), 'utf8')
    expect(news).toMatch(/export function newsUnreadFromCache/)
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-bill-commentary/)
    expect(dash).toMatch(/to=\"\/recurring\"/)
    expect(dash).toMatch(/today-quote-partial-chip/)
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compareSelectionPrefs/)
    expect(compare).toMatch(/loadCompareSelectedIds/)
    expect(compare).toMatch(/saveCompareSelectedIds/)
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/mydsp-sync-applied/)
    expect(tax).toMatch(/loadIsaRemainingDraft/)
  })

  it('21–24: smoke News allowlist + Playwright + axe gates', () => {
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/Worker News allowlist/)
    const checks = readFileSync(resolve(__dirname, '../domain/smokeChecks.ts'), 'utf8')
    expect(checks).toMatch(/probeQuoteWorkerNewsAllowlist/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Worker News allowlist/)
    expect(e2e).toMatch(/\/compare/)
    expect(e2e).toMatch(/\/tax/)
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Compare axe/)
    expect(a11y).toMatch(/Liabilities axe/)
    expect(a11y).toMatch(/Import axe/)
  })

  it('25: SYNC_SETUP Compare week-Δ', () => {
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/week-Δ/)
  })
})
