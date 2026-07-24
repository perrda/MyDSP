import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Clean sync / digest chrome (v1.2.91)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.99')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.99')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.99',
      '1.2.98',
      '1.2.97',
      '1.2.96',
      '1.2.95',
    ])
  })

  it('Weekly digest lives in Sidebar, not Today/Compare hero', () => {
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/Weekly digest/)
    expect(sidebar).toMatch(/mydsp-open-weekly-digest|\/\?digest=1/)

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/WeeklyDigestModal/)
    expect(dash).toMatch(/mydsp-open-weekly-digest/)
    expect(dash).not.toMatch(/Digest Preview\/Share/)
    expect(dash).not.toMatch(/weekly-digest-btn/)
    expect(dash).not.toMatch(/today-digest-thumb/)
    expect(dash).not.toMatch(/Cloud Sync <ArrowRight/)

    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/WeeklyDigestModal/)
    expect(compare).not.toMatch(/Digest Preview\/Share/)
    expect(compare).not.toMatch(/weekly-digest-btn/)
  })

  it('Manual refresh only via toolbar More menu', () => {
    const toolbar = readFileSync(
      resolve(__dirname, '../components/layout/ToolbarControls.tsx'),
      'utf8',
    )
    expect(toolbar).toMatch(/Refresh · Privacy · Theme · Glass · Search/)
    expect(toolbar).toMatch(/Refresh all data/)
    expect(toolbar).not.toMatch(/toolbar-actions-desktop/)

    const chip = readFileSync(resolve(__dirname, '../components/SyncStatusChip.tsx'), 'utf8')
    expect(chip).not.toMatch(/forceSyncNow/)
    expect(chip).not.toMatch(/Long-press to sync now/)
    expect(chip).toMatch(/Tap to open Settings/)

    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).not.toMatch(/syncNow\(\)/)
    expect(nav).toMatch(/mydsp-open-weekly-digest/)
  })

  it('No page-level Sync now / Markets Refresh CTAs', () => {
    for (const file of [
      'Dashboard.tsx',
      'PlanningPage.tsx',
      'AnalyticsPage.tsx',
      'ComparePage.tsx',
      'EquitiesPage.tsx',
      'CryptoPage.tsx',
    ]) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).not.toMatch(/^\s*Sync now\s*$/m)
    }
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/Refreshing data/)
    expect(markets).not.toMatch(/aria-label="Refresh market data now"/)
    expect(markets).toMatch(/data-testid="markets-sync-prices"/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    // Setup Sync now remains in Settings → Sync panel
    expect(settings).toMatch(/Sync now/)
    expect(settings).not.toMatch(/settings-sync-thumb/)
  })

  it('cursor rule documents the policy', () => {
    const rule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/clean-sync-refresh-ux.mdc'),
      'utf8',
    )
    expect(rule).toMatch(/alwaysApply: true/)
    expect(rule).toMatch(/More/)
    expect(rule).toMatch(/Weekly digest/)
  })
})
