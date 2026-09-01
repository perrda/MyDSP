import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RELEASE_NOTES,
  releaseBulletHref,
  releaseBulletText,
  releaseNotesArchive,
} from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.163 Mini absorbs satellite holding sizes before book push', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.163')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.163')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.163',
      '1.2.162',
      '1.2.161',
      '1.2.160',
      '1.2.159',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.163\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(section).toMatch(/applyMergePreview/)
    expect(section).toMatch(/applyRemoteAsBook/)
    expect(section).toMatch(/holding/)
    expect(section).toMatch(/deleted/)
    expect(section).toMatch(/never revert/)
    expect(section).toMatch(/MacBook \/ iPhone \/ iPad/)
    expect(section).toMatch(/parked/)
    expect(section).toMatch(/overlayDirtyLocalHoldings/)
    expect(section).toMatch(/lastPulledHoldingIds/)
    expect(section).toMatch(/restoreSatelliteCreatedBooks/)
    expect(section).toMatch(/newly added/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../../ROADMAP.md')).toMatch(/Mini absorb holding sizes \(v1\.2\.163\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1.2.163/)
    const notes = read('../domain/releaseNotes.ts')
    expect(notes).toMatch(/MacBook \/ iPhone \/ iPad size change/)
    expect(notes).toMatch(/never revert/)
    const tip = RELEASE_NOTES[0]!
    const sizeChange = tip.bullets[0]
    expect(releaseBulletText(sizeChange)).toMatch(/MacBook \/ iPhone \/ iPad size change/)
    expect(releaseBulletHref(sizeChange)).toBe('/settings#sync')
    const extrasAbsorb = tip.bullets.find((b) =>
      /extras still absorb first, then the book sizes/.test(releaseBulletText(b)),
    )
    expect(extrasAbsorb).toBeTruthy()
    expect(releaseBulletHref(extrasAbsorb!)).toBe('/settings#sync')
    expect(releaseBulletHref(extrasAbsorb!)).not.toBe('/youtube')
  })

  it('absorb merges satellite holdings when Mini is not dirty; parks when both edited', () => {
    const sync = read('../services/sync/syncService.ts')
    const start = sync.indexOf('export async function absorbRemoteWorkspaceExtrasBeforePush')
    const push = sync.indexOf('export async function pushSync')
    expect(start).toBeGreaterThan(0)
    expect(push).toBeGreaterThan(start)
    const absorbFn = sync.slice(start, push)
    expect(absorbFn).toMatch(/applyMergePreview/)
    expect(absorbFn).toMatch(/applyRemoteAsBook/)
    expect(absorbFn).toMatch(/isLocalSyncDirty/)
    expect(absorbFn).toMatch(/parked/)
    expect(absorbFn).toMatch(/'remote'/)
    const pushFn = sync.slice(push, sync.indexOf('async function decryptEnvelope'))
    expect(pushFn).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(pushFn).toMatch(/parked/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/export function isLocalSyncDirty/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/absorbed === 'parked'/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/overlayDirtyLocalHoldings/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/restoreSatelliteCreatedBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function snapshotSatelliteCreatedBooks/)
    expect(absorbFn).toMatch(/applyMergePreview/)
    const rule = read('../../.cursor/rules/media-cross-device-sync.mdc')
    expect(rule).toMatch(/holding size/)
    expect(rule).toMatch(/parked/)
  })

  it('does not revert sitting satellite pull or live-price trust', () => {
    const changelog = read('../../CHANGELOG.md')
    expect(changelog).toMatch(/## \[1\.2\.162\]/)
    expect(changelog).toMatch(/## \[1\.2\.161\]/)
    expect(changelog).toMatch(/## \[1\.2\.160\]/)
    expect(changelog).toMatch(/maybePullSatelliteExtras/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/maybePullSatelliteExtras/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayDirtyLocalHoldings/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function stampLastPulledHoldings/)
    expect(read('../services/sync/syncService.ts')).toMatch(/lastPulledHoldingIds/)
    expect(read('../services/sync/syncService.ts')).toMatch(/stampHoldings/)
    const sync = read('../services/sync/syncService.ts')
    const reviewed = sync.slice(sync.indexOf('export async function applyReviewedPull'))
    expect(reviewed).toMatch(/applyRemoteAsBook\(preview\)/)
  })
})
