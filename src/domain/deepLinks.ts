/** Deep-link URL helpers for notification / toast landings. */

export function spendingHighlightUrl(id: number | string, opts?: { category?: string; month?: string }): string {
  const params = new URLSearchParams()
  params.set('highlight', String(id))
  if (opts?.category) params.set('category', opts.category)
  if (opts?.month) params.set('month', opts.month)
  return `/spending?${params.toString()}`
}

export function recurringFocusUrl(id: number | string): string {
  return `/recurring?focus=${encodeURIComponent(String(id))}`
}
