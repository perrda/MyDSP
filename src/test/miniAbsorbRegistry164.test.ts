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

describe('MyDSP 1.2.164 Mini absorb keeps Mini family books and staking', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.164')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.164')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
      '1.2.160',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.164\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/overlayMiniBookAfterRemoteReplace/)
    expect(section).toMatch(/snapshotMiniCreatedBooks/)
    expect(section).toMatch(/dropMiniDeletedBooks/)
    expect(section).toMatch(/mydsp_last_book_scalar_hashes/)
    expect(section).toMatch(/applyRemoteAsBook/)
    expect(section).toMatch(/Kids/)
    expect(section).toMatch(/staking/)
    expect(section).toMatch(/never revert/)
    expect(section).toMatch(/MacBook/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../../ROADMAP.md')).toMatch(/Mini absorb registry \+ scalars \(v1\.2\.164\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1.2.164/)
    const notes = read('../domain/releaseNotes.ts')
    expect(notes).toMatch(/Kids book created, renamed, or deleted on Mini/)
    expect(notes).toMatch(/Staking, FIRE, and budget edits on Mini/)
    const tip = RELEASE_NOTES[0]!
    const kids = tip.bullets[0]
    expect(releaseBulletText(kids)).toMatch(/Kids book created, renamed, or deleted on Mini/)
    expect(releaseBulletHref(kids)).toBe('/settings#sync')
    const staking = tip.bullets.find((b) => /Staking, FIRE/.test(releaseBulletText(b)))
    expect(staking).toBeTruthy()
    expect(releaseBulletHref(staking!)).toBe('/settings#sync')
  })

  it('absorb REPLACE overlays Mini registry and scalars', () => {
    const sync = read('../services/sync/syncService.ts')
    const start = sync.indexOf('export async function absorbRemoteWorkspaceExtrasBeforePush')
    const push = sync.indexOf('export async function pushSync')
    expect(start).toBeGreaterThan(0)
    expect(push).toBeGreaterThan(start)
    const absorbFn = sync.slice(start, push)
    expect(absorbFn).toMatch(/overlayMiniBookAfterRemoteReplace/)
    expect(absorbFn).toMatch(/snapshotMiniCreatedBooks/)
    expect(absorbFn).toMatch(/applyRemoteAsBook/)
    expect(absorbFn).toMatch(/bookHoldingsMatchLastStamp/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayMiniBookAfterRemoteReplace/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function snapshotMiniCreatedBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function dropMiniDeletedBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayMiniNonCollectionFields/)
    expect(read('../services/sync/syncService.ts')).toMatch(/mydsp_last_book_scalar_hashes/)
    expect(read('../storage/portfolioStore.ts')).toMatch(/notifyDataChanged\(\)/)
    const rename = read('../storage/portfolioStore.ts')
    const renameFn = rename.slice(rename.indexOf('export function renamePortfolio'))
    expect(renameFn).toMatch(/notifyDataChanged\(\)/)
    const rule = read('../../.cursor/rules/media-cross-device-sync.mdc')
    expect(rule).toMatch(/overlayMiniBookAfterRemoteReplace/)
    expect(rule).toMatch(/Kids create/)
  })

  it('does not revert 163 holding absorb or sitting satellite pull', () => {
    const changelog = read('../../CHANGELOG.md')
    expect(changelog).toMatch(/## \[1\.2\.163\]/)
    expect(changelog).toMatch(/## \[1\.2\.162\]/)
    expect(changelog).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(changelog).toMatch(/maybePullSatelliteExtras/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/maybePullSatelliteExtras/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/overlayDirtyLocalHoldings/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function stampLastBookHoldingHashes/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function bookHoldingsMatchLastStamp/)
  })
})
