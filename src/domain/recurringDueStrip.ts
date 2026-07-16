/** Recurring bills due within the next N days (Today strip). */

import type { RecurringTransaction } from './types'

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dueWithinDays(
  items: RecurringTransaction[] | undefined,
  days = 7,
  now = new Date(),
): RecurringTransaction[] {
  const start = ymdLocal(now)
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const end = ymdLocal(endDate)
  return [...(items ?? [])]
    .filter((r) => {
      const due = (r.nextDue ?? '').slice(0, 10)
      return due >= start && due <= end
    })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
}
