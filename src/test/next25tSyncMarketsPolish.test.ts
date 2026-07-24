import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportTodosSortForBackup,
  importTodosSortFromBackup,
  loadTodosSort,
  saveTodosSort,
} from '../domain/todosSortPrefs'
import {
  exportJobsViewForBackup,
  importJobsViewFromBackup,
  loadJobsView,
  saveJobsView,
} from '../domain/jobsViewPrefs'
import {
  exportLiabilitiesRagForBackup,
  importLiabilitiesRagFromBackup,
  loadLiabilitiesRagFilter,
  saveLiabilitiesRagFilter,
} from '../domain/liabilitiesRagPref'
import {
  exportReviewMonthForBackup,
  importReviewMonthFromBackup,
  loadReviewMonthPref,
  saveReviewMonthPref,
} from '../domain/reviewMonthPref'
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

describe('next25t — sync / Markets / Today polish tip (1–25 → v1.2.87)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
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

  it('1: Todos sort LWW', () => {
    saveTodosSort('priority-desc')
    const local = exportTodosSortForBackup()
    expect(local?.sortBy).toBe('priority-desc')

    mem.clear()
    saveTodosSort('title-asc')
    importTodosSortFromBackup({
      sortBy: 'priority-desc',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadTodosSort()).toBe('priority-desc')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importTodosSortFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ todosSort: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Todos sort/)
  })

  it('2: Jobs viewMode + sort LWW', () => {
    saveJobsView({ viewMode: 'list', sortBy: 'salary-desc' })
    const local = exportJobsViewForBackup()
    expect(local?.viewMode).toBe('list')
    expect(local?.sortBy).toBe('salary-desc')

    mem.clear()
    saveJobsView({ viewMode: 'kanban', sortBy: 'updated-desc' })
    importJobsViewFromBackup({
      viewMode: 'list',
      sortBy: 'salary-desc',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadJobsView()).toEqual({ viewMode: 'list', sortBy: 'salary-desc' })

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importJobsViewFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ jobsView: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Jobs view/)
  })

  it('3: Liabilities RAG filter LWW', () => {
    saveLiabilitiesRagFilter('amber')
    const local = exportLiabilitiesRagForBackup()
    expect(local?.ragFilter).toBe('amber')

    mem.clear()
    saveLiabilitiesRagFilter('red')
    importLiabilitiesRagFromBackup({
      ragFilter: 'amber',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadLiabilitiesRagFilter()).toBe('amber')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importLiabilitiesRagFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ liabilitiesRag: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Liabilities RAG/)
  })

  it('4: Review month LWW', () => {
    saveReviewMonthPref('2026-03')
    const local = exportReviewMonthForBackup()
    expect(local?.ym).toBe('2026-03')

    mem.clear()
    saveReviewMonthPref('2026-01')
    importReviewMonthFromBackup({
      ym: '2026-03',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadReviewMonthPref()).toBe('2026-03')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importReviewMonthFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ reviewMonth: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Review month/)
  })

  it('5: Docs + SYNC_SMOKE + What arrived extras', () => {
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/Todos sort/)
    expect(setup).toMatch(/Jobs viewMode/)
    expect(setup).toMatch(/Liabilities RAG/)
    expect(setup).toMatch(/Monthly Review month/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Todos sort \+ Jobs view \+ Liabilities RAG \+ Review month/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Todos sort/)
    expect(settings).toMatch(/Jobs view/)
    expect(settings).toMatch(/Liabilities RAG/)
    expect(settings).toMatch(/Review month/)
  })

  it('6–10: Markets Yield-sort · Edit · Undo · Add-from-holding · Copy price/Share', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-yield-sort/)
    expect(page).toMatch(/markets-quote-edit/)
    expect(page).toMatch(/markets-undo-remove/)
    expect(page).toMatch(/markets-add-from-holding-thumb/)
    expect(page).toMatch(/markets-quote-copy-price/)
    expect(page).toMatch(/markets-quote-share/)
  })

  it('11–15: Budgets/History Sync · Spending/News sticky · bottom-nav · Todos/Jobs Sync', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/spending-sticky-month/)
    expect(css).toMatch(/news-sticky-filters/)
    const slots = readFileSync(resolve(__dirname, '../storage/bottomNavSlots.ts'), 'utf8')
    expect(slots).toMatch(/\/budgets/)
    expect(slots).toMatch(/\/history/)
    expect(slots).toMatch(/\/family/)
    for (const file of ['BudgetsPage.tsx', 'HistoryPage.tsx', 'TodosPage.tsx', 'JobsPage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).not.toMatch(/^\s*Sync now\s*$/m)
      expect(src).toMatch(/thumb-cta-bar/)
    }
    const spending = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(spending).toMatch(/spending-sticky-month/)
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/news-sticky-filters/)
  })

  it('16–20: follow-up Undo · Debt jump · Focus Snooze Undo · FIRE · scroll-spy', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-followup-undo/)
    expect(dash).toMatch(/today-section-jump-debt/)
    expect(dash).toMatch(/id=\"today-debt\"|id='today-debt'/)
    expect(dash).toMatch(/today-focus-snooze-undo/)
    expect(dash).toMatch(/today-fire-chip/)
    expect(dash).toMatch(/today-section-jump-chip--active/)
    const jobs = readFileSync(resolve(__dirname, '../domain/jobs.ts'), 'utf8')
    expect(jobs).toMatch(/follow-up/)
    expect(jobs).toMatch(/lastFollowUpNote|notes/)
  })

  it('21–24: axe Yield-sort / follow-up Undo / Tax sticky + e2e thumbs', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Markets Yield-sort axe/)
    expect(a11y).toMatch(/Today follow-up Undo axe/)
    expect(a11y).toMatch(/Today FIRE chip axe/)
    expect(a11y).toMatch(/Tax sticky toolbar axe/)
    expect(a11y).toMatch(/Review sticky month axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Budgets and History Sync thumbs/)
    expect(e2e).toMatch(/Spending sticky month/)
    expect(e2e).toMatch(/Markets Yield-sort/)
  })
})
