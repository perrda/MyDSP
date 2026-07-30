import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { categoryMonthlySeries, isBudgetSpend, worstBudgetOffenders } from '../domain/budgetChart'
import type { SpendingEntry } from '../domain/types'

const expense: SpendingEntry = {
  id: 1,
  date: '2026-07-10',
  amount: 80,
  description: 'Groceries',
  category: 'food',
  method: 'debit',
}
const dividend: SpendingEntry = {
  id: 2,
  date: '2026-07-11',
  amount: 500,
  description: 'VWRP dividend',
  category: 'income',
  method: 'credit',
}

describe('next-10 wave 4 dividend workflow', () => {
  it('keeps income out of budget totals and series', () => {
    expect(isBudgetSpend(expense)).toBe(true)
    expect(isBudgetSpend(dividend)).toBe(false)
    expect(
      worstBudgetOffenders([expense, dividend], { food: 100, income: 100 }, new Date(2026, 6, 20)),
    ).toEqual([
      { category: 'food', spent: 80, limit: 100, ratio: 0.8 },
      { category: 'income', spent: 0, limit: 100, ratio: 0 },
    ])
    expect(categoryMonthlySeries([dividend], 'income', 100, 1, new Date(2026, 6, 20))[0]?.spent).toBe(
      0,
    )
  })

  it('logs dividend cash with a highlighted Spending destination and honest tax copy', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    const budgets = readFileSync(resolve(__dirname, '../pages/BudgetsPage.tsx'), 'utf8')
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(detail).toMatch(/Log dividend/)
    expect(detail).toMatch(/appendSpendingEntry/)
    expect(detail).toMatch(/category: 'income'/)
    expect(detail).toMatch(/equity\.shares \* equity\.nextDividendAmount/)
    expect(detail).toMatch(/spendingHighlightUrl/)
    expect(detail).toMatch(/Section 104/)
    expect(budgets).toMatch(/isBudgetSpend/)
    expect(dashboard).toMatch(/isBudgetSpend/)
  })
})
