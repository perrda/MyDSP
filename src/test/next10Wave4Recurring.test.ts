import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio } from '../domain/defaults'
import {
  markRecurringPaidWithUndo,
  skipRecurringOccurrenceWithUndo,
  undoRecurringPaid,
  undoRecurringSkip,
} from '../domain/recurringActions'

function recurringData() {
  return {
    ...createEmptyPortfolio(),
    recurringTransactions: [
      {
        id: 7,
        name: 'Rent',
        amount: 900,
        frequency: 'monthly' as const,
        category: 'bills',
        nextDue: '2026-08-01',
      },
    ],
  }
}

describe('next-10 wave 4 recurring loop', () => {
  it('returns enough metadata to undo paid and skipped occurrences', () => {
    const start = recurringData()
    const paid = markRecurringPaidWithUndo(start, 7)
    expect(paid.undo).toMatchObject({ id: 7, nextDue: '2026-08-01', spendId: 1 })
    expect(paid.data.spending).toHaveLength(1)
    expect(undoRecurringPaid(paid.data, paid.undo!)).toMatchObject({
      spending: [],
      recurringTransactions: [{ nextDue: '2026-08-01' }],
    })

    const skipped = skipRecurringOccurrenceWithUndo(start, 7)
    expect(skipped.data.recurringTransactions[0]?.nextDue).toBe('2026-09-01')
    expect(undoRecurringSkip(skipped.data, skipped.undo!).recurringTransactions[0]?.nextDue).toBe(
      '2026-08-01',
    )
  })

  it('wires page Undo toasts and shared recurring deep links', () => {
    const page = readFileSync(resolve(__dirname, '../pages/RecurringPage.tsx'), 'utf8')
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(page).toMatch(/recurring-mark-paid-undo/)
    expect(page).toMatch(/recurring-skip-undo/)
    expect(page).toMatch(/duration: 5_000/)
    expect(page).toMatch(/recurringFocusUrl/)
    expect(dashboard).toMatch(/recurringFocusUrl/)
    expect(dashboard).not.toMatch(/`\/recurring\?focus=\$\{/)
  })
})
