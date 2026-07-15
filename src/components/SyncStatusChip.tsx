/** Sync status chip for the app header — tappable deep-link to Settings → Sync. */

import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  getAutoSyncStatus,
  subscribeAutoSync,
  syncNow,
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

function chipLabel(s: AutoSyncStatus, offlineQueued: number): string | null {
  switch (s.state) {
    case 'pulling':
      return 'Pulling…'
    case 'pushing':
      return 'Pushing…'
    case 'conflict':
      return 'Conflicts'
    case 'error':
      return 'Sync error'
    case 'needs-passphrase':
      return 'Passphrase'
    case 'disabled':
      return null
    case 'idle': {
      if (offlineQueued > 0) return `Queued ${offlineQueued}`
      const ago = relativeTime(s.lastAt)
      if (ago) return `Synced · ${ago}`
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

export function SyncStatusChip() {
  const [status, setStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)
  const [syncing, setSyncing] = useState(false)
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
  const label = chipLabel(status, queueLen)
  if (!label) return null

  const detailParts = [
    status.message,
    status.lastAt ? `Last sync ${new Date(status.lastAt).toLocaleString()}` : null,
    queueLen > 0 ? `${queueLen} offline job(s)` : null,
  ].filter(Boolean)
  const detail = detailParts.join(' · ') || 'Cloud sync'

  const onSyncNow = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (syncing) return
    setSyncing(true)
    try {
      await syncNow()
    } catch {
      /* status chip shows error state */
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={`${chipTone(status.state, queueLen)} inline-flex items-center gap-1`}>
      <Link
        to="/settings#sync"
        className="inline-flex items-center gap-1.5 min-h-8"
        title={detail}
        aria-label={`Cloud sync: ${label}. Open Settings.`}
      >
        <span className="sync-chip-dot" aria-hidden />
        <span className="sync-chip-label">{label}</span>
      </Link>
      <button
        type="button"
        className="sync-chip-action text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 min-h-8 opacity-80 hover:opacity-100"
        title="Sync now"
        aria-label="Sync now"
        disabled={syncing || status.state === 'pulling' || status.state === 'pushing'}
        onClick={(e) => void onSyncNow(e)}
      >
        {syncing ? '…' : 'Now'}
      </button>
    </div>
  )
}
