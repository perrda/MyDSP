/** Phone/tablet sheet when auto-sync finds conflicts — deep-links to Settings resolve UI. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getPendingAutoSyncConflicts,
  isAutoSyncPaused,
  pauseAutoSync,
  resumeAutoSync,
} from '../services/sync/autoSyncService'
import { loadDeviceNickname } from '../services/sync/deviceNickname'
import { summarizeConflictBatch } from '../services/sync/conflicts'
import { buildConflictSummaryText, shareConflictSummary } from '../services/sync/conflictExport'
import { loadSyncConfig } from '../services/sync/syncService'
import type { MergePreview } from '../services/sync/syncService'

export function SyncConflictSheet() {
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [paused, setPaused] = useState(() => isAutoSyncPaused())
  const [deviceNick] = useState(() => loadDeviceNickname())
  const [copyHint, setCopyHint] = useState<string | null>(null)

  useEffect(() => {
    const hydrate = () => {
      const next = getPendingAutoSyncConflicts()
      if (next?.conflicts?.length) {
        setPreview(next)
        setDismissed(false)
      } else {
        setPreview(null)
      }
      setPaused(isAutoSyncPaused(loadSyncConfig()))
    }
    hydrate()
    window.addEventListener('mydsp-sync-conflicts', hydrate)
    window.addEventListener('mydsp-sync-applied', hydrate)
    window.addEventListener('mydsp-autosync', hydrate)
    return () => {
      window.removeEventListener('mydsp-sync-conflicts', hydrate)
      window.removeEventListener('mydsp-sync-applied', hydrate)
      window.removeEventListener('mydsp-autosync', hydrate)
    }
  }, [])

  if (dismissed || !preview?.conflicts?.length) return null

  const count = preview.conflicts.length

  return (
    <div className="fixed inset-0 z-[1490]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm md:bg-bg/40"
        aria-label="Dismiss conflict sheet"
        onClick={() => setDismissed(true)}
      />
      <div
        className="sync-conflict-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-sheet-title"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent mb-1">Sync</p>
        <h2 id="sync-conflict-sheet-title" className="text-base font-bold tracking-tight mb-1">
          {count} conflict{count === 1 ? '' : 's'} to review
        </h2>
        <p className="text-xs text-text-muted leading-relaxed mb-1">
          {summarizeConflictBatch(preview.conflicts)} Choose Keep local or Keep remote in Settings —
          nothing is written until you Apply merge.
        </p>
        <p className="text-xs text-text-subtle mb-4">
          This device: <span className="text-text font-medium">{deviceNick}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/settings#sync-conflicts-panel"
            className="btn-primary btn-sm min-h-11"
            onClick={() => setDismissed(true)}
          >
            Review in Settings
          </Link>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-11"
            onClick={() => {
              void (async () => {
                const text = buildConflictSummaryText(preview.conflicts)
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text)
                    setCopyHint('Copied summary')
                  } else {
                    const result = await shareConflictSummary(preview.conflicts)
                    setCopyHint(result === 'shared' ? 'Shared' : 'Downloaded')
                  }
                } catch {
                  const result = await shareConflictSummary(preview.conflicts)
                  setCopyHint(result === 'cancelled' ? null : 'Downloaded')
                }
                window.setTimeout(() => setCopyHint(null), 2500)
              })()
            }}
          >
            {copyHint ?? 'Copy summary'}
          </button>
          <button type="button" className="btn-ghost btn-sm min-h-11" onClick={() => setDismissed(true)}>
            Later
          </button>
          {paused ? (
            <button
              type="button"
              className="btn-secondary btn-sm min-h-11"
              onClick={() => {
                resumeAutoSync({ toast: true })
                setPaused(false)
              }}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost btn-sm min-h-11"
              onClick={() => {
                pauseAutoSync(3_600_000)
                setPaused(true)
              }}
            >
              Pause 1 hour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
