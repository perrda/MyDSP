/** Quote Worker / markets feed failover banner when relays are unhealthy. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatMarketsProviderHealthHint,
  getMarketsProviderHealth,
} from '../services/marketsProviderHealth'

export function QuoteFailoverBanner() {
  const [hint, setHint] = useState<string | null>(() => formatMarketsProviderHealthHint())
  const [severe, setSevere] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setHint(formatMarketsProviderHealthHint())
      const rows = getMarketsProviderHealth()
      setSevere(rows.some((r) => r.consecutiveFailures >= 3))
    }
    refresh()
    const t = window.setInterval(refresh, 15_000)
    window.addEventListener('mydsp-global-refresh', refresh)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('mydsp-global-refresh', refresh)
    }
  }, [])

  if (!hint && !severe) return null

  return (
    <div
      className="floating-banner fixed left-[max(1rem,env(safe-area-inset-left))] z-[1390] max-w-sm surface border border-amber-500/50 border-l-2 border-l-amber-500 px-4 py-3"
      role="status"
    >
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Markets feeds degraded</p>
      <p className="text-xs text-text-subtle mt-1 leading-relaxed md:hidden">
        {hint ?? 'Multiple quote relays failing.'}
      </p>
      <p className="text-xs text-text-subtle mt-1 leading-relaxed hidden md:block">
        {hint ?? 'Multiple quote relays are failing.'} Showing last-good prices where possible —
        retry from Markets or check Settings → Sync (Quote Worker).
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        <Link to="/markets" className="text-xs text-accent font-semibold">
          Open Markets →
        </Link>
        <Link to="/settings#sync" className="text-xs text-text-muted font-semibold">
          Sync health
        </Link>
      </div>
    </div>
  )
}
