/** First-device sync / setup card — one line for setup, cloud sync, and Finnhub. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle } from 'lucide-react'
import { loadSyncConfig } from '../services/sync/syncService'
import {
  hasRememberedSyncPassphrase,
  getSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'
import { usePortfolio } from '../context/PortfolioContext'
import {
  loadGettingStartedDismissedPref,
  saveGettingStartedDismissedPref,
} from '../domain/gettingStartedDismissedPref'
import { hasFinnhubKey } from '../domain/finnhubReminder'

type Step = {
  id: string
  label: string
  to: string
  done: boolean
}

export function dismissGettingStarted(): void {
  saveGettingStartedDismissedPref(true)
}

function buildSteps(data: ReturnType<typeof usePortfolio>['data']): Step[] {
  const cfg = loadSyncConfig()
  const passOk = Boolean(getSessionSyncPassphrase() || hasRememberedSyncPassphrase())
  const syncOk = Boolean(cfg.enabled && cfg.remoteUrl.trim() && passOk && cfg.rememberPassphrase)
  const residencyOk = Boolean(data.settings?.taxResidency)
  const hasTrades = (data.journal?.length ?? 0) > 0 || (data.disposals?.length ?? 0) > 0
  const hasTodos = (data.todoItems?.length ?? 0) > 0
  const finnhubOk = hasFinnhubKey(data)

  return [
    {
      id: 'sync',
      label: 'Turn on Automatic sync + Remember passphrase',
      to: '/settings#sync',
      done: syncOk,
    },
    {
      id: 'residency',
      label: 'Confirm tax residency (Settings → Display)',
      to: '/settings#display',
      done: residencyOk,
    },
    {
      id: 'trades',
      label: 'Import a trade CSV or opening balances',
      to: '/settings#trade-history',
      done: hasTrades,
    },
    {
      id: 'todos',
      label: 'Add a task on web, pull-to-refresh on phone',
      to: '/todos',
      done: hasTodos,
    },
    {
      id: 'finnhub',
      label: 'Add Finnhub for live equity quotes (optional)',
      to: '/settings#prices',
      done: finnhubOk,
    },
  ]
}

function oneLine(steps: Step[], syncLine: string): { text: string; to: string } {
  const next = steps.find((s) => !s.done)
  if (next?.id === 'sync') {
    return { text: 'Set up cloud sync to use this device everywhere', to: next.to }
  }
  if (next?.id === 'finnhub' && steps.filter((s) => s.id !== 'finnhub').every((s) => s.done)) {
    return { text: 'Finnhub not configured — optional for live equity quotes', to: next.to }
  }
  if (next) {
    return { text: next.label, to: next.to }
  }
  if (syncLine) return { text: syncLine, to: '/settings#sync' }
  return { text: 'Cloud sync ready', to: '/settings#sync' }
}

export function GettingStartedChecklist({
  syncLine = '',
  asCard = false,
}: {
  syncLine?: string
  asCard?: boolean
}) {
  const { data } = usePortfolio()
  const [dismissed, setDismissed] = useState(loadGettingStartedDismissedPref)
  const [expanded, setExpanded] = useState(false)
  const [, bump] = useState(0)

  const steps = buildSteps(data)
  const coreSteps = steps.filter((s) => s.id !== 'finnhub')
  const doneCount = coreSteps.filter((s) => s.done).length
  const complete = doneCount === coreSteps.length
  const line = oneLine(steps, syncLine)

  useEffect(() => {
    const onSync = () => bump((n) => n + 1)
    window.addEventListener('mydsp-autosync', onSync)
    return () => window.removeEventListener('mydsp-autosync', onSync)
  }, [])

  useEffect(() => {
    if (complete && !dismissed) {
      dismissGettingStarted()
      setDismissed(true)
    }
  }, [complete, dismissed])

  const finnhubMissing = !hasFinnhubKey(data)
  if (dismissed && !complete) return null
  if (dismissed && complete && !finnhubMissing && !syncLine) return null
  if (dismissed && complete && !asCard) return null

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold mb-1">
            Sync
          </p>
          <button
            type="button"
            className="text-sm text-text-muted hover:text-accent font-light leading-snug text-left"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {complete && !finnhubMissing
              ? syncLine || 'Cloud sync ready'
              : !complete
                ? `Setup ${doneCount}/${coreSteps.length} — ${line.text}`
                : line.text}
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="btn-ghost btn-sm text-[11px]"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide' : 'Steps'}
          </button>
          {!complete ? (
            <button
              type="button"
              className="btn-ghost btn-sm text-[11px]"
              aria-label="Dismiss getting started"
              onClick={() => {
                dismissGettingStarted()
                setDismissed(true)
              }}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <ul className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.id}>
              <Link
                to={s.to}
                className="flex items-center gap-2.5 min-h-11 text-sm text-text-muted hover:text-text transition-colors"
                onClick={() => setExpanded(false)}
              >
                {s.done ? (
                  <Check size={16} className="text-accent shrink-0" strokeWidth={2} />
                ) : (
                  <Circle size={16} className="text-text-subtle shrink-0" strokeWidth={1.5} />
                )}
                <span className={s.done ? 'line-through opacity-60' : ''}>{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )

  if (asCard) {
    if (dismissed && complete && !finnhubMissing && !syncLine) return null
    return (
      <section
        id="today-sync-setup"
        className="today-sync-setup-card surface p-4 md:p-5 mb-3 rounded-xl md:rounded-none shadow-sm md:shadow-none"
        aria-label="Setup and sync"
      >
        {body}
      </section>
    )
  }

  if (dismissed || complete) return null

  return (
    <span className="inline-flex items-center gap-2">
      <Link to={line.to} className="text-text-subtle hover:text-accent font-medium">
        Setup {doneCount}/{coreSteps.length} →
      </Link>
    </span>
  )
}
