import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportAchievementsSeenForBackup,
  importAchievementsSeenFromBackup,
  loadAchievementsSeenPref,
  saveAchievementsSeenPref,
} from '../domain/achievementsSeenPref'
import {
  exportGettingStartedDismissedForBackup,
  importGettingStartedDismissedFromBackup,
  loadGettingStartedDismissedPref,
  saveGettingStartedDismissedPref,
} from '../domain/gettingStartedDismissedPref'
import {
  exportWebhookUrlForBackup,
  importWebhookUrlFromBackup,
  loadWebhookUrlPref,
  saveWebhookUrlPref,
} from '../domain/webhookUrlPref'
import {
  exportWhatArrivedDismissForBackup,
  importWhatArrivedDismissFromBackup,
  loadWhatArrivedDismissPref,
  saveWhatArrivedDismissPref,
} from '../domain/whatArrivedDismissPref'
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

describe('next25s — sync / Markets / Today polish tip (1–25 → v1.2.87)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.87', () => {
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

  it('1: API webhook URL LWW', () => {
    saveWebhookUrlPref('https://hooks.example/mydsp')
    const local = exportWebhookUrlForBackup()
    expect(local?.url).toBe('https://hooks.example/mydsp')

    mem.clear()
    saveWebhookUrlPref('https://other.example')
    importWebhookUrlFromBackup({
      url: 'https://hooks.example/mydsp',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadWebhookUrlPref()).toBe('https://hooks.example/mydsp')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importWebhookUrlFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ webhookUrl: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/API webhook URL/)
  })

  it('2: Achievements seen LWW', () => {
    saveAchievementsSeenPref(new Set(['millionaire']))
    const local = exportAchievementsSeenForBackup()
    expect(local?.seen).toContain('millionaire')

    mem.clear()
    saveAchievementsSeenPref(new Set(['other']))
    importAchievementsSeenFromBackup({
      seen: ['millionaire'],
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadAchievementsSeenPref().has('millionaire')).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importAchievementsSeenFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ achievementsSeen: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Achievements seen/)
  })

  it('3: Getting started dismissed LWW', () => {
    saveGettingStartedDismissedPref(true)
    const local = exportGettingStartedDismissedForBackup()
    expect(local?.dismissed).toBe(true)

    mem.clear()
    saveGettingStartedDismissedPref(false)
    importGettingStartedDismissedFromBackup({
      dismissed: true,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadGettingStartedDismissedPref()).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importGettingStartedDismissedFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ gettingStartedDismissed: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Getting started dismissed/)
  })

  it('4: What arrived dismiss fingerprint LWW', () => {
    saveWhatArrivedDismissPref('Settings sections · Tax year')
    const local = exportWhatArrivedDismissForBackup()
    expect(local?.fingerprint).toMatch(/Settings sections/)

    mem.clear()
    saveWhatArrivedDismissPref('other')
    importWhatArrivedDismissFromBackup({
      fingerprint: 'Settings sections · Tax year',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadWhatArrivedDismissPref()).toBe('Settings sections · Tax year')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importWhatArrivedDismissFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ whatArrivedDismiss: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/What arrived dismiss/)
  })

  it('5: Docs + SYNC_SMOKE + What arrived extras', () => {
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/API webhook URL/)
    expect(setup).toMatch(/Achievements seen/)
    expect(setup).toMatch(/Getting started dismissed/)
    expect(setup).toMatch(/What arrived dismiss/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/API webhook \+ Achievements seen \+ Getting started \+ What arrived dismiss/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/API webhook URL/)
    expect(settings).toMatch(/Achievements seen/)
  })

  it('6–10: Markets Open holding · price alert · Expand/Collapse · Retag · back-online', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-quote-open-holding/)
    expect(page).toMatch(/markets-quote-price-alert/)
    expect(page).toMatch(/markets-expand-all/)
    expect(page).toMatch(/markets-collapse-all/)
    expect(page).toMatch(/markets-retag/)
    expect(page).toMatch(/markets-back-online-toast/)
  })

  it('11–15: sticky toolbars · Legacy PTR · Compare/Recurring/Review slots · Goals/Trips Sync', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/compare-sticky-toolbar/)
    expect(css).toMatch(/tax-sticky-toolbar/)
    expect(css).toMatch(/review-sticky-month/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/\/import\/legacy/)
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/Legacy import/)
    const slots = readFileSync(resolve(__dirname, '../storage/bottomNavSlots.ts'), 'utf8')
    expect(slots).toMatch(/\/compare/)
    expect(slots).toMatch(/\/recurring/)
    expect(slots).toMatch(/\/review/)
    for (const file of ['Goals.tsx', 'TripsPage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/Sync now/)
      expect(src).toMatch(/thumb-cta-bar/)
    }
  })

  it('16–20: bill/interview Undo · Tax jump · budget next-action · What arrived Open first', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-bill-undo/)
    expect(dash).toMatch(/today-interview-undo/)
    expect(dash).toMatch(/today-section-jump-tax/)
    expect(dash).toMatch(/id=\"today-tax\"|id='today-tax'/)
    expect(dash).toMatch(/budget-next-action/)
    expect(dash).toMatch(/today-what-arrived-open/)
    const stack = readFileSync(resolve(__dirname, '../domain/nextActionStack.ts'), 'utf8')
    expect(stack).toMatch(/budget/)
    const highlights = readFileSync(resolve(__dirname, '../services/sync/syncHighlights.ts'), 'utf8')
    expect(highlights).toMatch(/firstSyncHighlightHref/)
  })

  it('21–24: axe Expand-all / bill Undo / Tax jump + e2e thumbs', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Markets Expand-all axe/)
    expect(a11y).toMatch(/Today bill Undo axe/)
    expect(a11y).toMatch(/Today Tax jump axe/)
    expect(a11y).toMatch(/Compare sticky toolbar axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Goals and Trips Sync thumbs/)
    expect(e2e).toMatch(/Markets Expand-all/)
    expect(e2e).toMatch(/Today Tax jump chip/)
    expect(e2e).toMatch(/smoke PTR includes Legacy import/)
  })
})
