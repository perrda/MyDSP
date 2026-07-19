import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  exportCompareSelectionForBackup,
  importCompareSelectionFromBackup,
  saveCompareSelectedIds,
} from '../domain/compareSelectionPrefs'
import {
  exportDigestHighlightsForBackup,
  importDigestHighlightsFromBackup,
  saveDigestHighlightEdits,
} from '../domain/digestHighlightsPrefs'
import { buildNextActionStack } from '../domain/nextActionStack'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import type { JobApplication } from '../domain/job-types'

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

describe('next25k — sync / Markets / Today polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.80', () => {
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

  it('1: Quote Worker identity smoke', () => {
    const checks = readFileSync(resolve(__dirname, '../domain/smokeChecks.ts'), 'utf8')
    expect(checks).toMatch(/assertQuoteWorkerIdentity/)
    expect(checks).toMatch(/mydsp-quote/)
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/quote-identity/)
  })

  it('2: Settings Quote Worker fail → deploy:quote CTA', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/npm run deploy:quote/)
    expect(settings).toMatch(/Copied: npm run deploy:quote/)
  })

  it('3: DEPLOY.md / SYNC_SMOKE Worker-name docs', () => {
    const deploy = readFileSync(resolve(__dirname, '../../DEPLOY.md'), 'utf8')
    expect(deploy).toMatch(/deploy:quote/)
    expect(deploy).toMatch(/mydsp-quote/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/mydsp-quote/)
  })

  it('4: digest highlight edits sync LWW', () => {
    saveDigestHighlightEdits(['alpha', 'beta'])
    const exported = exportDigestHighlightsForBackup()
    expect(exported?.lines).toEqual(['alpha', 'beta'])
    mem.clear()
    importDigestHighlightsFromBackup(exported)
    expect(exportDigestHighlightsForBackup()?.lines).toEqual(['alpha', 'beta'])
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/digestHighlights/)
  })

  it('5: Compare portfolio selection sync LWW', () => {
    saveCompareSelectedIds(['p1', 'p2'])
    const exported = exportCompareSelectionForBackup()
    expect(exported?.ids).toEqual(['p1', 'p2'])
    mem.clear()
    importCompareSelectionFromBackup(exported)
    expect(exportCompareSelectionForBackup()?.ids).toEqual(['p1', 'p2'])
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compareSelectionPrefs/)
  })

  it('6: Jump-chip active section highlight (IntersectionObserver)', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/IntersectionObserver/)
    expect(page).toMatch(/activeJumpSection/)
    expect(page).toMatch(/markets-section-jump-chip--active/)
    expect(page).toMatch(/aria-current/)
  })

  it('7: Paper commodity NW chip on rows', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-paper-nw-chip/)
    expect(page).toMatch(/includeInNetWorth/)
  })

  it('8–10: sticky offsets + section under toolbar', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/holdings-sticky-search/)
    expect(css).toMatch(/--app-header-offset/)
    expect(css).toMatch(/markets-detail-sticky/)
    expect(css).toMatch(/markets-section-sticky/)
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/holdings-sticky-search/)
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/holdings-sticky-search/)
  })

  it('11: PTR Todos / Jobs / Spending', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/\/todos/)
    expect(shell).toMatch(/\/jobs/)
    expect(shell).toMatch(/\/spending/)
  })

  it('12: News / YouTube thumb CTA', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(news).toMatch(/thumb-cta-bar/)
    expect(yt).toMatch(/thumb-cta-bar/)
    expect(news).toMatch(/Primary news actions/)
    expect(yt).toMatch(/Primary YouTube actions/)
  })

  it('13: Bottom-nav long-press Todos/Jobs → Sync now', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/\/todos/)
    expect(nav).toMatch(/\/jobs/)
    expect(nav).toMatch(/syncNow\(\)/)
  })

  it('14: Jobs portrait sticky column jump chips', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.jobs-kanban-jump-chips \{[\s\S]*position: sticky/)
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(jobs).toMatch(/jobs-kanban-jump-chips/)
  })

  it('15: Today prices trust chips consolidate', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-prices-trust/)
    expect(dash).toMatch(/aria-label=\"Prices trust\"/)
  })

  it('16–17: Focus Open + News/YT Refresh & open', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/\/todos\?focus=/)
    expect(dash).toMatch(/today-news-refresh-open/)
    expect(dash).toMatch(/today-youtube-refresh-open/)
    expect(dash).toMatch(/\/news\?refresh=1/)
    expect(dash).toMatch(/\/youtube\?refresh=1/)
  })

  it('18–19: Bill Mark paid + interview next-action', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/Mark paid/)
    expect(dash).toMatch(/today-interview-next-action/)
    const stack = buildNextActionStack({
      jobApplications: [
        {
          id: 1,
          companyName: 'Acme',
          jobTitle: 'Engineer',
          status: 'interviewing',
          interviews: [
            {
              id: 1,
              scheduledDate: '2026-07-14',
              type: 'phone-screen',
              outcome: 'pending',
              interviewers: [],
              createdAt: '2026-07-01T00:00:00Z',
            },
          ],
        } as unknown as JobApplication,
      ],
      now: new Date('2026-07-13T12:00:00Z'),
    })
    expect(stack.some((c) => c.kind === 'interview')).toBe(true)
  })

  it('20: Todos Due today / High priority quick chips', () => {
    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(todos).toMatch(/todos-due-today-chip/)
    expect(todos).toMatch(/todos-high-priority-chip/)
    expect(todos).toMatch(/todos-quick-filter-chips/)
  })

  it('21–23: smoke PTR + axe History/Budgets + Markets sticky e2e', () => {
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/PTR YouTube \/ Tax \/ Compare \/ Todos \/ Jobs \/ Spending/)
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/History axe/)
    expect(a11y).toMatch(/Budgets axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Markets sticky toolbar and section jump chips/)
    expect(e2e).toMatch(/markets-sticky-toolbar/)
  })

  it('24: tip harness exists', () => {
    const self = readFileSync(resolve(__dirname, 'next25kSyncMarketsPolish.test.ts'), 'utf8')
    expect(self).toMatch(/next25k — sync \/ Markets \/ Today polish tip/)
  })
})
