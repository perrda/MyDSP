/**
 * One-button Cloud Sync: passphrase once, then Sync.
 * Book device (Mini) always pushes. Satellites pull Mini as the book whenever
 * the cloud has an envelope. Push on satellite only if the cloud is empty (404).
 * Remember-passphrase and Automatic sync turn on after a successful unlock.
 * Do not put an access key in the baked URL.
 */

import { chooseSyncAction } from './localBook'
import {
  applyRemoteAsBook,
  applyWorkspaceExtrasFromPreview,
  isBookDevice,
  loadSyncConfig,
  previewPull,
  pushSync,
  resolveSyncRemoteUrl,
  saveSyncConfig,
  type MergePreview,
  type SyncConfig,
} from './syncService'
import { setSessionSyncPassphrase } from './sessionPassphrase'

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
  const action = chooseSyncAction({ isBookDevice: book })

  if (action === 'push') {
    return pushThisBook(
      url,
      passphrase,
      'Pushed this book to cloud. Other devices will pull it.',
      true,
    )
  }

  let preview: MergePreview
  try {
    preview = await previewPull(url, passphrase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Pull failed'
    if (/404/.test(msg)) {
      return pushThisBook(url, passphrase, 'Cloud empty — pushed this book.', book)
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
  return {
    action: 'pull',
    message: `Pulled the book — ${result.merged} portfolio(s) from Mini.`,
    preview,
  }
}

export { chooseSyncAction, chooseFirstSyncAction, localBookIsSourceOfTruth } from './localBook'
