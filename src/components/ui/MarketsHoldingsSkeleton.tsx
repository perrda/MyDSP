/** First-paint / refresh shimmer for Markets and holdings pages. */

interface Props {
  rows?: number
  label?: string
  className?: string
}

export function MarketsHoldingsSkeleton({
  rows = 4,
  label = 'Loading quotes',
  className = '',
}: Props) {
  return (
    <div
      className={`markets-holdings-skeleton space-y-3 ${className}`}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-card h-14 sm:h-16 w-full" />
      ))}
    </div>
  )
}
