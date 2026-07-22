import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { advanceRecurringDue, markRecurringPaid, skipRecurringOccurrence } from '../domain/recurringActions'
import {
  monthlyEquivalent,
  monthlyRecurringTotal,
  sortRecurringTransactions,
  addRecurringCommentary,
  updateRecurringCommentary,
  removeRecurringCommentary,
} from '../domain/recurringHelpers'
import type { PortfolioData, RecurringTransaction } from '../domain/types'
import { createEmptyPortfolio } from '../domain/defaults'

function sample(partial: Partial<RecurringTransaction> & Pick<RecurringTransaction, 'id' | 'name'>): RecurringTransaction {
  return {
    amount: 10,
    frequency: 'monthly',
    category: 'subscriptions',
    nextDue: '2026-08-01',
    ...partial,
  }
}

describe('recurring sort / total / commentary', () => {
  it('sorts by due, paid, and amount', () => {
    const items = [
      sample({ id: 1, name: 'A', amount: 50, nextDue: '2026-08-10', lastPaidAt: '2026-07-01T10:00:00.000Z' }),
      sample({ id: 2, name: 'B', amount: 10, nextDue: '2026-08-01' }),
      sample({ id: 3, name: 'C', amount: 100, nextDue: '2026-08-05', lastPaidAt: '2026-07-10T10:00:00.000Z' }),
    ]
    expect(sortRecurringTransactions(items, 'due-asc').map((r) => r.id)).toEqual([2, 3, 1])
    expect(sortRecurringTransactions(items, 'paid-desc').map((r) => r.id)).toEqual([3, 1, 2])
    expect(sortRecurringTransactions(items, 'amount-desc').map((r) => r.id)).toEqual([3, 1, 2])
    expect(sortRecurringTransactions(items, 'amount-asc').map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('monthly total converts weekly/yearly to monthly equivalent', () => {
    const items = [
      sample({ id: 1, name: 'Netflix', amount: 15.99, frequency: 'monthly' }),
      sample({ id: 2, name: 'Gym', amount: 10, frequency: 'weekly' }),
      sample({ id: 3, name: 'Domain', amount: 120, frequency: 'yearly' }),
    ]
    expect(monthlyEquivalent(15.99, 'monthly')).toBeCloseTo(15.99)
    expect(monthlyEquivalent(10, 'weekly')).toBeCloseTo((10 * 52) / 12)
    expect(monthlyEquivalent(120, 'yearly')).toBeCloseTo(10)
    expect(monthlyRecurringTotal(items)).toBeCloseTo(15.99 + (10 * 52) / 12 + 10)
  })

  it('mark paid stamps lastPaidAt; skip does not', () => {
    let data = createEmptyPortfolio() as PortfolioData
    data = {
      ...data,
      recurringTransactions: [sample({ id: 1, name: 'Netflix', nextDue: '2026-08-01' })],
      spending: [],
    }
    const paid = markRecurringPaid(data, 1)
    expect(paid.recurringTransactions[0]?.lastPaidAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(paid.recurringTransactions[0]?.nextDue).toBe('2026-09-01')
    expect(paid.spending).toHaveLength(1)

    const skipped = skipRecurringOccurrence(data, 1)
    expect(skipped.recurringTransactions[0]?.lastPaidAt).toBeUndefined()
    expect(skipped.recurringTransactions[0]?.nextDue).toBe('2026-09-01')
  })

  it('advances month-end safely (31 Jan → 28/29 Feb)', () => {
    const next = advanceRecurringDue('2026-01-31', 'monthly')
    expect(next).toBe('2026-02-28')
  })

  it('commentary CRUD helpers', () => {
    const a = addRecurringCommentary(undefined, 'Called Netflix', '2026-07-01T10:00:00.000Z')
    expect(a).toHaveLength(1)
    expect(a[0]?.text).toBe('Called Netflix')
    const b = updateRecurringCommentary(a, a[0]!.id, 'Updated note', '2026-07-02T11:00:00.000Z')
    expect(b[0]?.text).toBe('Updated note')
    expect(b[0]?.updatedAt).toBe('2026-07-02T11:00:00.000Z')
    expect(b[0]?.createdAt).toBe('2026-07-01T10:00:00.000Z')
    expect(removeRecurringCommentary(b, a[0]!.id)).toBeUndefined()
  })

  it('RecurringPage wires sort, monthly total, and commentary panel', () => {
    const page = readFileSync(resolve('src/pages/RecurringPage.tsx'), 'utf8')
    expect(page).toMatch(/RECURRING_SORT_OPTIONS/)
    expect(page).toMatch(/monthlyRecurringTotal/)
    expect(page).toMatch(/ProgressCommentaryPanel/)
    expect(page).toMatch(/lastPaidAt/)
    expect(page).toMatch(/Monthly total/)
  })

  it('user-facing nav uses To Do\'s branding', () => {
    const sidebar = readFileSync(resolve('src/components/layout/Sidebar.tsx'), 'utf8')
    const nav = readFileSync(resolve('src/domain/bottomNav.ts'), 'utf8')
    expect(sidebar).toMatch(/To Do's/)
    expect(nav).toMatch(/To Do's/)
    expect(sidebar).not.toMatch(/To Do Lists/)
  })

  it('package version is tip', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
    expect(pkg.version).toBe('1.2.91')
  })
})
