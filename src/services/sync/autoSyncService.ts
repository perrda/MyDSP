/**
 * Automatic multi-device sync over Cloudflare Worker + KV.
 * Pulls when the app resumes / comes online; pushes shortly after local edits.
 * Requires SyncConfig.enabled + remoteUrl + passphrase (session or remembered).
 *
 * Timing (not realtime WebSocket sync):
 * - Push ~4s after the last local edit (debounced)
 * - Pull on open / focus / online / pull-to-refresh / Sync now / ~60s while open
 * - Edit/hide cycles pull-before-push when another device wrote the cloud envelope
 */

import { enqueueOfflineJob } from '../offlineQueue'
import {
  allConflictsResolved,
  applyMergePreview,
  applyWorkspaceExtrasFromPreview,
  fetchRemoteMeta,
  getLocalDeviceId,
  loadSyncConfig,
  previewPull,
  pushSync,
  saveSyncConfig,
  type MergePreview,
  type SyncConfig,
} from './syncService'
import { getLocalDeviceHint } from './deviceNickname'
import { conflictKey, type ConflictChoice } from './conflicts'
import { getSessionSyncPassphrase, hydrateSessionSyncPassphrase } from './sessionPassphrase'
import {
  collectSyncHighlights,
  setSyncHighlights,
  summarizeSyncHighlights,
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from './syncHighlights'

const PUSH_DEBOUNCE_MS = 4_000
const PULL_MIN_INTERVAL_MS = 8_000
/** Background pull while the tab/PWA stays open — keep ≤ price poll so UI stays calm. */
const PERIODIC_MS = 60_000

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
  /** Wall-clock ms of the last successful pull (timed in doPull) */
  lastPullMs?: number
  /** Wall-clock ms of the last successful push (timed in doPush) */
  lastPushMs?: number
}

type CycleReason = 'start' | 'focus' | 'online' | 'interval' | 'edit' | 'manual' | 'hide'

let dirty = false
/** Local edits that arrived while a remote merge was applying. */
let dirtyWhileApplying = false
let busy = false
let applyingRemote = false
let started = false
let pushTimer: ReturnType<typeof setTimeout> | null = null
let periodicTimer: ReturnType<typeof setInterval> | null = null
let lastPullAttempt = 0
let status: AutoSyncStatus = { state: 'idle' }
let pendingConflictPreview: MergePreview | null = null
/** Preserved across emit() so latency survives idle/error transitions. */
let lastPullMs: number | undefined
let lastPushMs: number | undefined
let lastLatencyKind: 'pull' | 'push' | undefined

const listeners = new Set<(s: AutoSyncStatus) => void>()

function withLatency(next: AutoSyncStatus): AutoSyncStatus {
  return {
    ...next,
    lastPullMs: next.lastPullMs ?? lastPullMs,
    lastPushMs: next.lastPushMs ?? lastPushMs,
  }
}

function emit(next: AutoSyncStatus): void {
  if (typeof next.lastPullMs === 'number') {
    lastPullMs = next.lastPullMs
    lastLatencyKind = 'pull'
  }
  if (typeof next.lastPushMs === 'number') {
    lastPushMs = next.lastPushMs
    lastLatencyKind = 'push'
  }
  status = withLatency(next)
  for (const fn of listeners) {
    try {
      fn(status)
    } catch {
      /* ignore */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('mydsp-autosync', { detail: status }))
  } catch {
    /* ignore */
  }
}

/** Which latency was recorded last — for Today syncLine. */
export function getLastSyncLatencyKind(): 'pull' | 'push' | undefined {
  return lastLatencyKind
}

let pauseResumeTimer: ReturnType<typeof setTimeout> | null = null
let pauseCountdownTimer: ReturnType<typeof setTimeout> | null = null

function clearPauseTimers(): void {
  if (pauseResumeTimer) {
    clearTimeout(pauseResumeTimer)
    pauseResumeTimer = null
  }
  if (pauseCountdownTimer) {
    clearTimeout(pauseCountdownTimer)
    pauseCountdownTimer = null
  }
}

function emitAppToast(detail: {
  type?: 'success' | 'info' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number
}): void {
  try {
    window.dispatchEvent(new CustomEvent('mydsp-toast', { detail }))
  } catch {
    /* ignore */
  }
}

/** Flash “Sync resumed” (60s toast duration). */
export function flashSyncResumedToast(): void {
  emitAppToast({
    type: 'success',
    title: 'Sync resumed',
    duration: 60_000,
  })
}

/** Optional 60s countdown toast before auto-resume (or when resuming early). */
export function flashSyncResumeCountdownToast(seconds = 60): void {
  const start = Math.max(1, Math.min(60, Math.floor(seconds)))
  emitAppToast({
    type: 'info',
    title: `Sync resumes in ${start}s`,
    message: 'Auto-sync will continue when the countdown ends.',
    duration: start * 1000,
  })
}

function schedulePauseAutoResume(untilIso: string): void {
  clearPauseTimers()
  const ms = new Date(untilIso).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) {
    resumeAutoSync({ toast: true })
    return
  }
  // Last 60s: countdown toast option
  if (ms > 60_000) {
    pauseCountdownTimer = setTimeout(() => {
      flashSyncResumeCountdownToast(60)
    }, ms - 60_000)
  } else {
    flashSyncResumeCountdownToast(Math.ceil(ms / 1000))
  }
  pauseResumeTimer = setTimeout(() => {
    pauseResumeTimer = null
    resumeAutoSync({ toast: true })
    void runAutoSyncCycle('interval')
  }, ms)
}

/** Pause automatic sync for `ms` (default 1 hour). Schedules auto-resume + optional countdown. */
export function pauseAutoSync(ms = 3_600_000): SyncConfig {
  const until = new Date(Date.now() + ms).toISOString()
  const next = updateCfg({ pausedUntil: until })
  schedulePauseAutoResume(until)
  return next
}

export type ResumeAutoSyncOpts = {
  /** Show “Sync resumed” toast (default true). */
  toast?: boolean
}

/** Clear pausedUntil so auto-sync resumes. */
export function resumeAutoSync(opts: ResumeAutoSyncOpts = {}): SyncConfig {
  clearPauseTimers()
  const cfg = loadSyncConfig()
  const next = { ...cfg }
  delete next.pausedUntil
  saveSyncConfig(next)
  if (opts.toast !== false) flashSyncResumedToast()
  try {
    window.dispatchEvent(new CustomEvent('mydsp-autosync', { detail: getAutoSyncStatus() }))
  } catch {
    /* ignore */
  }
  return next
}

export function isAutoSyncPaused(cfg: SyncConfig = loadSyncConfig()): boolean {
  if (!cfg.pausedUntil) return false
  return new Date(cfg.pausedUntil).getTime() > Date.now()
}

/** Re-arm pause auto-resume timer after reload (call from startAutoSync). */
export function armPauseAutoResumeIfNeeded(): void {
  const cfg = loadSyncConfig()
  if (!cfg.pausedUntil) return
  const ms = new Date(cfg.pausedUntil).getTime() - Date.now()
  if (ms <= 0) {
    resumeAutoSync({ toast: true })
    return
  }
  schedulePauseAutoResume(cfg.pausedUntil)
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
  if (dirtyWhileApplying) {
    dirtyWhileApplying = false
    markLocalDataChanged()
  }
}

export function isApplyingRemote(): boolean {
  return applyingRemote
}

export function markLocalDataChanged(): void {
  if (applyingRemote) {
    dirtyWhileApplying = true
    return
  }
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

/**
 * Before pushing local edits, pull if another device wrote a newer envelope.
 * Prevents phone Markets noise / stale local from overwriting a fresh web todo.
 */
async function pullBeforePushIfNeeded(cfg: SyncConfig, pass: string): Promise<void> {
  let meta: Awaited<ReturnType<typeof fetchRemoteMeta>>
  try {
    meta = await fetchRemoteMeta(cfg.remoteUrl)
  } catch {
    return
  }
  if (!meta) return

  const localDevice = getLocalDeviceId()
  const fromOther = meta.deviceId !== localDevice
  const seenThis = cfg.lastRemoteExportedAt === meta.exportedAt
  if (!fromOther || seenThis) return

  // Force past the normal pull throttle — we are about to overwrite the store.
  await doPull(cfg, pass, 'manual')
}

async function doPull(cfg: SyncConfig, pass: string, reason: CycleReason): Promise<boolean> {
  const now = Date.now()
  if (reason !== 'manual' && reason !== 'start' && now - lastPullAttempt < PULL_MIN_INTERVAL_MS) {
    return false
  }
  lastPullAttempt = now
  const pullStarted = Date.now()

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
      // Portfolio conflicts must not block YouTube / News / Markets across devices
      beginApplyingRemote()
      try {
        await applyWorkspaceExtrasFromPreview(preview)
      } catch (e) {
        console.warn('[auto-sync] workspace extras while conflict parked:', e)
      } finally {
        endApplyingRemote()
      }
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
  let removedDupes = 0
  try {
    const highlights = collectSyncHighlights(
      preview.portfolios.map((p) => ({ local: p.local, remote: p.remote })),
    )
    const hasHighlights = Object.values(highlights).some((ids) => (ids?.length ?? 0) > 0)
    if (hasHighlights) setSyncHighlights(highlights)

    const result = await applyMergePreview(preview, resolutions)
    removedDupes = result.removedDupes
    const at = new Date().toISOString()
    const pullMs = Date.now() - pullStarted
    updateCfg({
      lastSyncAt: at,
      lastSyncError: undefined,
      lastMergeCount: result.merged,
      lastRemoteExportedAt: meta.exportedAt,
      ...(meta.encryptedBytes !== undefined ? { lastRemoteBlobBytes: meta.encryptedBytes } : {}),
    })
    pendingConflictPreview = null
    if (!wasDirty) dirty = false
    // Local cleanup after a dirty cloud registry — push so other devices heal too
    if (removedDupes > 0 || preview.remoteHadDuplicateNames) dirty = true
    emit({
      state: 'idle',
      message:
        removedDupes > 0 || preview.remoteHadDuplicateNames
          ? `Merged ${result.merged} portfolio(s); cleaned duplicate portfolio names`
          : `Merged ${result.merged} portfolio(s)`,
      lastAt: at,
      lastPullMs: pullMs,
    })
    try {
      const { appendSyncActivity } = await import('./syncActivity')
      appendSyncActivity({
        source: 'auto',
        message: `Pulled and merged ${result.merged} portfolio(s)`,
        merged: result.merged,
        conflicts: result.conflicts.length,
        at,
        deviceHint: meta.deviceId || getLocalDeviceHint(),
      })
    } catch {
      /* ignore */
    }
    {
      const entitySummary = hasHighlights ? summarizeSyncHighlights(highlights) : null
      const extrasSummary = summarizeWorkspaceExtras(
        workspaceExtrasFlagsFromPreview(preview.workspaceExtras),
      )
      const summary = [entitySummary, extrasSummary].filter(Boolean).join(' · ') || null
      try {
        window.dispatchEvent(
          new CustomEvent('mydsp-sync-applied', {
            detail: {
              merged: result.merged,
              highlights,
              extrasSummary,
              summary,
            },
          }),
        )
      } catch {
        /* ignore */
      }
      if (summary) {
        emitAppToast({
          type: 'success',
          title: 'What arrived',
          message: summary,
          duration: 6000,
        })
      }
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

  const pushStarted = Date.now()
  emit({ state: 'pushing', message: 'Pushing to cloud…', lastAt: status.lastAt })
  try {
    const pushed = await pushSync(cfg.remoteUrl, pass)
    dirty = false
    const at = new Date().toISOString()
    const pushMs = Date.now() - pushStarted
    // After push, remote matches us — record so we don't immediately re-pull ourselves
    const meta = await fetchRemoteMeta(cfg.remoteUrl).catch(() => null)
    updateCfg({
      lastSyncAt: at,
      lastSyncError: undefined,
      lastRemoteExportedAt: meta?.exportedAt ?? pushed.exportedAt,
      lastRemoteBlobBytes: meta?.encryptedBytes ?? pushed.bytes,
      lastPushBytes: pushed.bytes,
    })
    emit({ state: 'idle', message: 'Synced', lastAt: at, lastPushMs: pushMs })
    try {
      const { appendSyncActivity } = await import('./syncActivity')
      appendSyncActivity({
        source: 'push',
        message: 'Pushed local changes to cloud',
        at,
        deviceHint: getLocalDeviceHint(),
      })
    } catch {
      /* ignore */
    }
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

  if (isAutoSyncPaused(cfg)) {
    emit({
      state: 'idle',
      message: `Auto-sync paused until ${new Date(cfg.pausedUntil!).toLocaleString()}`,
      lastAt: cfg.lastSyncAt ?? status.lastAt,
    })
    return
  }

  // Clear expired pause marker (timer may have been missed while tab slept)
  if (cfg.pausedUntil) {
    resumeAutoSync({ toast: true })
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

  if (busy) {
    // Do not drop scheduled work — re-arm push if still dirty
    if (dirty) schedulePush()
    return
  }
  busy = true
  try {
    if (reason === 'edit' || reason === 'hide') {
      // Pull-before-push when another device wrote cloud — then upload our merge
      await pullBeforePushIfNeeded(cfg, pass)
      if (dirty) await doPush(loadSyncConfig(), pass)
    } else {
      await doPull(cfg, pass, reason)
      if (dirty) await doPush(loadSyncConfig(), pass)
      else if (status.state === 'pulling' || status.state === 'pushing') {
        emit({ state: 'idle', lastAt: loadSyncConfig().lastSyncAt })
      }
    }
  } finally {
    busy = false
    // Edits during this cycle (or a dropped busy return) still need a push
    if (dirty && !pushTimer) schedulePush()
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
  armPauseAutoResumeIfNeeded()

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
  clearPauseTimers()
}

/** Force an immediate sync cycle (Settings “Sync now”). */
export async function forceSyncNow(): Promise<void> {
  dirty = true
  await runAutoSyncCycle('manual')
}

/** Back-compat alias for existing Settings / pull-to-refresh callers. */
export async function syncNow(): Promise<void> {
  await forceSyncNow()
}
