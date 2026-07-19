import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  collectSyncHighlights,
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'
import {
  exportBottomNavSlotsForBackup,
  importBottomNavSlotsFromBackup,
  saveBottomNavMiddleSlots,
} from '../storage/bottomNavSlots'
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

describe('next25o — sync / Markets / Today polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.80', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.82')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.82')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.82',
      '1.2.81',
      '1.2.80',
      '1.2.79',
      '1.2.78',
    ])
  })

  it('1: Bottom nav slots LWW sync + cloud extras', () => {
    saveBottomNavMiddleSlots(['/news', '/youtube', '/jobs'])
    const exported = exportBottomNavSlotsForBackup()
    expect(exported?.slots).toEqual(['/news', '/youtube', '/jobs'])
    mem.clear()
    importBottomNavSlotsFromBackup(exported)
    expect(exportBottomNavSlotsForBackup()?.slots).toEqual(['/news', '/youtube', '/jobs'])
    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/bottomNavSlots/)
    expect(sync).toMatch(/importBottomNavSlotsFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ bottomNavSlots: exported })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Bottom nav slots/)
  })

  it('2: Journal What arrived highlights', () => {
    const empty = {
      journal: [],
      todoItems: [],
      todoLists: [],
      jobApplications: [],
      goals: [],
      spending: [],
    } as unknown as PortfolioData
    const remote = {
      ...empty,
      journal: [{ id: 42 }],
    } as unknown as PortfolioData
    const map = collectSyncHighlights([{ local: empty, remote }])
    expect(map.journal).toEqual([42])
  })

  it('3–4: Markets density + collapsed LWW', () => {
    const store = readFileSync(resolve(__dirname, '../storage/marketsStore.ts'), 'utf8')
    expect(store).toMatch(/preferRemotePrefs/)
    expect(store).toMatch(/collapsedSrc/)
    expect(store).toMatch(/setMarketsCollapsed[\s\S]*touchPrefs/)
    expect(store).not.toMatch(
      /density === 'compact' \|\|\s*\n?\s*\(parsed as MarketsState\)\.density === 'compact'/,
    )
  })

  it('5: SYNC_SETUP + SYNC_SMOKE bottom-nav docs', () => {
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/Bottom nav middle slots/)
    expect(docs).toMatch(/Notification quiet-hours/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Bottom nav \+ filter prefs/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Bottom nav middle slots/)
  })

  it('6–10: Markets jump tablist · density thumb · as-of · paper NW · row tag', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-section-jump-chips[\s\S]*role=\"tablist\"/)
    expect(page).toMatch(/markets-density-thumb/)
    expect(page).toMatch(/formatMarketsRelative/)
    expect(page).toMatch(/Exclude from NW|Include in NW/)
    expect(page).toMatch(/markets-row-tag-filter/)
  })

  it('11–15: Family/Docs/Journal/Rules thumbs · PTR · long-press · holding', () => {
    const family = readFileSync(resolve(__dirname, '../pages/FamilyPage.tsx'), 'utf8')
    const docs = readFileSync(resolve(__dirname, '../pages/DocumentsPage.tsx'), 'utf8')
    const journal = readFileSync(resolve(__dirname, '../pages/JournalPage.tsx'), 'utf8')
    const rules = readFileSync(resolve(__dirname, '../pages/RulesPage.tsx'), 'utf8')
    const holding = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(family).toMatch(/thumb-cta-bar/)
    expect(docs).toMatch(/thumb-cta-bar/)
    expect(journal).toMatch(/thumb-cta-bar/)
    expect(rules).toMatch(/thumb-cta-bar/)
    expect(holding).toMatch(/thumb-cta-bar/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/pathname === '\/journal'/)
    expect(shell).toMatch(/pathname === '\/rules'/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/item\.to === '\/equities'/)
    expect(nav).toMatch(/item\.to === '\/crypto'/)
    expect(nav).toMatch(/item\.to === '\/liabilities'/)
    expect(nav).toMatch(/item\.to === '\/goals'/)
  })

  it('16–20: Today badges · sidebar bills · interview actions · Compare tick', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-todos-due-badge/)
    expect(dash).toMatch(/today-jobs-follow-up-badge/)
    expect(dash).toMatch(/today-interview-actions/)
    expect(dash).toMatch(/markInterviewDone/)
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/sidebar-bills-due/)
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/relativeTick/)
    expect(compare).toMatch(/compare-quote-sla-chip/)
  })

  it('21–24: axe Staking/Planning/FIRE/Optimizer/Analytics/Achievements + e2e', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Staking axe/)
    expect(a11y).toMatch(/Planning axe/)
    expect(a11y).toMatch(/FIRE axe/)
    expect(a11y).toMatch(/Optimizer axe/)
    expect(a11y).toMatch(/Analytics axe/)
    expect(a11y).toMatch(/Achievements axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Family and Documents thumb CTAs/)
    expect(e2e).toMatch(/Markets Compact density on thumb bar/)
    expect(e2e).toMatch(/smoke PTR includes Journal and Rules/)
  })
})
