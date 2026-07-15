// Compact loading spinner for lazy-loaded route chunks (not a full-screen takeover).

export function LoadingSpinner() {
  return (
    <div
      className="flex items-center justify-center min-h-[40vh] py-16 px-4"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="text-center">
        <div className="relative w-12 h-12 mx-auto mb-3">
          <div className="absolute inset-0 border-[3px] border-border rounded-full" />
          <div className="absolute inset-0 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-text-muted font-medium">Loading…</p>
      </div>
    </div>
  )
}
