/** Prefetch heavy lazy route chunks on idle / hover to speed first open. */

import { useEffect } from 'react'

const HEAVY_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../pages/TaxPage'),
  () => import('../pages/AnalyticsPage'),
  () => import('../pages/PredictiveAnalyticsPage'),
  () => import('../pages/SmartInsightsPage'),
  () => import('../pages/ComparePage'),
  () => import('../pages/FirePage'),
  () => import('../pages/PlanningPage'),
  () => import('../pages/HistoryPage'),
]

let started = false

/** Kick off background chunk downloads once per session after first paint. */
export function useIdlePrefetch(): void {
  useEffect(() => {
    if (started) return
    started = true

    const run = () => {
      for (const load of HEAVY_IMPORTS) {
        void load().catch(() => {
          /* ignore — best-effort */
        })
      }
    }

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }
    ).requestIdleCallback

    if (typeof ric === 'function') {
      ric(run, { timeout: 4000 })
      return
    }
    const id = window.setTimeout(run, 2500)
    return () => window.clearTimeout(id)
  }, [])
}

/** Prefetch a single heavy page on pointer enter (e.g. sidebar link). */
export function prefetchRouteChunk(path: string): void {
  const p = path.replace(/\/$/, '') || '/'
  if (p.startsWith('/tax')) void import('../pages/TaxPage')
  else if (p.startsWith('/analytics/predictive')) void import('../pages/PredictiveAnalyticsPage')
  else if (p.startsWith('/analytics')) void import('../pages/AnalyticsPage')
  else if (p.startsWith('/insights')) void import('../pages/SmartInsightsPage')
  else if (p.startsWith('/compare')) void import('../pages/ComparePage')
  else if (p.startsWith('/fire')) void import('../pages/FirePage')
  else if (p.startsWith('/planning')) void import('../pages/PlanningPage')
  else if (p.startsWith('/history')) void import('../pages/HistoryPage')
  else if (p.startsWith('/markets')) void import('../pages/MarketsPage')
  else if (p.startsWith('/todos')) void import('../pages/TodosPage')
  else if (p.startsWith('/jobs')) void import('../pages/JobsPage')
}
