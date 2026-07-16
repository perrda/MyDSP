/** Phone/tablet sheet when auto-sync finds conflicts — deep-links to Settings resolve UI. */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import {
  clearPendingAutoSyncConflicts,
  getPendingAutoSyncConflicts,
  isAutoSyncPaused,
  pauseAutoSync,
  resumeAutoSync,
} from '../services/sync/autoSyncService'
import { loadDeviceNickname } from '../services/sync/deviceNickname'
import { conflictKey, summarizeConflictBatch, type ConflictChoice } from '../services/sync/conflicts'
import { buildConflictSummaryText, shareConflictSummary } from '../services/sync/conflictExport'
import {
  applyMergePreview,
  captureMergeUndoSnapshot,
  loadSyncConfig,
  restoreMergeUndoSnapshot,
} from '../services/sync/syncService'
import type { MergePreview, MergeUndoSnapshot } from '../services/sync/syncService'

const BULK_UNDO_MS = 10_000

export function SyncConflictSheet() {
  const { privacy } = usePortfolio()
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [paused, setPaused] = useState(() => isAutoSyncPaused())
  const [deviceNick] = useState(() => loadDeviceNickname())
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [bulkApplying, setBulkApplying] = useState<ConflictChoice | null>(null)
  const [undo, setUndo] = useState<{
    snapshot: MergeUndoSnapshot
    choice: ConflictChoice
    count: number
  } | null>(null)
  const undoTimerRef = useRef<number | null>(null)

  const clearUndoTimer = () => {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

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

  useEffect(() => clearUndoTimer, [])

  if (dismissed || (!preview?.conflicts?.length && !undo)) return null

  if (!preview?.conflicts?.length && undo) {
    return (
      <div
        className="fixed inset-x-3 bottom-4 z-[1490] mx-auto max-w-md border border-accent/40 bg-bg-elevated px-4 py-3 shadow-lg"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Kept all {undo.choice === 'local' ? 'local' : 'remote'} changes. Undo available for 10s.
          </p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              clearUndoTimer()
              restoreMergeUndoSnapshot(undo.snapshot)
              setUndo(null)
              try {
                window.dispatchEvent(new CustomEvent('mydsp-sync-applied', { detail: { undo: true } }))
                window.dispatchEvent(
                  new CustomEvent('mydsp-toast', {
                    detail: {
                      type: 'info',
                      title: 'Sync conflict undo',
                      message: `Restored ${undo.count} pre-merge portfolio snapshot${undo.count === 1 ? '' : 's'}.`,
                    },
                  }),
                )
              } catch {
                /* ignore */
              }
            }}
          >
            Undo
          </button>
        </div>
      </div>
    )
  }

  const activePreview = preview
  if (!activePreview || activePreview.conflicts.length === 0) return null

  const count = activePreview.conflicts.length

  const applyAll = (choice: ConflictChoice) => {
    const resolutions: Record<string, ConflictChoice> = {}
    for (const c of activePreview.conflicts) resolutions[conflictKey(c)] = choice
    setBulkApplying(choice)
    void (async () => {
      try {
        const undoSnapshot = captureMergeUndoSnapshot(activePreview)
        const result = await applyMergePreview(activePreview, resolutions)
        clearPendingAutoSyncConflicts()
        setPreview(null)
        setDismissed(false)
        clearUndoTimer()
        setUndo({ snapshot: undoSnapshot, choice, count: activePreview.portfolios.length })
        undoTimerRef.current = window.setTimeout(() => {
          setUndo(null)
          undoTimerRef.current = null
        }, BULK_UNDO_MS)
        try {
          window.dispatchEvent(
            new CustomEvent('mydsp-sync-applied', {
              detail: {
                merged: result.merged,
                conflicts: activePreview.conflicts.length,
                bulkChoice: choice,
              },
            }),
          )
          window.dispatchEvent(
            new CustomEvent('mydsp-toast', {
              detail: {
                type: 'success',
                title: 'Sync conflicts applied',
                message: `Kept all ${choice === 'local' ? 'local' : 'remote'} changes. Undo for 10s.`,
              },
            }),
          )
        } catch {
          /* ignore */
        }
      } catch {
        setCopyHint('Open Settings to Apply')
        window.setTimeout(() => setCopyHint(null), 2500)
      } finally {
        setBulkApplying(null)
      }
    })()
  }

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
          {summarizeConflictBatch(activePreview.conflicts)} Keep all local or all remote here, or review
          each row in Settings before applying.
        </p>
        <p className="text-xs text-text-subtle mb-4">
          This device: <span className="text-text font-medium">{deviceNick}</span>
        </p>
        {privacy ? (
          <p className="mb-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" role="alert">
            Privacy mode is on. Conflict summaries can include amounts or private text, so share/copy is blocked.
          </p>
        ) : null}
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
            disabled={bulkApplying !== null}
            onClick={() => applyAll('local')}
          >
            {bulkApplying === 'local' ? 'Applying…' : 'Keep all local'}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-11"
            disabled={bulkApplying !== null}
            onClick={() => applyAll('remote')}
          >
            {bulkApplying === 'remote' ? 'Applying…' : 'Keep all remote'}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-11"
            disabled={privacy}
            onClick={() => {
              void (async () => {
                if (privacy) {
                  setCopyHint('Privacy blocks sharing')
                  window.setTimeout(() => setCopyHint(null), 2500)
                  return
                }
                const text = buildConflictSummaryText(activePreview.conflicts)
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text)
                    setCopyHint('Copied summary')
                  } else {
                    const result = await shareConflictSummary(activePreview.conflicts)
                    setCopyHint(result === 'shared' ? 'Shared' : 'Downloaded')
                  }
                } catch {
                  const result = await shareConflictSummary(activePreview.conflicts)
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
