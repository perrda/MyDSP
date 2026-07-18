import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import type { JobApplication } from '../domain/job-types'
import { buildNextActionStack } from '../domain/nextActionStack'
import {
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'
import {
  addMarketTicker,
  exportMarketsForBackup,
  importMarketsFromBackup,
  listMarketTickers,
  loadMarketsState,
  removeMarketTicker,
} from '../storage/marketsStore'
import {
  exportNavLayoutForBackup,
  importNavLayoutFromBackup,
  saveNavLayout,
} from '../storage/navOrder'
import {
  addNewsTag,
  exportNewsForBackup,
  getNewsSeenAt,
  importNewsFromBackup,
  listNewsTags,
  loadNewsState,
  setNewsSeenAt,
} from '../storage/newsStore'
import {
  addYoutubeChannel,
  exportYoutubeForBackup,
  getYoutubeSeenAt,
  importYoutubeFromBackup,
  listYoutubeChannels,
  setYoutubeSeenAt,
} from '../storage/youtubeStore'
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

describe('next25p — sync / Markets / Today polish tip (1–25 → v1.2.81)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.81', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.81')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.81')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.81',
      '1.2.80',
      '1.2.79',
      '1.2.78',
      '1.2.77',
    ])
  })

  it('1: News tags union + prefs/seenAt LWW', () => {
    addNewsTag({ tag: 'AAPL', label: 'Apple' })
    setNewsSeenAt('2026-07-01T00:00:00.000Z')
    const local = exportNewsForBackup()
    expect(local.prefsUpdatedAt).toBeTruthy()

    mem.clear()
    addNewsTag({ tag: 'MSFT', label: 'Microsoft' })
    setNewsSeenAt('2026-06-01T00:00:00.000Z')
    importNewsFromBackup({
      ...local,
      prefsUpdatedAt: new Date(Date.now() + 60_000).toISOString(),
      seenAt: '2026-07-10T00:00:00.000Z',
      collapsed: { top: true, tagged: false },
    })
    const tags = listNewsTags().map((t) => t.tag).sort()
    expect(tags).toEqual(['AAPL', 'MSFT'])
    expect(getNewsSeenAt()).toBe('2026-07-10T00:00:00.000Z')
    expect(loadNewsState().collapsed?.top).toBe(true)
  })

  it('2: YouTube channels union + seenAt LWW', () => {
    addYoutubeChannel({
      channelId: 'UC_local',
      title: 'Local',
      url: 'https://www.youtube.com/channel/UC_local',
    })
    setYoutubeSeenAt('2026-07-01T00:00:00.000Z')
    const local = exportYoutubeForBackup()

    mem.clear()
    addYoutubeChannel({
      channelId: 'UC_device',
      title: 'Device',
      url: 'https://www.youtube.com/channel/UC_device',
    })
    setYoutubeSeenAt('2026-06-01T00:00:00.000Z')
    importYoutubeFromBackup({
      ...local,
      prefsUpdatedAt: new Date(Date.now() + 60_000).toISOString(),
      seenAt: '2026-07-12T00:00:00.000Z',
    })
    const ids = listYoutubeChannels().map((c) => c.channelId).sort()
    expect(ids).toContain('UC_local')
    expect(ids).toContain('UC_device')
    expect(getYoutubeSeenAt()).toBe('2026-07-12T00:00:00.000Z')
  })

  it('3–4: Favourites layout LWW + What arrived extras', () => {
    saveNavLayout(
      {
        version: 1,
        favourites: ['/news', '/youtube'],
        others: ['/jobs'],
        othersCollapsed: true,
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      { fromSync: true },
    )
    const older = exportNavLayoutForBackup()
    saveNavLayout(
      {
        version: 1,
        favourites: ['/markets', '/tax'],
        others: ['/jobs'],
        othersCollapsed: false,
        updatedAt: '2026-07-10T00:00:00.000Z',
      },
      { fromSync: true },
    )
    importNavLayoutFromBackup(older)
    expect(exportNavLayoutForBackup()?.favourites).toEqual(['/markets', '/tax'])

    const flags = workspaceExtrasFlagsFromPreview({ navLayout: older })
    expect(flags.navLayout).toBe(true)
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Favourites layout/)
  })

  it('5: SYNC_SETUP + SYNC_SMOKE Favourites / seenAt / tombstones / clear ISA', () => {
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/Favourites\/nav layout/)
    expect(docs).toMatch(/deletion tombstones/)
    expect(docs).toMatch(/prefsUpdatedAt/)
    expect(docs).toMatch(/seenAt LWW/)
    expect(docs).toMatch(/clearing syncs via empty remaining/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Favourites LWW/)
    expect(smoke).toMatch(/deletion tombstones/)
    expect(smoke).toMatch(/seenAt LWW/)
    expect(smoke).toMatch(/Clear ISA override/)
  })

  it('6: Markets ticker deletion tombstones', () => {
    const row = addMarketTicker({ kind: 'equity', symbol: 'ZZTOP', name: 'ZZ Top' })
    expect(listMarketTickers('equity').some((t) => t.id === row.id)).toBe(true)
    removeMarketTicker(row.id)
    expect(listMarketTickers('equity').some((t) => t.id === row.id)).toBe(false)
    const tomb = loadMarketsState().deletedTickers ?? []
    expect(tomb.some((d) => d.key === 'equity:ZZTOP')).toBe(true)

    const exported = exportMarketsForBackup()
    mem.clear()
    addMarketTicker({ kind: 'equity', symbol: 'ZZTOP', name: 'ZZ Top again' })
    importMarketsFromBackup(exported)
    expect(listMarketTickers('equity').some((t) => t.symbol === 'ZZTOP')).toBe(false)
  })

  it('7–10: Markets thumbs · keyboard rows · retry aria · jump aria-controls', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/Add commodity/)
    expect(page).toMatch(/Add FX/)
    expect(page).toMatch(/Add index/)
    expect(page).toMatch(/tabIndex=\{0\}/)
    expect(page).toMatch(/onKeyDown/)
    expect(page).toMatch(/Retry \$\{unavailableCount\} unavailable in \$\{SECTION_JUMP_LABEL\[section\]\}/)
    expect(page).toMatch(/aria-controls=\{`markets-section-\$\{section\}`\}/)
    expect(page).toMatch(/role=\"tabpanel\"/)
  })

  it('11–15: Settings/Today/Staking/Planning/Achievements thumbs · PTR · long-press', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/thumb-cta-bar/)
    expect(settings).toMatch(/Sync now/)
    expect(settings).toMatch(/Smoke checklist/)
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/Primary today actions/)
    expect(dash).toMatch(/Sync now/)
    expect(dash).toMatch(/>\s*Markets\s*</)
    expect(dash).toMatch(/>\s*Digest\s*</)
    expect(dash).toMatch(/To Do/)
    const staking = readFileSync(resolve(__dirname, '../pages/StakingPage.tsx'), 'utf8')
    const planning = readFileSync(resolve(__dirname, '../pages/PlanningPage.tsx'), 'utf8')
    const achievements = readFileSync(resolve(__dirname, '../pages/AchievementsPage.tsx'), 'utf8')
    expect(staking).toMatch(/thumb-cta-bar/)
    expect(planning).toMatch(/thumb-cta-bar/)
    expect(achievements).toMatch(/thumb-cta-bar/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/pathname === '\/settings'/)
    expect(shell).toMatch(/pathname === '\/staking'/)
    expect(shell).toMatch(/pathname === '\/planning'/)
    expect(shell).toMatch(/pathname === '\/smoke'/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/item\.to === '\/history'/)
    expect(nav).toMatch(/item\.to === '\/budgets'/)
    expect(nav).toMatch(/item\.to === '\/import'/)
    expect(nav).toMatch(/item\.to === '\/family'/)
    expect(nav).toMatch(/item\.to === '\/documents'/)
    expect(nav).toMatch(/item\.to === '\/journal'/)
    expect(nav).toMatch(/item\.to === '\/rules'/)
  })

  it('16–20: refresh=1 · What arrived · Mark all read toast · follow-up · bill actions', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/\/news\?refresh=1/)
    expect(dash).toMatch(/\/youtube\?refresh=1/)
    expect(dash).toMatch(/today-what-arrived-chip/)
    expect(dash).toMatch(/News marked all read/)
    expect(dash).toMatch(/YouTube marked all read/)
    expect(dash).toMatch(/Bill marked paid/)
    expect(dash).toMatch(/Bill skipped/)
    expect(dash).toMatch(/Open recurring/)
    expect(dash).toMatch(/today-followup-next-action/)
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(news).toMatch(/searchParams\.get\('refresh'\) !== '1'/)
    expect(yt).toMatch(/searchParams\.get\('refresh'\) !== '1'/)
    const staleJob = {
      id: 7,
      companyName: 'Acme',
      jobTitle: 'Eng',
      status: 'applied',
      appliedDate: '2026-01-01',
      priority: 'medium',
      source: 'LinkedIn',
      salaryCurrency: 'GBP',
      salaryPeriod: 'annual',
      location: 'Remote',
      remote: 'remote',
      jobType: 'full-time',
      customDocuments: [],
      interviews: [],
      notes: [],
      tasks: [],
      contacts: [],
      tags: [],
      rating: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as JobApplication
    const stack = buildNextActionStack({
      todoItems: [],
      recurringTransactions: [],
      jobApplications: [staleJob],
      movers: [],
      now: new Date('2026-07-13T12:00:00.000Z'),
    })
    expect(stack.some((c) => c.kind === 'followup')).toBe(true)
  })

  it('21–24: axe Predictive/Insights/API/Review/Smoke/Job+Liability + e2e thumbs', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Predictive axe/)
    expect(a11y).toMatch(/Insights axe/)
    expect(a11y).toMatch(/API axe/)
    expect(a11y).toMatch(/Review axe/)
    expect(a11y).toMatch(/Smoke axe/)
    expect(a11y).toMatch(/Job detail axe/)
    expect(a11y).toMatch(/Liability detail axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Today and Settings thumb CTAs/)
    expect(e2e).toMatch(/News refresh=1 query is consumed/)
    expect(e2e).toMatch(/smoke PTR includes Settings Staking Planning/)
  })
})
