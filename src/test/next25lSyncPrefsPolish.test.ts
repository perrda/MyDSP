import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  exportHoldingsDriftForBackup,
  importHoldingsDriftFromBackup,
  saveHoldingsDriftThresholdPct,
} from '../domain/holdingsDrift'
import { needsFollowUp } from '../domain/jobs'
import type { JobApplication } from '../domain/job-types'
import {
  exportNewsFilterForBackup,
  importNewsFilterFromBackup,
  saveNewsFilterTag,
} from '../domain/newsFilterPrefs'
import {
  exportPortfolioConcentrationForBackup,
  importPortfolioConcentrationFromBackup,
  savePortfolioConcentrationThresholdPct,
} from '../domain/portfolioConcentration'
import {
  exportRecurringSortForBackup,
  importRecurringSortFromBackup,
  saveRecurringSort,
} from '../domain/recurringSortPrefs'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportSpendingFiltersForBackup,
  importSpendingFiltersFromBackup,
  saveSpendingFilters,
} from '../domain/spendingFilterPrefs'
import {
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'

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

describe('next25l — sync prefs / Markets / Today polish tip (1–25 → v1.2.78)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.78', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.78')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.78')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.78',
      '1.2.77',
      '1.2.76',
      '1.2.75',
      '1.2.74',
    ])
  })

  it('1: Recurring sort LWW sync', () => {
    saveRecurringSort('amount-desc')
    const exported = exportRecurringSortForBackup()
    expect(exported?.sort).toBe('amount-desc')
    mem.clear()
    importRecurringSortFromBackup(exported)
    expect(exportRecurringSortForBackup()?.sort).toBe('amount-desc')
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/recurringSort/)
  })

  it('2–3: drift + concentration LWW sync', () => {
    saveHoldingsDriftThresholdPct(12)
    savePortfolioConcentrationThresholdPct(33)
    const drift = exportHoldingsDriftForBackup()
    const conc = exportPortfolioConcentrationForBackup()
    expect(drift?.pct).toBe(12)
    expect(conc?.pct).toBe(33)
    mem.clear()
    importHoldingsDriftFromBackup(drift)
    importPortfolioConcentrationFromBackup(conc)
    expect(exportHoldingsDriftForBackup()?.pct).toBe(12)
    expect(exportPortfolioConcentrationForBackup()?.pct).toBe(33)
  })

  it('4: Spending filter prefs LWW sync', () => {
    saveSpendingFilters({ query: 'coffee', category: 'food' })
    const exported = exportSpendingFiltersForBackup()
    expect(exported?.query).toBe('coffee')
    mem.clear()
    importSpendingFiltersFromBackup(exported)
    expect(exportSpendingFiltersForBackup()?.category).toBe('food')
  })

  it('5: What arrived covers new extras', () => {
    const flags = workspaceExtrasFlagsFromPreview({
      recurringSort: { sort: 'due-asc' },
      holdingsDrift: { pct: 5 },
      portfolioConcentration: { pct: 25 },
      spendingFilters: { query: '', category: 'All' },
      newsFilter: { filterTag: 'all' },
    })
    const summary = summarizeWorkspaceExtras(flags)
    expect(summary).toMatch(/Recurring sort/)
    expect(summary).toMatch(/drift threshold/)
    expect(summary).toMatch(/concentration threshold/)
    expect(summary).toMatch(/Spending filters|News filter/)
  })

  it('6–7: Equities/Crypto thumb + jump unavailable badge', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(equities).toMatch(/thumb-cta-bar/)
    expect(crypto).toMatch(/thumb-cta-bar/)
    expect(equities).toMatch(/Fill last synced/)
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/markets-jump-unavailable/)
    expect(markets).toMatch(/unavailableCount/)
  })

  it('8–10: News filter + from-other-device + tag/Yield toggle', () => {
    saveNewsFilterTag('BTC')
    const exported = exportNewsFilterForBackup()
    expect(exported?.filterTag).toBe('BTC')
    mem.clear()
    importNewsFilterFromBackup(exported)
    expect(exportNewsFilterForBackup()?.filterTag).toBe('BTC')
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/holdings-from-other-device/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Show Markets tag \+ Yield/)
    const pref = readFileSync(resolve(__dirname, '../domain/marketsTagYieldPref.ts'), 'utf8')
    expect(pref).toMatch(/loadShowMarketsTagYieldChips/)
  })

  it('11–15: thumb CTAs + PTR expand + bottom-nav sync', () => {
    for (const page of ['SpendingPage', 'LiabilitiesPage', 'Goals', 'TripsPage']) {
      const src = readFileSync(resolve(__dirname, `../pages/${page}.tsx`), 'utf8')
      expect(src).toMatch(/thumb-cta-bar/)
    }
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/\/liabilities/)
    expect(shell).toMatch(/\/history/)
    expect(shell).toMatch(/\/budgets/)
    expect(shell).toMatch(/\/import/)
    expect(shell).toMatch(/\/goals/)
    expect(shell).toMatch(/\/trips/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/\/spending/)
    expect(nav).toMatch(/\/settings/)
    expect(nav).toMatch(/syncNow\(\)/)
  })

  it('16–20: Todos persist, Jobs follow-up, debt pulse, WTD budgets, bills-due', () => {
    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(todos).toMatch(/mydsp_todos_quick_filter_v1/)
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(jobs).toMatch(/jobs-follow-up-chip/)
    expect(
      needsFollowUp({
        status: 'applied',
        appliedDate: '2026-01-01',
        interviews: [],
      } as unknown as JobApplication),
    ).toBe(true)
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-debt-pulse/)
    expect(dash).toMatch(/today-week-to-date-spend/)
    expect(dash).toMatch(/to=\"\/budgets\"/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/bottom-nav-bills-due/)
  })

  it('21–24: axe Family/Documents + smoke PTR + e2e + harness', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Family axe/)
    expect(a11y).toMatch(/Documents axe/)
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/Liabilities \/ Goals \/ Trips \/ History \/ Budgets \/ Import/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Spending and Liabilities routes render with thumb CTAs/)
    const self = readFileSync(resolve(__dirname, 'next25lSyncPrefsPolish.test.ts'), 'utf8')
    expect(self).toMatch(/next25l — sync prefs/)
  })

  it('docs: SYNC_SETUP matrix updated', () => {
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/Recurring sort preference \| Yes/)
    expect(docs).toMatch(/Holdings drift % threshold \| Yes/)
    expect(docs).toMatch(/Spending filters \| Yes/)
    expect(docs).toMatch(/News tag filter \| Yes/)
  })
})
