import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportGlassModeForBackup,
  importGlassModeFromBackup,
  saveGlassModePref,
} from '../domain/glassModePref'
import {
  exportLargeTextForBackup,
  importLargeTextFromBackup,
  saveLargeTextPref,
} from '../domain/largeTextPref'
import {
  exportThemePrefForBackup,
  importThemePrefFromBackup,
  loadThemePreference,
  saveThemePreference,
} from '../domain/themePref'
import {
  exportA11yPrefsForBackup,
  importA11yPrefsFromBackup,
  saveA11yReducedMotionPref,
} from '../domain/a11yPrefsPref'
import { loadA11yReducedMotion } from '../utils/a11yPrefs'
import { loadGlassMode } from '../utils/glassMode'
import { loadLargeText } from '../utils/largeText'
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

describe('next25u — sync / Markets / Today polish tip (1–25 → v1.2.87)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.87', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.100')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.100')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.100',
      '1.2.99',
      '1.2.98',
      '1.2.97',
      '1.2.96',
    ])
  })

  it('1: Glass mode LWW', () => {
    saveGlassModePref(true)
    const local = exportGlassModeForBackup()
    expect(local?.on).toBe(true)

    mem.clear()
    saveGlassModePref(false)
    importGlassModeFromBackup({
      on: true,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadGlassMode()).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importGlassModeFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ glassMode: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Glass mode/)
  })

  it('2: Large text LWW', () => {
    saveLargeTextPref(true)
    const local = exportLargeTextForBackup()
    expect(local?.on).toBe(true)

    mem.clear()
    saveLargeTextPref(false)
    importLargeTextFromBackup({
      on: true,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadLargeText()).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importLargeTextFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ largeText: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Large text/)
  })

  it('3: Theme preference LWW', () => {
    saveThemePreference('light')
    const local = exportThemePrefForBackup()
    expect(local?.preference).toBe('light')

    mem.clear()
    saveThemePreference('dark')
    importThemePrefFromBackup({
      preference: 'light',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadThemePreference()).toBe('light')

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importThemePrefFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ themePref: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Theme preference/)
  })

  it('4: Accessibility prefs LWW', () => {
    saveA11yReducedMotionPref(true)
    const local = exportA11yPrefsForBackup()
    expect(local?.reducedMotion).toBe(true)

    mem.clear()
    saveA11yReducedMotionPref(false)
    importA11yPrefsFromBackup({
      reducedMotion: true,
      highContrast: false,
      chartColourBlind: false,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(loadA11yReducedMotion()).toBe(true)

    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importA11yPrefsFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ a11yPrefs: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Accessibility prefs/)
  })

  it('5: Docs + SYNC_SMOKE + What arrived extras', () => {
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/Glass mode/)
    expect(setup).toMatch(/Large text/)
    expect(setup).toMatch(/Theme preference/)
    expect(setup).toMatch(/Accessibility prefs/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Glass mode \+ Large text \+ Theme \+ Accessibility/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Glass mode/)
    expect(settings).toMatch(/Large text/)
    expect(settings).toMatch(/Theme preference/)
    expect(settings).toMatch(/Accessibility prefs/)
  })

  it('6–10: Markets sticky filters · Copy % · timeframe · tag filter · Undo retag', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-sticky-filters/)
    expect(page).toMatch(/markets-quote-copy-change/)
    expect(page).toMatch(/markets-timeframe/)
    expect(page).toMatch(/markets-tag-filter/)
    expect(page).toMatch(/markets-undo-retag/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/markets-sticky-filters/)
  })

  it('11–15: Liabilities/Tax Sync · sticky RAG/Journal/Recurring · bottom-nav Docs/Journal', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/liabilities-sticky-rag/)
    expect(css).toMatch(/journal-sticky-filter/)
    expect(css).toMatch(/recurring-sticky-sort/)
    const slots = readFileSync(resolve(__dirname, '../storage/bottomNavSlots.ts'), 'utf8')
    expect(slots).toMatch(/\/documents/)
    expect(slots).toMatch(/\/journal/)
    for (const file of [
      'LiabilitiesPage.tsx',
      'TaxPage.tsx',
      'JournalPage.tsx',
      'RecurringPage.tsx',
    ]) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).not.toMatch(/^\s*Sync now\s*$/m)
      expect(src).toMatch(/thumb-cta-bar/)
    }
    const liab = readFileSync(resolve(__dirname, '../pages/LiabilitiesPage.tsx'), 'utf8')
    expect(liab).toMatch(/liabilities-sticky-rag/)
    const journal = readFileSync(resolve(__dirname, '../pages/JournalPage.tsx'), 'utf8')
    expect(journal).toMatch(/journal-sticky-filter/)
    const recurring = readFileSync(resolve(__dirname, '../pages/RecurringPage.tsx'), 'utf8')
    expect(recurring).toMatch(/recurring-sticky-sort/)
  })

  it('16–20: focus/bill/interview Undo testids · Mark-all Undo · Budget/Cash runway', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-focus-undo/)
    expect(dash).toMatch(/today-bill-undo/)
    expect(dash).toMatch(/today-interview-undo/)
    expect(dash).toMatch(/today-news-mark-all-undo/)
    expect(dash).toMatch(/today-youtube-mark-all-undo/)
    expect(dash).toMatch(/today-budget-pulse/)
    expect(dash).toMatch(/today-cash-runway/)
  })

  it('21–24: axe sticky filters / Mark-all Undo / Liabilities RAG + e2e thumbs', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Markets sticky filters axe/)
    expect(a11y).toMatch(/Markets Copy % axe/)
    expect(a11y).toMatch(/Today focus Undo axe/)
    expect(a11y).toMatch(/Today News Mark-all Undo axe/)
    expect(a11y).toMatch(/Liabilities sticky RAG axe/)
    expect(a11y).toMatch(/Journal sticky filter axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Liabilities and Tax Sync thumbs/)
    expect(e2e).toMatch(/Markets sticky filters/)
    expect(e2e).toMatch(/Today Mark-all Undo/)
  })
})
