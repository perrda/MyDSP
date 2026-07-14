/**
 * Automatic multi-device sync over Cloudflare Worker + KV.
 * Pulls when the app resumes / comes online; pushes shortly after local edits.
 * Requires SyncConfig.enabled + remoteUrl + passphrase (session or remembered).
 */

import { enqueueOfflineJob } from '../offlineQueue'
import {
  allConflictsResolved,
  applyMergePreview,
  fetchRemoteMeta,
  getLocalDeviceId,
  loadSyncConfig,
  previewPull,
  pushSync,
  saveSyncConfig,
  type MergePreview,
  type SyncConfig,
} from './syncService'
import { conflictKey, type ConflictChoice } from './conflicts'
import { getSessionSyncPassphrase, hydrateSessionSyncPassphrase } from './sessionPassphrase'

const PUSH_DEBOUNCE_MS = 8_000
const PULL_MIN_INTERVAL_MS = 12_000
const PERIODIC_MS = 5 * 60_000

export type AutoSyncState =
  | 'idle'
  | 'pulling'
  | 'pushing'
  | 'conflict'
  | 'error'
  | 'needs-passphrase'
  | 'disabled'

export interface AutoSyncStatus {
  state: AutoSyncState
  message?: string
  lastAt?: string
  pendingConflicts?: number
}

type CycleReason = 'start' | 'focus' | 'online' | 'interval' | 'edit' | 'manual' | 'hide'

let dirty = false
let busy = false
let applyingRemote = false
let started = false
let pushTimer: ReturnType<typeof setTimeout> | null = null
let periodicTimer: ReturnType<typeof setInterval> | null = null
let lastPullAttempt = 0
let status: AutoSyncStatus = { state: 'idle' }
let pendingConflictPreview: MergePreview | null = null

const listeners = new Set<(s: AutoSyncStatus) => void>()

function emit(next: AutoSyncStatus): void {
  status = next
  for (const fn of listeners) {
    try {
      fn(next)
    } catch {
      /* ignore */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('mydsp-autosync', { detail: next }))
  } catch {
    /* ignore */
  }
}

export function getAutoSyncStatus(): AutoSyncStatus {
  return status
}

export function subscribeAutoSync(fn: (s: AutoSyncStatus) => void): () => void {
  listeners.add(fn)
  fn(status)
  return () => listeners.delete(fn)
}

export function getPendingAutoSyncConflicts(): MergePreview | null {
  return pendingConflictPreview
}

export function clearPendingAutoSyncConflicts(): void {
  pendingConflictPreview = null
  if (status.state === 'conflict') emit({ state: 'idle', lastAt: status.lastAt })
}

export function beginApplyingRemote(): void {
  applyingRemote = true
}

export function endApplyingRemote(): void {
  applyingRemote = false
}

export function isApplyingRemote(): boolean {
  return applyingRemote
}

export function markLocalDataChanged(): void {
  if (applyingRemote) return
  const cfg = loadSyncConfig()
  if (!cfg.enabled || !cfg.remoteUrl) return
  dirty = true
  schedulePush()
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void runAutoSyncCycle('edit')
  }, PUSH_DEBOUNCE_MS)
}

function resolveAllRemote(preview: MergePreview): Record<string, ConflictChoice> {
  const resolutions: Record<string, ConflictChoice> = {}
  for (const c of preview.conflicts) {
    resolutions[conflictKey(c)] = 'remote'
  }
  return resolutions
}

function updateCfg(patch: Partial<SyncConfig>): SyncConfig {
  const next = { ...loadSyncConfig(), ...patch }
  saveSyncConfig(next)
  return next
}

async function doPull(cfg: SyncConfig, pass: string, reason: CycleReason): Promise<boolean> {
  const now = Date.now()
  if (reason !== 'manual' && reason !== 'start' && now - lastPullAttempt < PULL_MIN_INTERVAL_MS) {
    return false
  }
  lastPullAttempt = now

  emit({ state: 'pulling', message: 'Checking cloud…', lastAt: status.lastAt })

  let meta: Awaited<ReturnType<typeof fetchRemoteMeta>>
  try {
    meta = await fetchRemoteMeta(cfg.remoteUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Pull failed'
    updateCfg({ lastSyncError: msg })
    emit({ state: 'error', message: msg, lastAt: status.lastAt })
    return false
  }

  if (!meta) {
    // Empty store — nothing to pull
    emit({ state: 'idle', message: 'Cloud empty — will push local data', lastAt: status.lastAt })
    return false
  }

  const localDevice = getLocalDeviceId()
  const seenThis = cfg.lastRemoteExportedAt === meta.exportedAt
  const fromOther = meta.deviceId !== localDevice
  const remoteNewer =
    !cfg.lastSyncAt || new Date(meta.exportedAt).getTime() > new Date(cfg.lastSyncAt).getTime()

  // Skip download when we already applied this envelope (or we pushed it ourselves)
  if (seenThis && !fromOther) return false
  if (!fromOther && !remoteNewer && reason !== 'manual') return false
  if (fromOther && seenThis && reason !== 'manual') return false

  emit({ state: 'pulling', message: 'Pulling from cloud…', lastAt: status.lastAt })

  let preview: MergePreview
  try {
    preview = await previewPull(cfg.remoteUrl, pass)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Pull failed'
    updateCfg({ lastSyncError: msg })
    emit({ state: 'error', message: msg, lastAt: status.lastAt })
    return false
  }

  const autoResolve = cfg.autoResolveConflicts !== false
  let resolutions: Record<string, ConflictChoice> = {}

  if (preview.conflicts.length > 0) {
    if (autoResolve) {
      resolutions = resolveAllRemote(preview)
    } else if (!allConflictsResolved(preview.conflicts, resolutions)) {
      pendingConflictPreview = preview
      emit({
        state: 'conflict',
        message: `${preview.conflicts.length} conflict(s) — open Settings → Sync`,
        pendingConflicts: preview.conflicts.length,
        lastAt: status.lastAt,
      })
      try {
        window.dispatchEvent(
          new CustomEvent('mydsp-sync-conflicts', { detail: { preview, count: preview.conflicts.length } }),
        )
      } catch {
        /* ignore */
      }
      return false
    }
  }

  const wasDirty = dirty
  beginApplyingRemote()
  try {
    const result = await applyMergePreview(preview, resolutions)
    const at = new Date().toISOString()
    updateCfg({
      lastSyncAt: at,
      lastSyncError: undefined,
      lastMergeCount: result.merged,
      lastRemoteExportedAt: meta.exportedAt,
    })
    pendingConflictPreview = null
    if (!wasDirty) dirty = false
    emit({
      state: 'idle',
      message: `Merged ${result.merged} portfolio(s)`,
      lastAt: at,
    })
    try {
      window.dispatchEvent(new CustomEvent('mydsp-sync-applied', { detail: { merged: result.merged } }))
    } catch {
      /* ignore */
    }
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Merge failed'
    updateCfg({ lastSyncError: msg })
    emit({ state: 'error', message: msg, lastAt: status.lastAt })
    return false
  } finally {
    endApplyingRemote()
  }
}

async function doPush(cfg: SyncConfig, pass: string): Promise<void> {
  if (!dirty) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineJob('sync_push', {
      remoteUrl: cfg.remoteUrl,
      note: 'Auto-sync push while offline',
    })
    emit({ state: 'error', message: 'Offline — push queued', lastAt: status.lastAt })
    return
  }

  emit({ state: 'pushing', message: 'Pushing to cloud…', lastAt: status.lastAt })
  try {
    await pushSync(cfg.remoteUrl, pass)
    dirty = false
    const at = new Date().toISOString()
    // After push, remote matches us — record so we don't immediately re-pull ourselves
    const meta = await fetchRemoteMeta(cfg.remoteUrl).catch(() => null)
    updateCfg({
      lastSyncAt: at,
      lastSyncError: undefined,
      lastRemoteExportedAt: meta?.exportedAt ?? at,
    })
    emit({ state: 'idle', message: 'Synced', lastAt: at })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Push failed'
    updateCfg({ lastSyncError: msg })
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineJob('sync_push', { remoteUrl: cfg.remoteUrl, note: msg })
    }
    emit({ state: 'error', message: msg, lastAt: status.lastAt })
  }
}

export async function runAutoSyncCycle(reason: CycleReason = 'manual'): Promise<void> {
  const cfg = loadSyncConfig()
  if (!cfg.enabled || !cfg.remoteUrl.trim()) {
    emit({ state: 'disabled', message: 'Automatic sync is off' })
    return
  }

  hydrateSessionSyncPassphrase()
  const pass = getSessionSyncPassphrase()
  if (!pass) {
    emit({
      state: 'needs-passphrase',
      message: 'Enter passphrase in Settings (enable Remember for auto-sync)',
    })
    return
  }

  if (busy) return
  busy = true
  try {
    // Edits / tab-hide: push only (pull on resume/start/online/interval)
    if (reason === 'edit' || reason === 'hide') {
      if (dirty) await doPush(cfg, pass)
    } else {
      await doPull(cfg, pass, reason)
      if (dirty) await doPush(loadSyncConfig(), pass)
      else if (status.state === 'pulling' || status.state === 'pushing') {
        emit({ state: 'idle', lastAt: loadSyncConfig().lastSyncAt })
      }
    }
  } finally {
    busy = false
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') {
    void runAutoSyncCycle('focus')
  } else if (document.visibilityState === 'hidden') {
    // Best-effort flush before tab sleep
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
    if (dirty) void runAutoSyncCycle('hide')
  }
}

function onFocus(): void {
  void runAutoSyncCycle('focus')
}

function onOnline(): void {
  void runAutoSyncCycle('online')
}

/** Start background listeners (idempotent). Call once from PortfolioProvider. */
export function startAutoSync(): void {
  if (started || typeof window === 'undefined') return
  started = true
  hydrateSessionSyncPassphrase()

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onOnline)

  periodicTimer = setInterval(() => {
    void runAutoSyncCycle('interval')
  }, PERIODIC_MS)

  // Initial pull/push after UI settles
  window.setTimeout(() => {
    void runAutoSyncCycle('start')
  }, 2_000)
}

export function stopAutoSync(): void {
  if (!started) return
  started = false
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('online', onOnline)
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = null
  if (periodicTimer) clearInterval(periodicTimer)
  periodicTimer = null
}

/** Force an immediate sync cycle (Settings “Sync now”). */
export async function syncNow(): Promise<void> {
  dirty = true
  await runAutoSyncCycle('manual')
}
