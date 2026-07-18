import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  exportJobsFilterForBackup,
  importJobsFilterFromBackup,
  saveJobsFilter,
} from '../domain/jobsFilterPrefs'
import { NEWS_GOOGLE_ALLOWLIST_PROBE } from '../domain/smokeChecks'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportTodosQuickFilterForBackup,
  importTodosQuickFilterFromBackup,
  saveTodosQuickFilter,
} from '../domain/todosQuickFilterPrefs'
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

describe('next25n — sync / Markets / Today polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.80', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.80')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.80')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.80',
      '1.2.79',
      '1.2.78',
      '1.2.77',
      '1.2.76',
    ])
  })

  it('1: Todos quick-filter LWW sync', () => {
    saveTodosQuickFilter('today')
    const exported = exportTodosQuickFilterForBackup()
    expect(exported?.filter).toBe('today')
    mem.clear()
    importTodosQuickFilterFromBackup(exported)
    expect(exportTodosQuickFilterForBackup()?.filter).toBe('today')
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/todosQuickFilter/)
    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(todos).toMatch(/todosQuickFilterPrefs/)
  })

  it('2: YouTube upload-alert documented device-local', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/YouTube upload alert toggle/)
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/YouTube upload-alert toggle/)
    expect(docs).toMatch(/device-local/)
  })

  it('3: YouTube empty favourites keep last-good', () => {
    const page = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(page).toMatch(/list\.length === 0/)
    expect(page).toMatch(/applyCacheToState\(\)/)
    expect(page).not.toMatch(/list\.length === 0[\s\S]{0,120}setVideos\(\[\]\)/)
  })

  it('4: SYNC_SMOKE News/YouTube cross-device step', () => {
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/News \/ YouTube cross-device/)
    expect(smoke).toMatch(/last-good headlines/)
  })

  it('5: Jobs follow-up filter LWW sync', () => {
    saveJobsFilter('follow-up')
    const exported = exportJobsFilterForBackup()
    expect(exported?.filterBy).toBe('follow-up')
    mem.clear()
    importJobsFilterFromBackup(exported)
    expect(exportJobsFilterForBackup()?.filterBy).toBe('follow-up')
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(jobs).toMatch(/saveJobsFilter/)
    expect(jobs).toMatch(/jobs-follow-up-chip/)
    const flags = workspaceExtrasFlagsFromPreview({
      todosQuickFilter: { filter: 'today' },
      jobsFilter: { filterBy: 'follow-up' },
    })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Todos quick filter/)
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Jobs filter/)
  })

  it('6–10: Markets jump retry · search select · report · commodity · tablist', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-jump-unavailable/)
    expect(page).toMatch(/refreshSection\(section\)/)
    expect(page).toMatch(/mydsp_markets_sync_prices_report_v1/)
    expect(page).toMatch(/setFocusSymbol\(hit\.symbol\)/)
    expect(page).toMatch(/commodity-qty-hint|commodity-cost-hint/)
    expect(page).toMatch(/role=\"tablist\"/)
    expect(page).toMatch(/role=\"tab\"/)
    expect(page).toMatch(/ArrowRight/)
  })

  it('11–15: mobile Notify · long-press sync · PTR · thumb · YT datetime', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.youtube-notify-chip/)
    expect(css).not.toMatch(/\.youtube-notify-chip\s*\{\s*display:\s*none/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/item\.to === '\/recurring'/)
    expect(nav).toMatch(/item\.to === '\/tax'/)
    expect(nav).toMatch(/item\.to === '\/compare'/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/pathname === '\/family'/)
    expect(shell).toMatch(/pathname === '\/documents'/)
    const history = readFileSync(resolve(__dirname, '../pages/HistoryPage.tsx'), 'utf8')
    const budgets = readFileSync(resolve(__dirname, '../pages/BudgetsPage.tsx'), 'utf8')
    const imp = readFileSync(resolve(__dirname, '../pages/EnhancedImportPage.tsx'), 'utf8')
    expect(history).toMatch(/thumb-cta-bar/)
    expect(budgets).toMatch(/thumb-cta-bar/)
    expect(imp).toMatch(/thumb-cta-bar/)
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(yt).toMatch(/formatDateTime\(lastAt\)/)
  })

  it('16–20: Today Mark all read · media trust · tick · sidebar · From Owned', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-news-mark-all-read/)
    expect(dash).toMatch(/today-youtube-mark-all-read/)
    expect(dash).toMatch(/today-media-trust/)
    expect(dash).toMatch(/relativeTick/)
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/sidebar-unread/)
    expect(sidebar).toMatch(/newsUnreadFromCache/)
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/firstAdded/)
    expect(news).toMatch(/saveNewsFilterTag\(firstAdded\)/)
    expect(news).toMatch(/relativeTick/)
  })

  it('21–24: Google soft allowlist · e2e News · axe Journal/Rules/Equities', () => {
    expect(NEWS_GOOGLE_ALLOWLIST_PROBE).toMatch(/news\.google\.com/)
    const smokeChecks = readFileSync(resolve(__dirname, '../domain/smokeChecks.ts'), 'utf8')
    expect(smokeChecks).toMatch(/probeQuoteWorkerNewsGoogleAllowlist/)
    const smokePage = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smokePage).toMatch(/Worker Google News soft allowlist/)
    const e2eSmoke = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2eSmoke).toMatch(/News status strip shows Yahoo/)
    expect(e2eSmoke).toMatch(/news-status-strip/)
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Journal axe/)
    expect(a11y).toMatch(/Rules axe/)
    expect(a11y).toMatch(/Equities holding detail axe/)
  })
})
