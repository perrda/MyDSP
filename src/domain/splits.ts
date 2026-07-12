/** Trip expense split balances (FCC-compatible). */

import type { SpendingEntry, SplitSettings } from './types'

export function splitPercent(code: string | undefined): number {
  if (code === '60') return 60
  if (code === '70') return 70
  if (code === '50') return 50
  return 50
}

export interface SplitBalance {
  person1Paid: number
  person2Paid: number
  person1Owes: number
  person2Owes: number
  /** person2Owes − person1Owes: >0 means person2 owes person1 */
  balance: number
  splitCount: number
  totalSplit: number
}

export function calcSplitBalance(
  spending: SpendingEntry[],
  _settings?: SplitSettings,
): SplitBalance {
  let person1Paid = 0
  let person2Paid = 0
  let person1Owes = 0
  let person2Owes = 0
  let splitCount = 0
  let totalSplit = 0

  for (const s of spending) {
    if (!s.split || s.split === 'no') continue
    const amount = Math.abs(s.amount)
    const pct = splitPercent(s.split)
    const p1Share = amount * (pct / 100)
    const p2Share = amount - p1Share
    splitCount++
    totalSplit += amount

    if (s.paidBy === 'person2') {
      person2Paid += amount
      person1Owes += p1Share
    } else {
      person1Paid += amount
      person2Owes += p2Share
    }
  }

  return {
    person1Paid,
    person2Paid,
    person1Owes,
    person2Owes,
    balance: person2Owes - person1Owes,
    splitCount,
    totalSplit,
  }
}

export function tripSpend(spending: SpendingEntry[], tripId: number): number {
  return spending
    .filter((s) => s.tripId === tripId)
    .reduce((sum, s) => sum + Math.abs(s.amount), 0)
}
