/** Sync status chip for the app header — tap opens Settings; long-press forces sync. */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  forceSyncNow,
  getAutoSyncStatus,
  subscribeAutoSync,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'
import { loadOfflineQueue } from '../services/offlineQueue'
import { triggerSuccessFlash } from '../utils/successFlash'

const LONG_PRESS_MS = 650

function relativeTime(iso?: string): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`
  if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`
  return `${Math.max(1, Math.round(sec / 86400))}d ago`
}

function chipLabel(
  s: AutoSyncStatus,
  offlineQueued: number,
  compact: boolean,
): string | null {
  switch (s.state) {
    case 'pulling':
      return compact ? 'Pulling' : 'Pulling…'
    case 'pushing':
      return compact ? 'Pushing' : 'Pushing…'
    case 'conflict':
      return 'Conflicts'
    case 'error':
      return compact ? 'Error' : 'Sync error'
    case 'needs-passphrase':
      return compact ? 'Key' : 'Passphrase'
    case 'disabled':
      return null
    case 'idle': {
      if (offlineQueued > 0) return compact ? `Q ${offlineQueued}` : `Queued ${offlineQueued}`
      const ago = relativeTime(s.lastAt)
      if (ago) {
        // Compact phone strip: avoid "Synced · just now" crowding the header
        if (compact && ago === 'just now') return 'Synced'
        return compact ? `Synced ${ago}` : `Synced · ${ago}`
      }
      if (s.message === 'Synced') return 'Synced'
      return null
    }
    default:
      return null
  }
}

function chipTone(state: AutoSyncStatus['state'], offlineQueued: number): string {
  if (state === 'conflict' || state === 'error' || state === 'needs-passphrase') {
    return 'sync-chip sync-chip--warn'
  }
  if (state === 'pulling' || state === 'pushing') {
    return 'sync-chip sync-chip--busy'
  }
  if (offlineQueued > 0) return 'sync-chip sync-chip--warn'
  return 'sync-chip sync-chip--ok'
}

interface SyncStatusChipProps {
  /** Shorter label for the dedicated phone sync strip (never in the burger row). */
  compact?: boolean
}

export function SyncStatusChip({ compact = false }: SyncStatusChipProps) {
  const [status, setStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)
  const [syncingNow, setSyncingNow] = useState(false)
  const [flashLabel, setFlashLabel] = useState<string | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const longPressHandledRef = useRef(false)
  const cfg = loadSyncConfig()
  const configured = Boolean(cfg.enabled && cfg.remoteUrl.trim())

  useEffect(() => subscribeAutoSync(setStatus), [])
  useEffect(() => {
    const refresh = () => setQueueLen(loadOfflineQueue().length)
    window.addEventListener('mydsp-offline-queue', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('mydsp-offline-queue', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])

  const clearLongPressTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const emitChipToast = (detail: {
    type?: 'success' | 'info' | 'warning' | 'error'
    title: string
    message?: string
  }) => {
    try {
      window.dispatchEvent(new CustomEvent('mydsp-toast', { detail }))
    } catch {
      /* ignore */
    }
  }

  const runLongPressSync = async () => {
    if (syncingNow) return
    setSyncingNow(true)
    setFlashLabel(null)
    try {
      await forceSyncNow()
      const next = getAutoSyncStatus()
      setStatus(next)
      if (next.state === 'error' || next.state === 'needs-passphrase' || next.state === 'conflict') {
        emitChipToast({
          type: next.state === 'conflict' ? 'warning' : 'error',
          title: next.state === 'conflict' ? 'Sync needs review' : 'Sync needs attention',
          message: next.message ?? 'Open Settings -> Sync.',
        })
        return
      }
      triggerSuccessFlash()
      setFlashLabel('Synced now')
      emitChipToast({
        type: 'success',
        title: 'Sync now finished',
        message: 'Devices are up to date.',
      })
      window.setTimeout(() => setFlashLabel(null), 1800)
    } catch (e) {
      emitChipToast({
        type: 'error',
        title: 'Sync failed',
        message: e instanceof Error ? e.message : 'Open Settings -> Sync.',
      })
    } finally {
      setSyncingNow(false)
    }
  }

  const startLongPressTimer = () => {
    clearLongPressTimer()
    longPressHandledRef.current = false
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      longPressHandledRef.current = true
      void runLongPressSync()
    }, LONG_PRESS_MS)
  }

  useEffect(() => () => clearLongPressTimer(), [])

  if (!configured) return null
  const label = flashLabel ?? (syncingNow ? 'Syncing…' : chipLabel(status, queueLen, compact))
  if (!label) return null

  const detailParts = [
    status.message,
    status.lastAt ? `Last sync ${new Date(status.lastAt).toLocaleString()}` : null,
    queueLen > 0 ? `${queueLen} offline job(s)` : null,
    'Long-press to sync now',
    'Tap for Settings → Sync',
  ].filter(Boolean)
  const detail = detailParts.join(' · ') || 'Cloud sync'

  return (
    <Link
      to="/settings#sync"
      className={`${chipTone(syncingNow ? 'pushing' : status.state, queueLen)}${
        compact ? ' sync-chip--compact' : ''
      }${flashLabel ? ' sync-chip--flash' : ''}`}
      title={detail}
      aria-label={`Cloud sync: ${label}. Long-press to sync now; tap to open Settings.`}
      onPointerDown={() => startLongPressTimer()}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onPointerLeave={clearLongPressTimer}
      onContextMenu={(e) => {
        if (longPressHandledRef.current) e.preventDefault()
      }}
      onClick={(e) => {
        if (longPressHandledRef.current) {
          e.preventDefault()
          longPressHandledRef.current = false
        }
      }}
    >
      <span className="sync-chip-dot" aria-hidden />
      <span className="sync-chip-label">{label}</span>
    </Link>
  )
}
