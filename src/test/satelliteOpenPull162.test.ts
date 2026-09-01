import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { shouldRunSyncCycle } from '../services/sync/autoSyncService'
import { isDraftWorkerPreview } from '../services/sync/syncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.162 sitting satellite pulls extras with Automatic off', () => {
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
    const section = changelog.match(/## \[1\.2\.162\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/maybePullSatelliteExtras/)
    expect(section).toMatch(/doPull/)
    expect(section).toMatch(/MacBook \/ iPhone \/ iPad/)
    expect(section).toMatch(/Never push/)
    expect(section).toMatch(/cursor-\*-mydsp/)
    expect(section).toMatch(/047722a6-mydspv1/)
    expect(section).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../../ROADMAP.md')).toMatch(/Sitting satellite extras pull \(v1\.2\.162\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.162/)
    const notes = read('../domain/releaseNotes.ts')
    expect(notes).toMatch(/MacBook \/ iPhone \/ iPad can stay open with Automatic off/)
    expect(notes).toMatch(/pull-only/)
  })

  it('interval stays quiet in shouldRunSyncCycle; satellite still doPulls', () => {
    const url = { remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev', enabled: false }
    expect(shouldRunSyncCycle(url, 'interval', false)).toBe(false)
    expect(shouldRunSyncCycle(url, 'focus', false)).toBe(false)
    expect(shouldRunSyncCycle(url, 'online', false)).toBe(false)
    expect(shouldRunSyncCycle(url, 'edit', true)).toBe(true)

    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/maybePullSatelliteExtras/)
    expect(auto).toMatch(/maybeAbsorbAndPushBookExtras/)
    const pullFn = auto.slice(
      auto.indexOf('async function maybePullSatelliteExtras'),
      auto.indexOf('async function maybeAbsorbAndPushBookExtras'),
    )
    expect(pullFn).toMatch(/await doPull/)
    expect(pullFn).not.toMatch(/doPush/)
    expect(pullFn).not.toMatch(/pushSync/)
    expect(pullFn).toMatch(/isBookDevice\(cfg\)\) return/)

    const cycle = auto.slice(auto.indexOf('export async function runAutoSyncCycle'))
    expect(cycle).toMatch(/maybePullSatelliteExtras\(cfg, reason\)/)
    expect(cycle).toMatch(/maybeAbsorbAndPushBookExtras\(cfg\)/)

    const rule = read('../../.cursor/rules/media-cross-device-sync.mdc')
    expect(rule).toMatch(/maybePullSatelliteExtras/)
    expect(rule).toMatch(/While a satellite stays open/)
    expect(rule).toMatch(/While Mini stays open/)
  })

  it('blocks leftover cursor-*-mydsp and commit previews from pushing', () => {
    expect(
      isDraftWorkerPreview('cursor-satellite-open-pull-6f30-mydspv1.dave-perry.workers.dev'),
    ).toBe(true)
    expect(isDraftWorkerPreview('cursor-leftover-mydsp.dave-perry.workers.dev')).toBe(true)
    expect(isDraftWorkerPreview('047722a6-mydspv1.dave-perry.workers.dev')).toBe(true)
    expect(isDraftWorkerPreview('main-mydspv1.dave-perry.workers.dev')).toBe(false)
    expect(isDraftWorkerPreview('mydspv1.dave-perry.workers.dev')).toBe(false)
    const sync = read('../services/sync/syncService.ts')
    const previewStart = sync.indexOf('export async function previewPull')
    const preview = sync.slice(previewStart, sync.indexOf('export async function previewImport'))
    expect(preview).not.toMatch(/lastRemoteExportedAt: envelope\.exportedAt/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(
      /leftover `cursor-\*-mydsp/,
    )
  })

  it('does not revert Mini absorb extras or live-price trust', () => {
    const changelog = read('../../CHANGELOG.md')
    expect(changelog).toMatch(/## \[1\.2\.161\]/)
    expect(changelog).toMatch(/## \[1\.2\.160\]/)
    expect(changelog).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    const sync = read('../services/sync/syncService.ts')
    expect(sync.indexOf('export async function absorbRemoteWorkspaceExtrasBeforePush')).toBeLessThan(
      sync.indexOf('export async function pushSync'),
    )
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/noteSuccessfulCloudContact/)
  })
})
