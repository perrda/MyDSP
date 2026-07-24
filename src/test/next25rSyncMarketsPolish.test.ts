import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportJournalFilterForBackup,
  importJournalFilterFromBackup,
  loadJournalFilterPref,
  saveJournalFilterPref,
} from '../domain/journalFilterPref'
import {
  exportNwSparkWindowForBackup,
  importNwSparkWindowFromBackup,
  loadNwSparkWindowPref,
  saveNwSparkWindowPref,
} from '../domain/nwSparkWindowPref'
import {
  exportTaxYearForBackup,
  importTaxYearFromBackup,
  loadTaxYearPref,
  saveTaxYearPref,
} from '../domain/taxYearPref'
import {
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'
import {
  _resetSettingsSectionsForTests,
  exportSettingsSectionsForBackup,
  importSettingsSectionsFromBackup,
  isSettingsSectionOpen,
  setSettingsSectionOpen,
} from '../storage/settingsSectionsStore'

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

describe('next25r — sync / Markets / Today polish tip (1–25 → v1.2.87)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
    _resetSettingsSectionsForTests()
  })

  afterEach(() => {
    mem.clear()
    _resetSettingsSectionsForTests()
  })

  it('25: package + release notes are 1.2.87', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.97')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.97')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.97',
      '1.2.96',
      '1.2.95',
      '1.2.94',
      '1.2.93',
    ])
  })

  it('1: Settings sections open/collapsed LWW', () => {
    setSettingsSectionOpen('sync', true)
    const local = exportSettingsSectionsForBackup()
    expect(local?.sections?.sync).toBe(true)
    expect(local?.updatedAt).toBeTruthy()

    mem.clear()
    _resetSettingsSectionsForTests()
    setSettingsSectionOpen('sync', false)
    importSettingsSectionsFromBackup({
      sections: { sync: true },
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(isSettingsSectionOpen('sync')).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importSettingsSectionsFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ settingsSections: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Settings sections/)
  })

  it('2: Tax year selection LWW', () => {
    saveTaxYearPref('2025/26')
    const local = exportTaxYearForBackup()
    expect(local?.year).toBe('2025/26')

    mem.clear()
    saveTaxYearPref('2024/25')
    importTaxYearFromBackup({
      year: '2025/26',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadTaxYearPref('2024/25')).toBe('2025/26')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importTaxYearFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ taxYear: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Tax year/)
  })

  it('3: Journal asset filter LWW', () => {
    saveJournalFilterPref('BTC')
    const local = exportJournalFilterForBackup()
    expect(local?.asset).toBe('BTC')

    mem.clear()
    saveJournalFilterPref('All')
    importJournalFilterFromBackup({
      asset: 'BTC',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadJournalFilterPref()).toBe('BTC')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importJournalFilterFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ journalFilter: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Journal filter/)
  })

  it('4: Today NW spark window LWW', () => {
    saveNwSparkWindowPref(30)
    const local = exportNwSparkWindowForBackup()
    expect(local?.days).toBe(30)

    mem.clear()
    saveNwSparkWindowPref(7)
    importNwSparkWindowFromBackup({
      days: 30,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadNwSparkWindowPref()).toBe(30)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importNwSparkWindowFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ nwSparkWindow: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/NW spark window/)
  })

  it('5: Docs + SYNC_SMOKE + What arrived extras', () => {
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/Settings section/)
    expect(setup).toMatch(/Tax year/)
    expect(setup).toMatch(/Journal asset filter/)
    expect(setup).toMatch(/NW spark/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Settings sections \+ Tax year \+ Journal filter \+ NW spark/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Settings sections|Tax year|Journal filter|NW spark/)
  })

  it('6–10: Markets quote actions · panel toggles · density · paper NW', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-quote-copy/)
    expect(page).toMatch(/markets-quote-open-news/)
    expect(page).toMatch(/markets-quote-retry/)
    // Retry-all-stale removed — 60s poll + … Refresh cover freshness
    expect(page).not.toMatch(/markets-retry-all-stale/)
    expect(page).not.toMatch(/markets-search-clear/)
    expect(page).toMatch(/markets-panel-toggles/)
    expect(page).toMatch(/markets-density-trust/)
    expect(page).toMatch(/markets-quote-paper-block/)
    expect(page).toMatch(/markets-quote-nw-badge/)
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/tag/)
  })

  it('11–15: Analytics/Opening thumbs · Smoke PTR · no Trips/Analytics long-press sync', () => {
    for (const file of ['AnalyticsPage.tsx', 'OpeningBalanceWizardPage.tsx', 'ImportPage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/thumb-cta-bar/)
    }
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/Analytics/)
    expect(smoke).toMatch(/Opening/)
    const slots = readFileSync(resolve(__dirname, '../storage/bottomNavSlots.ts'), 'utf8')
    expect(slots).toMatch(/\/trips/)
    expect(slots).toMatch(/\/analytics/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/openFavouriteSheet/)
    expect(nav).not.toMatch(/syncNow\(\)/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/analytics-kpi-row/)
  })

  it('16–20: Goals jump · offline Retry · goal next-action · What arrived persist · Focus undo', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-goals/)
    expect(dash).toMatch(/today-section-jump-goals/)
    expect(dash).toMatch(/today-offline-queue-retry/)
    expect(dash).toMatch(/goal-next-action/)
    expect(dash).toMatch(/today-focus-undo/)
    expect(dash).toMatch(/what.?arrived|today-what-arrived/i)
    const stack = readFileSync(resolve(__dirname, '../domain/nextActionStack.ts'), 'utf8')
    expect(stack).toMatch(/goal/)
  })

  it('21–24: axe Goals jump / Markets Retry-all / Opening thumb + e2e thumbs', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Today Goals jump axe/)
    expect(a11y).toMatch(/Today What arrived chip axe/)
    expect(a11y).toMatch(/Markets Retry-all-stale axe/)
    expect(a11y).toMatch(/Opening wizard thumb CTA axe/)
    expect(a11y).toMatch(/Analytics axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Analytics thumb CTA/)
    expect(e2e).toMatch(/Markets Assets \/ Timeframe \/ Format panels/)
    expect(e2e).toMatch(/Today Goals jump chip/)
    expect(e2e).toMatch(/smoke PTR includes Analytics Opening/)
  })
})
