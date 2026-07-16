/** Sync status chip for the app header — tappable deep-link to Settings → Sync. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAutoSyncStatus,
  subscribeAutoSync,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'
import { loadOfflineQueue } from '../services/offlineQueue'

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

  if (!configured) return null
  const label = chipLabel(status, queueLen, compact)
  if (!label) return null

  const detailParts = [
    status.message,
    status.lastAt ? `Last sync ${new Date(status.lastAt).toLocaleString()}` : null,
    queueLen > 0 ? `${queueLen} offline job(s)` : null,
    'Open Settings → Sync to sync now',
  ].filter(Boolean)
  const detail = detailParts.join(' · ') || 'Cloud sync'

  return (
    <Link
      to="/settings#sync"
      className={`${chipTone(status.state, queueLen)}${compact ? ' sync-chip--compact' : ''}`}
      title={detail}
      aria-label={`Cloud sync: ${label}. Open Settings to sync now.`}
    >
      <span className="sync-chip-dot" aria-hidden />
      <span className="sync-chip-label">{label}</span>
    </Link>
  )
}
