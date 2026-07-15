/** Getting-started checklist — dismissible onboarding for David’s workflow. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, X } from 'lucide-react'
import { loadSyncConfig } from '../services/sync/syncService'
import { hasRememberedSyncPassphrase, getSessionSyncPassphrase } from '../services/sync/sessionPassphrase'
import { usePortfolio } from '../context/PortfolioContext'

const DISMISS_KEY = 'mydsp_getting_started_dismissed'

type Step = {
  id: string
  label: string
  to: string
  done: boolean
}

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissGettingStarted(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function GettingStartedChecklist() {
  const { data } = usePortfolio()
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [, bump] = useState(0)

  useEffect(() => {
    const onSync = () => bump((n) => n + 1)
    window.addEventListener('mydsp-autosync', onSync)
    return () => window.removeEventListener('mydsp-autosync', onSync)
  }, [])

  if (dismissed) return null

  const cfg = loadSyncConfig()
  const passOk = Boolean(getSessionSyncPassphrase() || hasRememberedSyncPassphrase())
  const syncOk = Boolean(cfg.enabled && cfg.remoteUrl.trim() && passOk && cfg.rememberPassphrase)
  const residencyOk = Boolean(data.settings?.taxResidency)
  const hasTrades = (data.journal?.length ?? 0) > 0 || (data.disposals?.length ?? 0) > 0
  const hasTodos = (data.todoItems?.length ?? 0) > 0

  const steps: Step[] = [
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
  ]

  const doneCount = steps.filter((s) => s.done).length

  useEffect(() => {
    if (doneCount === steps.length && !dismissed) {
      dismissGettingStarted()
      setDismissed(true)
    }
  }, [doneCount, steps.length, dismissed])

  if (dismissed || doneCount === steps.length) return null

  return (
    <section
      className="surface border-l-2 border-l-accent px-4 sm:px-5 py-4 mb-6 animate-fade-in"
      aria-labelledby="getting-started-heading"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="eyebrow tracking-[0.16em] text-accent mb-1">Getting started</p>
          <h2 id="getting-started-heading" className="text-sm font-bold tracking-tight">
            Make MyDSP yours · {doneCount}/{steps.length}
          </h2>
        </div>
        <button
          type="button"
          className="toolbar-icon shrink-0"
          aria-label="Dismiss getting started"
          title="Dismiss"
          onClick={() => {
            dismissGettingStarted()
            setDismissed(true)
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              to={s.to}
              className="flex items-center gap-2.5 min-h-11 text-sm text-text-muted hover:text-text transition-colors"
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
    </section>
  )
}
