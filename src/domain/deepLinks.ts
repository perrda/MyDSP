/** Deep-link URL helpers for notification / toast landings. */

import type { SpendingEntry } from './types'

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

/** Open merchant-rule creation with a spending row's merchant and category prefilled. */
export function makeRuleHref(
  transaction: Pick<SpendingEntry, 'description' | 'category'>,
): string {
  const params = new URLSearchParams()
  params.set('pattern', transaction.description.trim() || 'merchant')
  params.set('category', (transaction.category || 'other').toLowerCase())
  return `/rules?${params.toString()}`
}
