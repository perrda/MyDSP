/** Getting-started checklist — dismissible onboarding for David’s workflow. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, X } from 'lucide-react'
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
  ]
}

export function GettingStartedChecklist() {
  const { data } = usePortfolio()
  const [dismissed, setDismissed] = useState(loadGettingStartedDismissedPref)
  const [expanded, setExpanded] = useState(false)
  const [, bump] = useState(0)

  const steps = buildSteps(data)
  const doneCount = steps.filter((s) => s.done).length
  const complete = doneCount === steps.length

  // Hooks must run unconditionally (no early return above this line).
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

  if (dismissed || complete) return null

  const nextUndone = steps.find((s) => !s.done)

  return (
    <Link
      to={nextUndone?.to || '/settings#sync'}
      className="text-text-subtle hover:text-accent font-medium"
      title={nextUndone ? nextUndone.label : 'Setup complete'}
    >
      Setup {doneCount}/{steps.length} →
    </Link>
  )
}
