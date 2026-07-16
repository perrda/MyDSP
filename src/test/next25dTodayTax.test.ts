import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25d Today / Spending / Goals / Tax items', () => {
  it('12: Today bill next-action offers inline Mark paid and Skip via recurring actions', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const recurring = readFileSync(resolve(__dirname, '../pages/RecurringPage.tsx'), 'utf8')
    const actions = readFileSync(resolve(__dirname, '../domain/recurringActions.ts'), 'utf8')
    expect(dashboard).toMatch(/today-bill-next-action/)
    expect(dashboard).toMatch(/today-bill-next-actions/)
    expect(dashboard).toMatch(/markRecurringPaid/)
    expect(dashboard).toMatch(/skipRecurringOccurrence/)
    expect(recurring).toMatch(/markRecurringPaid/)
    expect(actions).toMatch(/advanceRecurringDue/)
  })

  it('17: Spending bill payment CTA opens a prefilled expense modal', () => {
    const spending = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(spending).toMatch(/openBillPaymentCreate/)
    expect(spending).toMatch(/log-bill-payment-cta/)
    expect(spending).toMatch(/Bill payment/)
    expect(spending).toMatch(/category: 'bills'/)
    expect(spending).toMatch(/method: 'debit'/)
  })

  it('18: Today goal ring deep-links into Goals commentary', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const goals = readFileSync(resolve(__dirname, '../pages/Goals.tsx'), 'utf8')
    expect(dashboard).toMatch(/today-goal-log-note/)
    expect(dashboard).toMatch(/\/goals\?note=\$\{soonGoal\.id\}/)
    expect(goals).toMatch(/useSearchParams/)
    expect(goals).toMatch(/searchParams\.get\('note'\)/)
    expect(goals).toMatch(/setNoteGoalId\(id\)/)
  })

  it('19: Tax includes a UK ISA annual allowance progress stub', () => {
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/tax-isa-allowance-progress/)
    expect(tax).toMatch(/ISA_ALLOWANCE_GBP/)
    expect(tax).toMatch(/ISA_REMAINING_KEY/)
    expect(tax).toMatch(/ISA allowance/)
    expect(tax).toMatch(/Manual remaining ISA allowance/)
  })
})
