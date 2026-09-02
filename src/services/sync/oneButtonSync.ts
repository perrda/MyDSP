/**
 * One-button Cloud Sync: passphrase once, then Sync.
 * Book device (Mini) always pushes. Satellites pull Mini as the book whenever
 * the cloud has an envelope. Satellite 404 may seed only an empty/sample slate.
 * Remember-passphrase and Automatic sync turn on after a successful unlock.
 * Do not put an access key in the baked URL.
 */

import { chooseFirstSyncAction, localBookIsSourceOfTruth, mayPushOnEmptyCloud } from './localBook'
import {
  applyRemoteAsBook,
  applyWorkspaceExtrasFromPreview,
  overlaySatelliteBookAfterRemoteReplace,
  satelliteBookDivergedFromLastPull,
  snapshotSatelliteCreatedBooks,
  stampLastPulledHoldings,
  isBookDevice,
  loadSyncConfig,
  previewPull,
  pushSync,
  resolveSyncRemoteUrl,
  saveSyncConfig,
  type MergePreview,
  type SyncConfig,
} from './syncService'
import { listPortfolios, loadPortfolio } from '../../storage/portfolioStore'
import { setSessionSyncPassphrase } from './sessionPassphrase'
import { markLocalDataChanged, noteSuccessfulUnlock } from './autoSyncService'
import { refreshLiveMarksAfterUnlock } from '../marketsQuotes'

export type OneButtonSyncResult = {
  action: 'push' | 'pull' | 'conflict'
  message: string
  conflicts?: number
  preview?: MergePreview
}

function persistUrl(url: string): SyncConfig {
  const cfg = loadSyncConfig()
  if (cfg.remoteUrl === url) return cfg
  const next = { ...cfg, remoteUrl: url }
  saveSyncConfig(next)
  return next
}

function rememberPassAndMaybeAuto(patch: Partial<SyncConfig>): SyncConfig {
  const cfg = loadSyncConfig()
  const next: SyncConfig = {
    ...cfg,
    ...patch,
    rememberPassphrase: true,
    enabled: patch.enabled === undefined ? true : patch.enabled,
  }
  saveSyncConfig(next)
  return next
}

function markPushed(url: string, exportedAt: string, bytes: number, asBook: boolean): void {
  rememberPassAndMaybeAuto({
    remoteUrl: url,
    lastSyncAt: new Date().toISOString(),
    lastSyncError: undefined,
    lastRemoteExportedAt: exportedAt,
    lastRemoteBlobBytes: bytes,
    lastPushBytes: bytes,
    enabled: true,
    thisDeviceIsTheBook: asBook,
    autoResolveConflicts: loadSyncConfig().autoResolveConflicts === true,
  })
}

async function pushThisBook(
  url: string,
  passphrase: string,
  message: string,
  asBook: boolean,
): Promise<OneButtonSyncResult> {
  const pushed = await pushSync(url, passphrase)
  markPushed(url, pushed.exportedAt, pushed.bytes, asBook)
  return { action: 'push', message }
}

export async function runOneButtonSync(passphrase: string): Promise<OneButtonSyncResult> {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Use a passphrase of at least 8 characters.')
  }
  setSessionSyncPassphrase(passphrase, { remember: true })
  const url = resolveSyncRemoteUrl(loadSyncConfig().remoteUrl)
  persistUrl(url)

  const book = isBookDevice()
  const localHasBook = localBookIsSourceOfTruth()
  const action = chooseFirstSyncAction({
    localHasBook,
    alreadySynced: Boolean(loadSyncConfig().lastSyncAt),
    isBookDevice: book,
  })

  if (action === 'push') {
    const pushed = await pushThisBook(
      url,
      passphrase,
      'Pushed this book to cloud. Other devices will pull it.',
      true,
    )
    noteSuccessfulUnlock()
    return pushed
  }

  let preview: MergePreview
  try {
    preview = await previewPull(url, passphrase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Pull failed'
    if (/404/.test(msg)) {
      if (
        !mayPushOnEmptyCloud({
          isBookDevice: book,
          localHasRealBook: localHasBook,
        })
      ) {
        throw new Error(
          'Cloud empty — leftover book was not uploaded. Only Mini (This device is the book) may push a real book.',
        )
      }
      const seeded = await pushThisBook(url, passphrase, 'Cloud empty — pushed this book.', book)
      noteSuccessfulUnlock()
      return seeded
    }
    throw e
  }

  await applyWorkspaceExtrasFromPreview(preview)

  const result = await applyRemoteAsBook(preview)
  rememberPassAndMaybeAuto({
    remoteUrl: url,
    lastSyncAt: new Date().toISOString(),
    lastSyncError: undefined,
    lastMergeCount: result.merged,
    enabled: true,
    thisDeviceIsTheBook: false,
    autoResolveConflicts: loadSyncConfig().autoResolveConflicts === true,
  })
  noteSuccessfulUnlock()
  return {
    action: 'pull',
    message: `Pulled the book — ${result.merged} portfolio(s) from Mini.`,
    preview,
  }
}

/**
 * Satellite Unlock on YouTube / News: always pull extras + book.
 * Never push — a MacBook leftover must not overwrite Mini’s channels.
 */
export async function unlockAndPullFromCloud(passphrase: string): Promise<OneButtonSyncResult> {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Use a passphrase of at least 8 characters.')
  }
  setSessionSyncPassphrase(passphrase, { remember: true })
  const url = resolveSyncRemoteUrl(loadSyncConfig().remoteUrl)
  persistUrl(url)

  const preview = await previewPull(url, passphrase)
  await applyWorkspaceExtrasFromPreview(preview)

  if (!isBookDevice()) {
    const overlay = satelliteBookDivergedFromLastPull()
    const createdBooks = overlay ? snapshotSatelliteCreatedBooks() : []
    const metasBefore = overlay ? listPortfolios() : []
    const booksBefore = overlay
      ? metasBefore.map((p) => ({ id: p.id, data: loadPortfolio(p.id) }))
      : []
    const result = await applyRemoteAsBook(preview, { stampHoldings: false })
    if (overlay) {
      overlaySatelliteBookAfterRemoteReplace(preview, createdBooks, metasBefore, booksBefore)
    }
    stampLastPulledHoldings()
    rememberPassAndMaybeAuto({
      remoteUrl: url,
      lastSyncAt: new Date().toISOString(),
      lastSyncError: undefined,
      lastMergeCount: result.merged,
      enabled: true,
      thisDeviceIsTheBook: false,
    })
    noteSuccessfulUnlock()
    // Unlock stays pull-only. Mark dirty so the kept qty still flushes to Mini.
    if (overlay) markLocalDataChanged()
    await refreshLiveMarksAfterUnlock()
    return {
      action: 'pull',
      message: `Pulled Mini’s book — ${result.merged} portfolio(s) · YouTube / News / Markets applied.`,
      preview,
    }
  }

  rememberPassAndMaybeAuto({
    remoteUrl: url,
    lastSyncAt: new Date().toISOString(),
    lastSyncError: undefined,
    enabled: true,
  })
  noteSuccessfulUnlock()
  await refreshLiveMarksAfterUnlock()
  return {
    action: 'pull',
    message: 'Pulled YouTube / News / Markets extras. Mini stays the book.',
    preview,
  }
}

/**
 * Offline queue / Advanced Push flush.
 * Mini may PUT. Satellites pull only — never seed leftover YouTube or DAVID.
 */
export async function flushQueuedSyncPush(
  remoteUrl: string,
  passphrase: string,
): Promise<void> {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Use a passphrase of at least 8 characters.')
  }
  if (isBookDevice()) {
    await pushSync(remoteUrl, passphrase)
    return
  }
  await unlockAndPullFromCloud(passphrase)
}

export {
  chooseSyncAction,
  chooseFirstSyncAction,
  localBookIsSourceOfTruth,
  mayPushOnEmptyCloud,
} from './localBook'
