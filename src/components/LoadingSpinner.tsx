// Loading spinner for lazy-loaded components

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-border" />
          <div className="absolute inset-0 border-4 border-accent border-t-transparent animate-spin" />
        </div>
        <p className="text-text-muted font-medium">Loading…</p>
      </div>
    </div>
  )
}
