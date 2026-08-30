/**
 * One-button Cloud Sync: passphrase + Sync.
 * Mini DAVID book is source of truth — first Sync on a device that already has
 * the book pushes. Empty / FCC-sample devices pull. Conflicts never auto-wipe
 * a real local book.
 */

import { chooseFirstSyncAction, localBookIsSourceOfTruth } from './localBook'
import { conflictKey, type ConflictChoice } from './conflicts'
import {
  applyMergePreview,
  applyWorkspaceExtrasFromPreview,
  loadSyncConfig,
  previewPull,
  pushSync,
  resolveSyncRemoteUrl,
  saveSyncConfig,
  type MergePreview,
} from './syncService'

export type OneButtonSyncResult = {
  action: 'push' | 'pull' | 'conflict'
  message: string
  conflicts?: number
  preview?: MergePreview
}

function remoteWins(preview: MergePreview): Record<string, ConflictChoice> {
  const resolutions: Record<string, ConflictChoice> = {}
  for (const c of preview.conflicts) resolutions[conflictKey(c)] = 'remote'
  return resolutions
}

function persistUrl(url: string): void {
  const cfg = loadSyncConfig()
  if (cfg.remoteUrl === url) return
  saveSyncConfig({ ...cfg, remoteUrl: url })
}

function markPushed(url: string, exportedAt: string, bytes: number): void {
  const cfg = loadSyncConfig()
  saveSyncConfig({
    ...cfg,
    remoteUrl: url,
    lastSyncAt: new Date().toISOString(),
    lastSyncError: undefined,
    lastRemoteExportedAt: exportedAt,
    lastRemoteBlobBytes: bytes,
    lastPushBytes: bytes,
    autoResolveConflicts: cfg.autoResolveConflicts === true,
  })
}

async function pushThisBook(url: string, passphrase: string, message: string): Promise<OneButtonSyncResult> {
  const pushed = await pushSync(url, passphrase)
  markPushed(url, pushed.exportedAt, pushed.bytes)
  return { action: 'push', message }
}

export async function runOneButtonSync(passphrase: string): Promise<OneButtonSyncResult> {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Use a passphrase of at least 8 characters.')
  }
  const url = resolveSyncRemoteUrl(loadSyncConfig().remoteUrl)
  persistUrl(url)

  const localHasBook = localBookIsSourceOfTruth()
  const alreadySynced = Boolean(loadSyncConfig().lastSyncAt)
  const action = chooseFirstSyncAction({ localHasBook, alreadySynced })

  if (action === 'push') {
    return pushThisBook(url, passphrase, 'Pushed this book to cloud. Other devices can pull it.')
  }

  let preview: MergePreview
  try {
    preview = await previewPull(url, passphrase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Pull failed'
    if (localHasBook && /404/.test(msg)) {
      return pushThisBook(url, passphrase, 'Cloud empty — pushed this book.')
    }
    throw e
  }

  await applyWorkspaceExtrasFromPreview(preview)

  if (preview.conflicts.length > 0 && localHasBook) {
    return {
      action: 'conflict',
      message: `${preview.conflicts.length} conflict(s) — this book was kept. Review below; nothing was overwritten.`,
      conflicts: preview.conflicts.length,
      preview,
    }
  }

  const resolutions = preview.conflicts.length > 0 ? remoteWins(preview) : {}
  const result = await applyMergePreview(preview, resolutions)
  const cfg = loadSyncConfig()
  saveSyncConfig({
    ...cfg,
    remoteUrl: url,
    lastSyncAt: new Date().toISOString(),
    lastSyncError: undefined,
    lastMergeCount: result.merged,
    autoResolveConflicts: cfg.autoResolveConflicts === true,
  })
  return {
    action: 'pull',
    message: `Pulled & merged ${result.merged} portfolio(s).`,
    preview,
  }
}

export { chooseFirstSyncAction, localBookIsSourceOfTruth }
