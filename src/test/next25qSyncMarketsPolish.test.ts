import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportMarketsTagYieldForBackup,
  importMarketsTagYieldFromBackup,
  loadShowMarketsTagYieldChips,
  saveShowMarketsTagYieldChips,
} from '../domain/marketsTagYieldPref'
import {
  exportSettingsRecentJumpsForBackup,
  importSettingsRecentJumpsFromBackup,
  loadRecentSettingsJumps,
  saveRecentSettingsJumps,
} from '../domain/settingsSearch'
import {
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'
import {
  exportLaunchPathForBackup,
  importLaunchPathFromBackup,
  loadLaunchPath,
  saveLaunchPath,
} from '../storage/launchPathStore'
import {
  _resetUiPanelsForTests,
  exportUiPanelsForBackup,
  importUiPanelsFromBackup,
  isUiPanelOpen,
  setUiPanelOpen,
} from '../storage/uiPanelsStore'

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

describe('next25q — sync / Markets / Today polish tip (1–25 → v1.2.87)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
    _resetUiPanelsForTests()
  })

  afterEach(() => {
    mem.clear()
    _resetUiPanelsForTests()
  })

  it('25: package + release notes are 1.2.83', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.87')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.87')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.87',
      '1.2.86',
      '1.2.85',
      '1.2.84',
      '1.2.83',
    ])
  })

  it('1: Launch path LWW sync', () => {
    saveLaunchPath('/markets')
    const local = exportLaunchPathForBackup()
    expect(local?.path).toBe('/markets')
    expect(local?.updatedAt).toBeTruthy()

    mem.clear()
    saveLaunchPath('/')
    importLaunchPathFromBackup({
      path: '/markets',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadLaunchPath()).toBe('/markets')

    const older = new Date(Date.now() - 60_000).toISOString()
    saveLaunchPath('/todos')
    importLaunchPathFromBackup({ path: '/crypto', updatedAt: older })
    expect(loadLaunchPath()).toBe('/todos')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importLaunchPathFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ launchPath: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Launch path/)
  })

  it('2: Markets tag/Yield chips visibility LWW', () => {
    saveShowMarketsTagYieldChips(true)
    const local = exportMarketsTagYieldForBackup()
    expect(local?.show).toBe(true)

    mem.clear()
    saveShowMarketsTagYieldChips(false)
    importMarketsTagYieldFromBackup({
      show: true,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadShowMarketsTagYieldChips()).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/marketsTagYield/)
    const flags = workspaceExtrasFlagsFromPreview({ marketsTagYield: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Markets tag\/Yield chips/)
  })

  it('3: Settings recent jumps LWW', () => {
    saveRecentSettingsJumps(['sync', 'prices'])
    const local = exportSettingsRecentJumpsForBackup()
    expect(local?.ids).toEqual(['sync', 'prices'])

    mem.clear()
    saveRecentSettingsJumps(['security'])
    importSettingsRecentJumpsFromBackup({
      ids: ['sync', 'prices'],
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadRecentSettingsJumps()).toEqual(['sync', 'prices'])

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/settingsRecentJumps|importSettingsRecentJumpsFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ settingsRecentJumps: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Settings jumps/)
  })

  it('4: UI panels open/collapsed LWW', () => {
    setUiPanelOpen('todos-filters', true)
    const local = exportUiPanelsForBackup()
    expect(local?.panels['todos-filters']).toBe(true)

    mem.clear()
    _resetUiPanelsForTests()
    setUiPanelOpen('todos-filters', false)
    importUiPanelsFromBackup({
      panels: { 'todos-filters': true },
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(isUiPanelOpen('todos-filters')).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importUiPanelsFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ uiPanels: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/UI panels/)
  })

  it('5: Docs + SYNC_SMOKE + What arrived extras', () => {
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/Launch path/)
    expect(setup).toMatch(/UI panel/)
    expect(setup).toMatch(/Markets tag \+ Yield/)
    expect(setup).toMatch(/Settings recent jumps/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Launch path \+ UI panels/)
    expect(smoke).toMatch(/Markets tag\/Yield \+ Settings jumps/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Launch path, UI panels, Markets tag\/Yield chips, Settings/)
  })

  it('6–10: Markets undo · quote Edit · stale strip · Settings Prices hint', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-undo-banner/)
    expect(page).toMatch(/markets-undo-remove/)
    expect(page).toMatch(/markets-quote-edit/)
    expect(page).toMatch(/Edit ticker/)
    expect(page).toMatch(/markets-quote-nw-badge/)
    expect(page).toMatch(/markets-section-stale/)
    expect(page).toMatch(/Retry stale quotes/)
    expect(page).toMatch(/markets-tag-yield-settings-hint/)
    expect(page).toMatch(/Settings → Prices/)
  })

  it('11–15: FIRE/Optimizer/API thumbs · PTR · long-press Sync', () => {
    for (const file of [
      'FirePage.tsx',
      'OptimizerPage.tsx',
      'ApiAutomationPage.tsx',
      'SmartInsightsPage.tsx',
      'PredictiveAnalyticsPage.tsx',
      'MonthlyReviewPage.tsx',
      'JobDetailPage.tsx',
      'LiabilityDetailPage.tsx',
      'SmokePage.tsx',
    ]) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/thumb-cta-bar/)
    }
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/pathname === '\/fire'/)
    expect(shell).toMatch(/pathname === '\/optimizer'/)
    expect(shell).toMatch(/pathname === '\/achievements'/)
    expect(shell).toMatch(/pathname === '\/api'/)
    expect(shell).toMatch(/pathname === '\/insights'/)
    expect(shell).toMatch(/pathname === '\/review'/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/item\.to === '\/staking'/)
    expect(nav).toMatch(/item\.to === '\/fire'/)
    expect(nav).toMatch(/item\.to === '\/optimizer'/)
    expect(nav).toMatch(/item\.to === '\/api'/)
    expect(nav).toMatch(/item\.to === '\/insights'/)
    expect(nav).toMatch(/item\.to === '\/review'/)
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/FIRE \/ Optimizer \/ Achievements \/ API \/ Insights \/ Review/)
  })

  it('16–20: What arrived dismiss · All caught up · jump chips · offline queue · focus pulse', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-what-arrived-chip/)
    expect(dash).toMatch(/today-what-arrived-dismiss/)
    expect(dash).toMatch(/settings#sync/)
    expect(dash).toMatch(/today-news-all-caught-up/)
    expect(dash).toMatch(/today-youtube-all-caught-up/)
    expect(dash).toMatch(/today-section-jump-chip/)
    expect(dash).toMatch(/today-media/)
    expect(dash).toMatch(/today-markets/)
    expect(dash).toMatch(/today-offline-queue-chip/)
    expect(dash).toMatch(/today-focus-pulse/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.today-focus-pulse/)
  })

  it('21–24: axe Today offline / Markets tag hint / Legacy import + e2e thumbs/PTR/launch', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Today offline-queue chip axe/)
    expect(a11y).toMatch(/Markets tag\/Yield hint axe/)
    expect(a11y).toMatch(/Legacy import axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/FIRE and Optimizer thumb CTAs/)
    expect(e2e).toMatch(/smoke PTR includes FIRE Optimizer/)
    expect(e2e).toMatch(/launch path preference persists/)
  })
})
