/** Sync status chip for the app header — tappable deep-link to Settings → Sync. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAutoSyncStatus,
  subscribeAutoSync,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'

function chipLabel(s: AutoSyncStatus): string | null {
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
    case 'idle':
      if (s.message === 'Synced') return 'Synced'
      if (s.lastAt) return 'Synced'
      return null
    default:
      return null
  }
}

function chipTone(state: AutoSyncStatus['state']): string {
  if (state === 'conflict' || state === 'error' || state === 'needs-passphrase') {
    return 'sync-chip sync-chip--warn'
  }
  if (state === 'pulling' || state === 'pushing') {
    return 'sync-chip sync-chip--busy'
  }
  return 'sync-chip sync-chip--ok'
}

export function SyncStatusChip() {
  const [status, setStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const cfg = loadSyncConfig()
  const configured = Boolean(cfg.enabled && cfg.remoteUrl.trim())

  useEffect(() => subscribeAutoSync(setStatus), [])

  if (!configured) return null
  const label = chipLabel(status)
  if (!label) return null

  return (
    <Link
      to="/settings#sync"
      className={chipTone(status.state)}
      title={status.message ?? 'Cloud sync'}
      aria-label={`Cloud sync: ${label}. Open Settings.`}
    >
      <span className="sync-chip-dot" aria-hidden />
      <span className="sync-chip-label">{label}</span>
    </Link>
  )
}
