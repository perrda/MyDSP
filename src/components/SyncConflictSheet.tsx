/** Phone/tablet sheet when auto-sync finds conflicts — deep-links to Settings resolve UI. */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToasts } from './ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import {
  clearPendingAutoSyncConflicts,
  getPendingAutoSyncConflicts,
  isAutoSyncPaused,
  pauseAutoSync,
  restorePendingAutoSyncConflicts,
  resumeAutoSync,
} from '../services/sync/autoSyncService'
import { loadDeviceNickname } from '../services/sync/deviceNickname'
import {
  conflictKey,
  summarizeConflict,
  summarizeConflictBatch,
  type ConflictChoice,
} from '../services/sync/conflicts'
import { buildConflictSummaryText, shareConflictSummary } from '../services/sync/conflictExport'
import {
  applyMergePreview,
  captureMergeUndoSnapshot,
  loadSyncConfig,
  restoreMergeUndoSnapshot,
} from '../services/sync/syncService'
import type { MergePreview, MergeUndoSnapshot } from '../services/sync/syncService'
import {
  announceWhatArrived,
  clearSyncHighlights,
  collectSyncHighlights,
  firstSyncHighlightHref,
  setSyncHighlights,
  summarizeWorkspaceExtras,
  workspaceExtrasFlagsFromPreview,
} from '../services/sync/syncHighlights'

const BULK_UNDO_MS = 10_000

export function SyncConflictSheet() {
  const { privacy } = usePortfolio()
  const { reload } = usePortfolio()
  const navigate = useNavigate()
  const { showToast } = useToasts()
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [paused, setPaused] = useState(() => isAutoSyncPaused())
  const [deviceNick] = useState(() => loadDeviceNickname())
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({})
  const [applying, setApplying] = useState(false)
  const [undo, setUndo] = useState<{
    snapshot: MergeUndoSnapshot
    preview: MergePreview
    choices: Record<string, ConflictChoice>
    count: number
    openHref: string | null
  } | null>(null)
  const lastPreviewRef = useRef<MergePreview | null>(null)
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
        if (lastPreviewRef.current !== next) setChoices({})
        lastPreviewRef.current = next
        setPreview(next)
        setDismissed(false)
      } else {
        lastPreviewRef.current = null
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

  const undoAppliedMerge = (record: NonNullable<typeof undo>) => {
    clearUndoTimer()
    restoreMergeUndoSnapshot(record.snapshot)
    clearSyncHighlights()
    restorePendingAutoSyncConflicts(record.preview)
    setChoices(record.choices)
    setPreview(record.preview)
    setDismissed(false)
    setUndo(null)
    reload()
    showToast({
      type: 'info',
      title: 'Sync merge undone',
      message: `Restored ${record.count} pre-merge portfolio snapshot${record.count === 1 ? '' : 's'} and your row choices.`,
    })
  }

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
            Applied {undo.choices ? Object.keys(undo.choices).length : 0} conflict choices. Undo available for 10s.
          </p>
          <div className="flex items-center gap-2">
            {undo.openHref ? (
              <Link className="btn-ghost btn-sm" to={undo.openHref} data-testid="sync-conflicts-open-first">
                Open first
              </Link>
            ) : null}
            <button
              type="button"
              className="btn-secondary btn-sm"
              data-testid="sync-conflicts-undo"
              onClick={() => undoAppliedMerge(undo)}
            >
              Undo
            </button>
          </div>
        </div>
      </div>
    )
  }

  const activePreview = preview
  if (!activePreview || activePreview.conflicts.length === 0) return null

  const count = activePreview.conflicts.length

  const allRowsChosen = activePreview.conflicts.every((c) => Boolean(choices[conflictKey(c)]))
  const chooseAll = (choice: ConflictChoice) => {
    const next: Record<string, ConflictChoice> = {}
    for (const c of activePreview.conflicts) next[conflictKey(c)] = choice
    setChoices(next)
  }

  const applyChoices = () => {
    if (!allRowsChosen || applying) return
    const resolutions = { ...choices }
    const bulkChoice = activePreview.conflicts.every(
      (c) => resolutions[conflictKey(c)] === resolutions[conflictKey(activePreview.conflicts[0])],
    )
      ? resolutions[conflictKey(activePreview.conflicts[0])]
      : undefined
    setApplying(true)
    void (async () => {
      try {
        const undoSnapshot = captureMergeUndoSnapshot(activePreview)
        const highlights = collectSyncHighlights(
          activePreview.portfolios.map((p) => ({ local: p.local, remote: p.remote })),
        )
        const result = await applyMergePreview(activePreview, resolutions)
        clearPendingAutoSyncConflicts()
        setPreview(null)
        setDismissed(false)
        reload()
        const hasHighlights = Object.values(highlights).some((ids) => (ids?.length ?? 0) > 0)
        if (hasHighlights) setSyncHighlights(highlights)
        const extrasSummary = summarizeWorkspaceExtras(
          workspaceExtrasFlagsFromPreview(activePreview.workspaceExtras),
        )
        const summary = announceWhatArrived({
          highlights,
          extrasSummary,
          merged: result.merged,
        })
        const openHref = firstSyncHighlightHref(highlights)
        const record = {
          snapshot: undoSnapshot,
          preview: activePreview,
          choices: resolutions,
          count: activePreview.portfolios.length,
          openHref,
        }
        clearUndoTimer()
        setUndo(record)
        undoTimerRef.current = window.setTimeout(() => {
          setUndo(null)
          undoTimerRef.current = null
        }, BULK_UNDO_MS)
        const actions = [
          {
            label: 'Undo',
            onClick: () => undoAppliedMerge(record),
          },
        ]
        if (openHref) {
          actions.push({
            label: 'Open first',
            onClick: () => navigate(openHref),
          })
        }
        showToast({
          type: 'success',
          title: 'Sync conflicts applied',
          message: `${summary ?? `${result.merged} portfolio${result.merged === 1 ? '' : 's'} merged`}${
            bulkChoice ? ` · kept all ${bulkChoice}` : ''
          }. Undo for 10s.`,
          duration: BULK_UNDO_MS,
          actions,
          className: 'sync-conflicts-applied-toast',
        })
      } catch {
        setCopyHint('Open Settings to Apply')
        window.setTimeout(() => setCopyHint(null), 2500)
      } finally {
        setApplying(false)
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
          {summarizeConflictBatch(activePreview.conflicts)} Choose local or remote for every row, then
          Apply. Keep-all remains a shortcut.
        </p>
        <p className="text-xs text-text-subtle mb-4">
          This device: <span className="text-text font-medium">{deviceNick}</span>
        </p>
        {privacy ? (
          <p className="mb-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" role="alert">
            Privacy mode is on. Conflict summaries can include amounts or private text, so share/copy is blocked.
          </p>
        ) : null}
        <div className="mb-4 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {activePreview.conflicts.map((conflict) => {
            const key = conflictKey(conflict)
            return (
              <div
                key={key}
                className="border border-border/60 bg-bg-elevated p-3"
                data-testid="sync-conflict-row"
                data-conflict-key={key}
              >
                <p className="mb-2 text-xs leading-relaxed text-text-muted">
                  {summarizeConflict(conflict)}
                </p>
                <div
                  className="grid grid-cols-2 gap-2"
                  role="group"
                  aria-label={`Resolve ${conflict.localLabel || conflict.remoteLabel}`}
                >
                  <button
                    type="button"
                    className={`btn-sm min-h-11 ${
                      choices[key] === 'local' ? 'btn-primary' : 'btn-secondary'
                    }`}
                    aria-pressed={choices[key] === 'local'}
                    disabled={applying}
                    data-testid="sync-conflict-keep-local"
                    onClick={() => setChoices((prev) => ({ ...prev, [key]: 'local' }))}
                  >
                    Keep local
                  </button>
                  <button
                    type="button"
                    className={`btn-sm min-h-11 ${
                      choices[key] === 'remote' ? 'btn-primary' : 'btn-secondary'
                    }`}
                    aria-pressed={choices[key] === 'remote'}
                    disabled={applying}
                    data-testid="sync-conflict-keep-remote"
                    onClick={() => setChoices((prev) => ({ ...prev, [key]: 'remote' }))}
                  >
                    Keep remote
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary btn-sm min-h-11"
            disabled={applying || !allRowsChosen}
            data-testid="sync-conflicts-apply"
            onClick={applyChoices}
          >
            {applying ? 'Applying…' : `Apply ${count} choice${count === 1 ? '' : 's'}`}
          </button>
          <Link
            to="/settings#sync-conflicts-panel"
            className="btn-secondary btn-sm min-h-11"
            onClick={() => setDismissed(true)}
          >
            Review in Settings
          </Link>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-11"
            disabled={applying}
            onClick={() => chooseAll('local')}
          >
            Keep all local
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-11"
            disabled={applying}
            onClick={() => chooseAll('remote')}
          >
            Keep all remote
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
