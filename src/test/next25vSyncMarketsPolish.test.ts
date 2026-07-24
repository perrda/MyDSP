import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  exportNotificationSettingsForBackup,
  importNotificationSettingsFromBackup,
  touchNotificationSettingsMeta,
} from '../domain/notificationSettingsPref'
import { notificationManager } from '../utils/notifications'
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

describe('next25v — sync / Markets / Today polish tip (1–25 → v1.2.87)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
    notificationManager.applySettingsFromSync({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      categories: {},
      priorityThreshold: 'critical',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.87', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.98')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.98')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.98',
      '1.2.97',
      '1.2.96',
      '1.2.95',
      '1.2.94',
    ])
  })

  it('1: Quiet hours LWW', () => {
    notificationManager.updateSettings({ quietHoursStart: '21:00', quietHoursEnd: '06:00' })
    const local = exportNotificationSettingsForBackup()
    expect(local?.quietHoursStart).toBe('21:00')
    expect(local?.quietHoursEnd).toBe('06:00')

    mem.clear()
    notificationManager.applySettingsFromSync({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      categories: {},
      priorityThreshold: 'critical',
      quietHoursStart: '23:00',
      quietHoursEnd: '08:00',
    })
    touchNotificationSettingsMeta({ markDirty: false })
    importNotificationSettingsFromBackup({
      ...local!,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(notificationManager.getSettings().quietHoursStart).toBe('21:00')
    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/importNotificationSettingsFromBackup/)
    const flags = workspaceExtrasFlagsFromPreview({ notificationSettings: local })
    expect(summarizeWorkspaceExtras(flags)).toMatch(/Notification settings/)
  })

  it('2: Desktop banners preference LWW', () => {
    notificationManager.updateSettings({ desktopEnabled: true })
    const local = exportNotificationSettingsForBackup()
    expect(local?.desktopEnabled).toBe(true)

    mem.clear()
    notificationManager.applySettingsFromSync({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      categories: {},
      priorityThreshold: 'critical',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
    touchNotificationSettingsMeta({ markDirty: false })
    importNotificationSettingsFromBackup({
      ...local!,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(notificationManager.getSettings().desktopEnabled).toBe(true)
  })

  it('3: Sound toggle LWW', () => {
    notificationManager.updateSettings({ soundEnabled: true })
    const local = exportNotificationSettingsForBackup()
    expect(local?.soundEnabled).toBe(true)

    mem.clear()
    notificationManager.applySettingsFromSync({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      categories: {},
      priorityThreshold: 'critical',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
    touchNotificationSettingsMeta({ markDirty: false })
    importNotificationSettingsFromBackup({
      ...local!,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(notificationManager.getSettings().soundEnabled).toBe(true)
  })

  it('4: Category toggles LWW (YouTube uploads)', () => {
    notificationManager.updateSettings({ categories: { 'youtube-uploads': false } })
    const local = exportNotificationSettingsForBackup()
    expect(local?.categories['youtube-uploads']).toBe(false)

    mem.clear()
    notificationManager.applySettingsFromSync({
      enabled: true,
      soundEnabled: false,
      desktopEnabled: false,
      categories: { 'youtube-uploads': true },
      priorityThreshold: 'critical',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
    touchNotificationSettingsMeta({ markDirty: false })
    importNotificationSettingsFromBackup({
      ...local!,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(notificationManager.getSettings().categories['youtube-uploads']).toBe(false)
  })

  it('5: Docs + SYNC_SMOKE + What arrived extras', () => {
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/Notification settings/)
    expect(setup).toMatch(/Notification quiet hours/)
    expect(setup).toMatch(/Desktop banners preference/)
    expect(setup).toMatch(/Category toggles/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Notification settings/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Notification settings/)
    expect(settings).toMatch(/quiet hours/)
  })

  it('6–10: Markets Sort · Sections · Density · Sync prices · FX Undo', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-sort/)
    expect(page).toMatch(/markets-sections-sort/)
    expect(page).toMatch(/markets-density/)
    expect(page).toMatch(/markets-sync-prices/)
    expect(page).toMatch(/markets-fx-use-suggested/)
    expect(page).toMatch(/markets-undo-fx/)
  })

  it('11–15: Equities/Crypto/Spending/Family/Docs/Compare/Rules Sync · bottom-nav Rules/FIRE', () => {
    const slots = readFileSync(resolve(__dirname, '../storage/bottomNavSlots.ts'), 'utf8')
    expect(slots).toMatch(/\/rules/)
    expect(slots).toMatch(/\/fire/)
    for (const file of [
      'EquitiesPage.tsx',
      'CryptoPage.tsx',
      'SpendingPage.tsx',
      'FamilyPage.tsx',
      'DocumentsPage.tsx',
      'ComparePage.tsx',
      'RulesPage.tsx',
      'FirePage.tsx',
    ]) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).not.toMatch(/^\s*Sync now\s*$/m)
      expect(src).toMatch(/thumb-cta-bar/)
    }
  })

  it('16–20: Bill Skip Undo · WTD/Debt · Money pulse · jump Budget/FIRE/Runway · What arrived', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-bill-skip-undo/)
    expect(dash).toMatch(/today-wtd-spend/)
    expect(dash).toMatch(/today-debt-pulse/)
    expect(dash).toMatch(/today-money-pulse/)
    expect(dash).toMatch(/today-section-jump-budget/)
    expect(dash).toMatch(/today-section-jump-runway/)
    expect(dash).toMatch(/today-section-jump-fire/)
    expect(dash).toMatch(/today-what-arrived-open/)
    expect(dash).toMatch(/today-what-arrived-dismiss/)
  })

  it('21–24: axe Sort/Density · Skip Undo · Equities Sync + e2e', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Markets Sort axe/)
    expect(a11y).toMatch(/Markets Density axe/)
    expect(a11y).toMatch(/Today bill Skip Undo axe/)
    expect(a11y).toMatch(/Today What arrived axe/)
    expect(a11y).toMatch(/Equities Sync thumb axe/)
    expect(a11y).toMatch(/Compare sticky toolbar axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Equities and Crypto Sync thumbs/)
    expect(e2e).toMatch(/Markets Sort/)
    expect(e2e).toMatch(/Today bill Skip Undo/)
  })
})
