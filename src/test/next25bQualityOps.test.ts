import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  loadRecentSettingsJumps,
  rankSettingsSections,
  recordSettingsJump,
  scoreSettingsSection,
  SETTINGS_RECENT_KEY,
  settingsSectionLabel,
} from '../domain/settingsSearch'
import {
  buildHouseholdSnapshotContent,
  buildHouseholdSnapshotHtml,
} from '../domain/householdSnapshot'
import {
  isQuoteStaleForCachedMode,
  shouldShowCachedMode,
} from '../domain/marketsCachedMode'
import { RELEASE_NOTES, releaseNotesBullets } from '../domain/releaseNotes'
import type { MarketQuote } from '../domain/markets'

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

function quote(partial: Partial<MarketQuote> & { last: number }): MarketQuote {
  return {
    symbol: 'X',
    kind: 'equity',
    changeAbs: 0,
    changePct: 0,
    sparkline: [],
    unit: 'GBP',
    decimals: 2,
    source: 'yahoo',
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('next25b quality / ops (21–25)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('21: Settings fuzzy score + recent jumps chips', () => {
    expect(scoreSettingsSection('sync', 'sync', 'cloud passphrase')).toBeGreaterThan(
      scoreSettingsSection('sync', 'appearance', 'theme light dark'),
    )
    expect(scoreSettingsSection('pass', 'sync', 'Encrypted cloud sync passphrase')).toBeGreaterThan(
      0.7,
    )
    expect(scoreSettingsSection('alert', 'alerts', 'Notifications quiet hours')).toBeGreaterThan(
      scoreSettingsSection('alert', 'export', 'CSV JSON'),
    )

    const ids = ['sync', 'alerts', 'export', 'appearance'] as const
    const kw = {
      sync: 'Encrypted cloud sync passphrase',
      alerts: 'Notifications quiet hours price alerts',
      export: 'Export data CSV JSON',
      appearance: 'Light dark glass mode theme',
    }
    const ranked = rankSettingsSections('notif', ids, kw)
    expect(ranked[0]?.id).toBe('alerts')

    expect(loadRecentSettingsJumps()).toEqual([])
    expect(recordSettingsJump('sync')).toEqual(['sync'])
    expect(recordSettingsJump('alerts')).toEqual(['alerts', 'sync'])
    expect(recordSettingsJump('sync')).toEqual(['sync', 'alerts'])
    expect(mem.get(SETTINGS_RECENT_KEY)).toContain('sync')
    expect(settingsSectionLabel('full-backup')).toBe('Full Backup')

    const page = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(page).toMatch(/rankSettingsSections/)
    expect(page).toMatch(/recordSettingsJump/)
    expect(page).toMatch(/settings-recent-jumps/)
    expect(page).toMatch(/Recent/)
  })

  it('22: Household snapshot PDF HTML + Compare button', () => {
    const content = buildHouseholdSnapshotContent({
      netWorth: 100_000,
      assets: 120_000,
      liabilities: 20_000,
      crypto: 30_000,
      equity: 90_000,
      portfolios: [
        { name: 'David', netWorth: 80_000 },
        { name: 'Family', netWorth: 20_000 },
      ],
      generatedAt: new Date('2026-07-15T12:00:00Z'),
    })
    expect(content).toMatch(/Household snapshot/)
    expect(content).toMatch(/Net worth/)
    expect(content).toMatch(/Allocation/)
    expect(content).toMatch(/Equities/)
    expect(content).toMatch(/Crypto/)
    expect(content).toMatch(/David/)

    const html = buildHouseholdSnapshotHtml({
      netWorth: 50_000,
      assets: 50_000,
      liabilities: 0,
      crypto: 10_000,
      equity: 40_000,
    })
    expect(html).toMatch(/<!DOCTYPE html>/i)
    expect(html).toMatch(/Household snapshot/)

    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/household-snapshot-btn/)
    expect(compare).toMatch(/shareHouseholdSnapshot|printHouseholdSnapshot/)
    expect(compare).toMatch(/generatePdfHtml|buildHouseholdSnapshotHtml|printHouseholdSnapshot/)
  })

  it('23: Markets Cached mode when offline or all quotes stale', () => {
    const live = quote({ last: 100, source: 'yahoo', updatedAt: new Date().toISOString() })
    const stale = quote({
      last: 100,
      source: 'stale:yahoo',
      updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    })
    expect(isQuoteStaleForCachedMode(stale)).toBe(true)
    expect(isQuoteStaleForCachedMode(live)).toBe(false)
    expect(shouldShowCachedMode(false, [live])).toBe(true)
    expect(shouldShowCachedMode(true, [live])).toBe(false)
    expect(shouldShowCachedMode(true, [stale, stale])).toBe(true)
    expect(shouldShowCachedMode(true, [live, stale])).toBe(false)
    expect(shouldShowCachedMode(true, [])).toBe(false)

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/markets-cached-mode-banner/)
    expect(markets).toMatch(/Cached mode/)
    expect(markets).toMatch(/shouldShowCachedMode/)
  })

  it('24: verify:bundle script documents size limit', () => {
    const script = readFileSync(resolve(__dirname, '../../scripts/verify-bundle.mjs'), 'utf8')
    expect(script).toMatch(/MAX_MAIN_CHUNK_BYTES\s*=\s*650_000/)
    expect(script).toMatch(/650 KB|650_000/)
    expect(script).toMatch(/fail if|FAILED/)

    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts['verify:bundle']).toMatch(/verify-bundle/)
    expect(pkg.scripts['deploy:check']).toMatch(/verify:bundle/)
  })

  it('25: UpdateBanner shows RELEASE_NOTES bullets', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(3)
    expect(releaseNotesBullets(3)).toHaveLength(3)
    const banner = readFileSync(resolve(__dirname, '../components/UpdateBanner.tsx'), 'utf8')
    expect(banner).toMatch(/releaseNotesBullets/)
    expect(banner).toMatch(/update-banner-release-notes/)
    expect(banner).toMatch(/RELEASE_NOTES|releaseNotesBullets/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.47')
  })
})
