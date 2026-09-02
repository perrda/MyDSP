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
    expect(section).toMatch(/restoreMiniKeptBooks/)
    expect(section).toMatch(/already-pushed/)
    expect(section).toMatch(/lastPulledBookIds/)
    expect(section).toMatch(/dropMiniDeletedBooks/)
    expect(section).toMatch(/restoreMiniRenamedBooks/)
    expect(section).toMatch(/mydsp_last_book_scalar_hashes/)
    expect(section).toMatch(/overlaySatelliteNonCollectionFields/)
    expect(section).toMatch(/hashes before overlay/)
    expect(section).toMatch(/mydsp_last_pulled_scalar_hashes/)
    expect(section).toMatch(/mydsp_last_pulled_holding_hashes/)
    expect(section).toMatch(/satelliteBookDivergedFromLastPull/)
    expect(section).toMatch(/satelliteExtrasDivergedFromLastPull/)
    expect(section).toMatch(/mydsp_last_pulled_extras_hash/)
    expect(section).toMatch(/applyWorkspaceExtrasFromPreview/)
    expect(section).toMatch(/lastWorkspaceExtrasSyncAt/)
    expect(section).toMatch(/overlaySatelliteBookAfterRemoteReplace/)
    expect(section).toMatch(/overlayDirtyLocalHoldings/)
    expect(section).toMatch(/resurrect/)
    expect(section).toMatch(/overlayMiniLiveMarks/)
    expect(section).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(section).toMatch(/dropUneditedRowsDeletedOnRemote/)
    expect(section).toMatch(/dropMiniDeletedHoldings/)
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
    expect(notes).toMatch(/already pushed/)
    expect(notes).toMatch(/Staking, FIRE, and budget edits survive absorb/)
    expect(notes).toMatch(/Mini live prices stay/)
    expect(notes).toMatch(/deleted holding stays gone/)
    expect(notes).toMatch(/Unlock, reload, or Pull book from Mini on MacBook \/ iPhone \/ iPad keeps an unpushed size, new ETH, Kids book, SOL delete, or channel/)
    expect(notes).toMatch(/1\.2\.163 upgrade/)
    expect(notes).toMatch(/lastPulledHoldingIds/)
    expect(section).toMatch(/lastPulledHoldingIds/)
    expect(section).toMatch(/stampLastPulledHoldingIdsFromRemote/)
    expect(section).toMatch(/applyReviewedPull/)
    expect(section).toMatch(/runOneButtonSync/)
    expect(section).toMatch(/iPad/)
    expect(section).toMatch(/mydsp_last_pulled_scalar_hashes/)
    const tip = RELEASE_NOTES[0]!
    const kids = tip.bullets[0]
    expect(releaseBulletText(kids)).toMatch(/Kids book created, renamed, or deleted on Mini/)
    expect(releaseBulletText(kids)).toMatch(/already pushed/)
    expect(releaseBulletHref(kids)).toBe('/settings#sync')
    const staking = tip.bullets.find((b) => /Staking, FIRE/.test(releaseBulletText(b)))
    expect(staking).toBeTruthy()
    expect(releaseBulletHref(staking!)).toBe('/settings#sync')
    const unlockKeep = tip.bullets.find((b) =>
      /Unlock, reload, or Pull book from Mini on MacBook \/ iPhone \/ iPad keeps an unpushed size, new ETH, Kids book, SOL delete, or channel/.test(
        releaseBulletText(b),
      ),
    )
    expect(unlockKeep).toBeTruthy()
    expect(releaseBulletHref(unlockKeep!)).toBe('/settings#sync')
  })

  it('absorb REPLACE overlays Mini registry and scalars', () => {
    const sync = read('../services/sync/syncService.ts')
    const start = sync.indexOf('export async function absorbRemoteWorkspaceExtrasBeforePush')
    const push = sync.indexOf('export async function pushSync')
    expect(start).toBeGreaterThan(0)
    expect(push).toBeGreaterThan(start)
    const absorbFn = sync.slice(start, push)
    expect(absorbFn).toMatch(/overlayMiniBookAfterRemoteReplace/)
    expect(absorbFn).toMatch(/refreshMiniMarksAfterAbsorb/)
    expect(absorbFn).toMatch(/dropUneditedRowsDeletedOnRemote/)
    expect(absorbFn).toMatch(/dropMiniDeletedHoldings/)
    expect(absorbFn).toMatch(/snapshotMiniCreatedBooks/)
    expect(absorbFn).toMatch(/lastPulledBookIds/)
    expect(read('../services/sync/syncService.ts')).toMatch(/restoreMiniKeptBooks/)
    expect(absorbFn).toMatch(/applyRemoteAsBook/)
    expect(absorbFn).toMatch(/bookHoldingsMatchLastStamp/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayMiniBookAfterRemoteReplace/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function snapshotMiniCreatedBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function restoreMiniKeptBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function dropMiniDeletedBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function restoreMiniRenamedBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function dropUneditedRowsDeletedOnRemote/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function dropMiniDeletedHoldings/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayMiniLiveMarks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayMiniNonCollectionFields/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlaySatelliteNonCollectionFields/)
    const satOverlay = read('../services/sync/syncService.ts')
    const satFn = satOverlay.slice(
      satOverlay.indexOf('export function overlaySatelliteNonCollectionFields'),
      satOverlay.indexOf('export function overlayMiniLiveMarks'),
    )
    expect(satFn).toMatch(/1\.2\.163/)
    expect(read('../services/sync/syncService.ts')).toMatch(/mydsp_last_book_scalar_hashes/)
    expect(read('../services/sync/syncService.ts')).toMatch(/mydsp_last_pulled_scalar_hashes/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/overlaySatelliteBookAfterRemoteReplace/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/satelliteBookDivergedFromLastPull/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/satelliteExtrasDivergedFromLastPull/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/satelliteLocalStateDivergedFromLastPull/)
    expect(read('../storage/portfolioStore.ts')).toMatch(/notifyDataChanged\(\)/)
    const rename = read('../storage/portfolioStore.ts')
    const renameFn = rename.slice(rename.indexOf('export function renamePortfolio'))
    expect(renameFn).toMatch(/notifyDataChanged\(\)/)
    const rule = read('../../.cursor/rules/media-cross-device-sync.mdc')
    expect(rule).toMatch(/overlayMiniBookAfterRemoteReplace/)
    expect(rule).toMatch(/Kids create/)
    expect(rule).toMatch(/restoreMiniKeptBooks/)
    expect(read('../services/sync/syncService.ts')).toMatch(/restoreMiniKeptBooks\(metasBefore, booksBefore/)
  })

  it('does not revert 163 holding absorb or sitting satellite pull', () => {
    const changelog = read('../../CHANGELOG.md')
    expect(changelog).toMatch(/## \[1\.2\.163\]/)
    expect(changelog).toMatch(/## \[1\.2\.162\]/)
    expect(changelog).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(changelog).toMatch(/maybePullSatelliteExtras/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/maybePullSatelliteExtras/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/overlaySatelliteBookAfterRemoteReplace/)
    expect(read('../services/sync/autoSyncService.ts')).toMatch(/satelliteBookDivergedFromLastPull/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlayDirtyLocalHoldings/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlaySatelliteNonCollectionFields/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function overlaySatelliteBookAfterRemoteReplace/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function satelliteBookDivergedFromLastPull/)
    const bookDiverge = read('../services/sync/syncService.ts')
    const bookFn = bookDiverge.slice(
      bookDiverge.indexOf('export function satelliteBookDivergedFromLastPull'),
      bookDiverge.indexOf('function currentSatelliteExtrasFingerprint'),
    )
    expect(bookFn).toMatch(/lastPulledHoldingIds/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function satelliteExtrasDivergedFromLastPull/)
    const extrasFn = read('../services/sync/syncService.ts')
    const diverge = extrasFn.slice(
      extrasFn.indexOf('export function satelliteExtrasDivergedFromLastPull'),
      extrasFn.indexOf('export function satelliteLocalStateDivergedFromLastPull'),
    )
    expect(diverge).toMatch(/lastWorkspaceExtrasSyncAt/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function stampLastPulledExtrasHash/)
    const extrasApply = read('../services/sync/syncService.ts')
    const extrasApplyFn = extrasApply.slice(
      extrasApply.indexOf('export async function applyWorkspaceExtrasFromPreview'),
      extrasApply.indexOf('export async function applyRemoteAsBook'),
    )
    expect(extrasApplyFn).toMatch(/satelliteExtrasDivergedFromLastPull/)
    expect(extrasApplyFn).toMatch(/markLocalDataChanged/)
    expect(read('../services/sync/oneButtonSync.ts')).toMatch(/satelliteBookDivergedFromLastPull/)
    expect(read('../services/sync/oneButtonSync.ts')).toMatch(/satelliteExtrasDivergedFromLastPull/)
    expect(read('../services/sync/oneButtonSync.ts')).toMatch(/overlaySatelliteBookAfterRemoteReplace/)
    const unlock = read('../services/sync/oneButtonSync.ts')
    const unlockFn = unlock.slice(
      unlock.indexOf('export async function unlockAndPullFromCloud'),
      unlock.indexOf('export async function flushQueuedSyncPush'),
    )
    expect(unlockFn).toMatch(/stampLastPulledHoldingIdsFromRemote\(preview\)/)
    expect(unlockFn.indexOf('stampLastPulledBookBaseline()')).toBeLessThan(
      unlockFn.indexOf('overlaySatelliteBookAfterRemoteReplace'),
    )
    expect(unlockFn.indexOf('overlaySatelliteBookAfterRemoteReplace')).toBeLessThan(
      unlockFn.indexOf('stampLastPulledHoldingIdsFromRemote'),
    )
    const oneButton = read('../services/sync/oneButtonSync.ts')
    const oneFn = oneButton.slice(
      oneButton.indexOf('export async function runOneButtonSync'),
      oneButton.indexOf('export async function unlockAndPullFromCloud'),
    )
    expect(oneFn).toMatch(/unlockAndPullFromCloud\(passphrase\)/)
    expect(oneFn).toMatch(/leftover book was not uploaded/)
    const auto = read('../services/sync/autoSyncService.ts')
    const doPull = auto.slice(auto.indexOf('async function doPull'), auto.indexOf('async function doPush'))
    expect(doPull).toMatch(/stampLastPulledHoldingIdsFromRemote\(preview\)/)
    expect(doPull.indexOf('stampLastPulledBookBaseline()')).toBeLessThan(
      doPull.lastIndexOf('overlaySatelliteBookAfterRemoteReplace'),
    )
    expect(doPull.lastIndexOf('overlaySatelliteBookAfterRemoteReplace')).toBeLessThan(
      doPull.indexOf('stampLastPulledHoldingIdsFromRemote'),
    )
    expect(auto.slice(auto.indexOf('async function doPush'))).toMatch(/stampLastPulledExtrasHash/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function stampLastBookHoldingHashes/)
    expect(read('../services/sync/syncService.ts')).toMatch(/export function bookHoldingsMatchLastStamp/)
    const reviewed = read('../services/sync/syncService.ts')
    const reviewedFn = reviewed.slice(reviewed.indexOf('export async function applyReviewedPull'))
    expect(reviewedFn).toMatch(/overlaySatelliteBookAfterRemoteReplace/)
    expect(reviewedFn).toMatch(/stampLastPulledHoldingIdsFromRemote/)
    expect(reviewedFn).toMatch(/stampHoldings: false/)
  })
})
