/** Recurring subscriptions — sort, monthly equivalent, paid stamp helpers. */

import type { ProgressCommentary, RecurringTransaction } from './types'

export type RecurringSort =
  | 'due-asc'
  | 'paid-desc'
  | 'amount-desc'
  | 'amount-asc'

export const RECURRING_SORT_OPTIONS: Array<{ id: RecurringSort; label: string }> = [
  { id: 'due-asc', label: 'Date due' },
  { id: 'paid-desc', label: 'Date paid' },
  { id: 'amount-desc', label: 'Amount · high → low' },
  { id: 'amount-asc', label: 'Amount · low → high' },
]

/** Convert any frequency amount into a monthly equivalent. */
export function monthlyEquivalent(
  amount: number,
  frequency: RecurringTransaction['frequency'],
): number {
  const abs = Math.abs(amount)
  if (frequency === 'weekly') return (abs * 52) / 12
  if (frequency === 'yearly') return abs / 12
  return abs
}

/** Sum of all recurring items as a monthly equivalent (bills + subscriptions). */
export function monthlyRecurringTotal(items: RecurringTransaction[]): number {
  return items.reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.frequency), 0)
}

export function sortRecurringTransactions(
  items: RecurringTransaction[],
  sort: RecurringSort,
): RecurringTransaction[] {
  const copy = [...items]
  copy.sort((a, b) => {
    if (sort === 'due-asc') {
      const c = a.nextDue.localeCompare(b.nextDue)
      return c !== 0 ? c : a.name.localeCompare(b.name)
    }
    if (sort === 'paid-desc') {
      const ap = a.lastPaidAt || ''
      const bp = b.lastPaidAt || ''
      if (!ap && !bp) return a.nextDue.localeCompare(b.nextDue)
      if (!ap) return 1
      if (!bp) return -1
      const c = bp.localeCompare(ap)
      return c !== 0 ? c : a.nextDue.localeCompare(b.nextDue)
    }
    const aa = Math.abs(a.amount)
    const ba = Math.abs(b.amount)
    if (sort === 'amount-desc') {
      const c = ba - aa
      return c !== 0 ? c : a.nextDue.localeCompare(b.nextDue)
    }
    // amount-asc
    const c = aa - ba
    return c !== 0 ? c : a.nextDue.localeCompare(b.nextDue)
  })
  return copy
}

export function nextCommentaryId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

export function addRecurringCommentary(
  list: ProgressCommentary[] | undefined,
  text: string,
  now = new Date().toISOString(),
): ProgressCommentary[] {
  const trimmed = text.trim()
  if (!trimmed) return list ?? []
  const existing = list ?? []
  return [
    ...existing,
    {
      id: nextCommentaryId(existing),
      text: trimmed,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function updateRecurringCommentary(
  list: ProgressCommentary[] | undefined,
  id: number,
  text: string,
  now = new Date().toISOString(),
): ProgressCommentary[] {
  const trimmed = text.trim()
  return (list ?? []).map((c) =>
    c.id === id ? { ...c, text: trimmed, updatedAt: now } : c,
  )
}

export function removeRecurringCommentary(
  list: ProgressCommentary[] | undefined,
  id: number,
): ProgressCommentary[] | undefined {
  const next = (list ?? []).filter((c) => c.id !== id)
  return next.length ? next : undefined
}
