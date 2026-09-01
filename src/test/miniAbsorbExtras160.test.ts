import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.160 Mini absorbs extras before book push', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.162')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.162')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.162',
      '1.2.161',
      '1.2.160',
      '1.2.159',
      '1.2.158',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.160\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(section).toMatch(/never revert/)
    expect(section).toMatch(/pushSync/)
    expect(section).toMatch(/Mini stays open/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Mini absorb extras before push \(v1\.2\.160\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.162/)
    const sync = read('../services/sync/syncService.ts')
    const start = sync.indexOf('export async function absorbRemoteWorkspaceExtrasBeforePush')
    const push = sync.indexOf('export async function pushSync')
    expect(start).toBeGreaterThan(0)
    expect(push).toBeGreaterThan(start)
    const pushFn = sync.slice(push, sync.indexOf('export async function previewPull'))
    expect(pushFn).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(pushFn).toMatch(/isBookDevice\(\)/)
    expect(read('../storage/backupStore.ts')).toMatch(/absorbs satellite extras first/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/absorbs satellite extras first/)
    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/maybeAbsorbAndPushBookExtras/)
    expect(auto).toMatch(/reason === 'focus'/)
    expect(auto).toMatch(/reason === 'interval'/)
    expect(auto).toMatch(/reason === 'online'/)
    const rule = read('../../.cursor/rules/media-cross-device-sync.mdc')
    expect(rule).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(rule).toMatch(/While Mini stays open/)
  })
})
