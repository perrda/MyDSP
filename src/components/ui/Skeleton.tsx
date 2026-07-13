export interface SkeletonProps {
  className?: string
  count?: number
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </>
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="surface p-5 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-card" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="surface rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 md:p-5 border-b border-border last:border-0">
          <div className="flex items-center gap-4">
            <div className="skeleton w-12 h-12" />
            <div className="flex-1">
              <div className="skeleton skeleton-text w-1/3 mb-2" />
              <div className="skeleton skeleton-text w-1/2" />
            </div>
            <div className="skeleton w-24 h-8" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="surface p-4 md:p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
      <div className="skeleton skeleton-text w-1/3 mb-3" />
      <div className="skeleton h-8 w-2/3 mb-2" />
      <div className="skeleton skeleton-text w-1/2" />
    </div>
  )
}
