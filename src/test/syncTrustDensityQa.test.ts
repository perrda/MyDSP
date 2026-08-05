import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Sync trust + Favourites density QA (v1.2.107)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.113')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.113')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.113',
      '1.2.112',
      '1.2.111',
      '1.2.110',
      '1.2.109',
    ])
  })

  it('sync trust surfaces exist', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/data-testid="sync-unlock-onboarding"/)
    expect(settings).toMatch(/data-testid="sync-pull-media"/)
    expect(settings).toMatch(/data-testid="sync-last-media-at"/)
    expect(settings).toMatch(/lastWorkspaceExtrasSyncAt/)
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/data-testid="news-unlock-sync-banner"/)
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/data-testid="today-unlock-sync-nudge"/)
  })

  it('density QA CSS markers present', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/sync-trust-density-qa/)
    expect(css).toMatch(/today-section-jump-chips/)
  })
})
