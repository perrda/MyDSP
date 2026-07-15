/**
 * Thin lazy wrappers so eager pages (Dashboard) do not pull recharts into the
 * main bundle. Route-level Suspense already covers Equities/Crypto/etc.;
 * those pages may keep static imports safely.
 */
import { lazy, Suspense, type ComponentProps } from 'react'
import type { SliceDatum } from './AllocationRing'

const AllocationRingInner = lazy(() =>
  import('./AllocationRing').then((m) => ({ default: m.AllocationRing })),
)
const PortfolioSeriesChartInner = lazy(() =>
  import('./PortfolioSeriesChart').then((m) => ({ default: m.PortfolioSeriesChart })),
)
const NetWorthChartInner = lazy(() =>
  import('./PortfolioSeriesChart').then((m) => ({ default: m.NetWorthChart })),
)

function ChartFallback({ label }: { label: string }) {
  return (
    <div
      className="skeleton skeleton-card h-52 w-full"
      aria-busy="true"
      aria-label={label}
      role="status"
    />
  )
}

export type { SliceDatum }

export function AllocationRing(props: ComponentProps<typeof AllocationRingInner>) {
  return (
    <Suspense fallback={<ChartFallback label="Loading allocation chart" />}>
      <AllocationRingInner {...props} />
    </Suspense>
  )
}

export function PortfolioSeriesChart(props: ComponentProps<typeof PortfolioSeriesChartInner>) {
  return (
    <Suspense fallback={<ChartFallback label="Loading portfolio chart" />}>
      <PortfolioSeriesChartInner {...props} />
    </Suspense>
  )
}

export function NetWorthChart(props: ComponentProps<typeof NetWorthChartInner>) {
  return (
    <Suspense fallback={<ChartFallback label="Loading net worth chart" />}>
      <NetWorthChartInner {...props} />
    </Suspense>
  )
}
