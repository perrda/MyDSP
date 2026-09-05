import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { satelliteNeedsMediaUnlock } from '../services/sync/mediaUnlock'
import { saveSyncConfig, type SyncConfig } from '../services/sync/syncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function cfg(partial: Partial<SyncConfig>): SyncConfig {
  return {
    remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
    enabled: false,
    ...partial,
  }
}

describe('MyDSP 1.2.159 satellite auto-pull keeps live marks', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.165')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.165')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.165',
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.159\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(section).toMatch(/doPull/)
    expect(section).toMatch(/lastSyncAt/)
    expect(section).toMatch(/lastWorkspaceExtrasSyncAt/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Satellite auto-pull live marks \(v1\.2\.159\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.164/)
    const auto = read('../services/sync/autoSyncService.ts')
    const start = auto.indexOf('if (satellite) {')
    const body = auto.slice(start, auto.indexOf('if (preview.conflicts.length > 0)'))
    expect(body).toMatch(/applyRemoteAsBook/)
    expect(body).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(body).not.toMatch(/pushSync/)
    const unlock = read('../services/sync/mediaUnlock.ts')
    expect(unlock).toMatch(/const pulled = Boolean\(cfg\.lastSyncAt\)/)
    expect(unlock).not.toMatch(/lastWorkspaceExtrasSyncAt/)
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/isBookDevice\(syncCfg\) && preview\.conflicts\.length > 0/)
    expect(settings).toMatch(/refreshLiveMarksAfterUnlock/)
    const sync = read('../services/sync/syncService.ts')
    const pullAndMerge = sync.slice(
      sync.indexOf('export async function pullAndMerge'),
      sync.indexOf('export async function importEncryptedFile'),
    )
    expect(pullAndMerge).toMatch(/isBookDevice\(\)/)
    expect(pullAndMerge).toMatch(/applyReviewedPull/)
    const importEnc = sync.slice(sync.indexOf('export async function importEncryptedFile'))
    expect(importEnc).toMatch(/isBookDevice\(\)/)
    expect(importEnc).toMatch(/applyReviewedPull/)
    expect(section).toMatch(/pullAndMerge/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(/satellite auto-pull/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(
      /leftover DAVID always conflicts/,
    )
  })

  it('Unlock banner stays up after media-only extras stamp', () => {
    expect(
      satelliteNeedsMediaUnlock(
        cfg({ lastWorkspaceExtrasSyncAt: '2026-09-01T16:00:00.000Z' }),
        { state: 'idle' },
        true,
      ),
    ).toBe(true)
    expect(
      satelliteNeedsMediaUnlock(
        cfg({ lastSyncAt: '2026-09-01T16:00:00.000Z' }),
        { state: 'idle' },
        true,
      ),
    ).toBe(false)
  })
})
