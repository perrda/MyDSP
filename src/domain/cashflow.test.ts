import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from './defaults'
import {
  buildCashflowStory,
  buildMonthlyCashflowSeries,
  canPlotCashflowChart,
  formatRunwayMonths,
  hasCashflowSources,
  leftoverRunwayMonths,
  monthlyRecurringIn,
  monthlyRecurringOut,
} from './cashflow'
import type { SpendingEntry } from './types'

function spend(
  partial: Pick<SpendingEntry, 'id' | 'date' | 'amount' | 'category'> &
    Partial<SpendingEntry>,
): SpendingEntry {
  return {
    description: partial.description ?? 'tx',
    method: partial.method ?? 'debit',
    ...partial,
  }
}

describe('cashflow composition (not a second ledger)', () => {
  it('splits recurring income from bills with existing monthlyEquivalent', () => {
    const items = createSamplePortfolio().recurringTransactions
    expect(monthlyRecurringOut(items)).toBeCloseTo(12.99 + 1200, 5)
    expect(monthlyRecurringIn(items)).toBe(0)
    const withPay = [
      ...items,
      {
        id: 9,
        name: 'Salary',
        amount: 3600,
        frequency: 'monthly' as const,
        category: 'income',
        nextDue: '2026-08-01',
      },
    ]
    expect(monthlyRecurringIn(withPay)).toBe(3600)
    expect(monthlyRecurringOut(withPay)).toBeCloseTo(12.99 + 1200, 5)
  })

  it('builds ledger months only — no padded zeros, income off spend', () => {
    const months = buildMonthlyCashflowSeries([
      spend({ id: 1, date: '2026-07-10', amount: 500, category: 'food' }),
      spend({ id: 2, date: '2026-08-10', amount: 400, category: 'food' }),
      spend({ id: 3, date: '2026-08-01', amount: 3000, category: 'income', description: 'Salary' }),
    ])
    expect(months).toEqual([
      { month: '2026-07', moneyIn: 0, moneyOut: 500, leftover: -500 },
      { month: '2026-08', moneyIn: 3000, moneyOut: 400, leftover: 2600 },
    ])
    expect(canPlotCashflowChart(months)).toBe(true)
    expect(canPlotCashflowChart(months.slice(0, 1))).toBe(false)
  })

  it('does not invent a month from Settings income alone', () => {
    expect(buildMonthlyCashflowSeries([])).toEqual([])
    const empty = createEmptyPortfolio()
    empty.monthlyIncome = 5000
    expect(buildMonthlyCashflowSeries(empty.spending)).toEqual([])
    expect(hasCashflowSources(empty)).toBe(false)
  })

  it('sample recurring + settings income is a story without a fake chart', () => {
    const now = new Date(2026, 7, 28)
    const story = buildCashflowStory(createSamplePortfolio(), now)
    expect(hasCashflowSources(createSamplePortfolio())).toBe(true)
    expect(story.canPlot).toBe(false)
    expect(story.inSource).toBe('settings')
    expect(story.moneyIn).toBe(4200)
    expect(story.outSource).toBe('recurring')
    expect(story.moneyOut).toBeCloseTo(1212.99, 5)
    expect(story.leftover).toBeCloseTo(4200 - 1212.99, 5)
    expect(story.cash).toBe(1000)
    expect(story.runwayMonths).toBe(Number.POSITIVE_INFINITY)
    expect(formatRunwayMonths(story.runwayMonths)).toBe('99+')
  })

  it('leftover burn runway is cash ÷ hole, not net worth', () => {
    expect(leftoverRunwayMonths(2000, -1000)).toBe(2)
    expect(leftoverRunwayMonths(2000, 500)).toBe(Number.POSITIVE_INFINITY)
    expect(formatRunwayMonths(2)).toBe('2.0 mo')
    expect(formatRunwayMonths(12)).toBe('12 mo')

    const data = createEmptyPortfolio()
    data.monthlyIncome = 0
    data.monthlyExpenses = 0
    data.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 2000, price: 1, cost: 2000 }]
    data.recurringTransactions = [
      {
        id: 1,
        name: 'Rent',
        amount: 1000,
        frequency: 'monthly',
        category: 'bills',
        nextDue: '2026-09-01',
      },
    ]
    const story = buildCashflowStory(data, new Date(2026, 7, 28))
    expect(story.moneyIn).toBe(0)
    expect(story.moneyOut).toBe(1000)
    expect(story.leftover).toBe(-1000)
    expect(story.cash).toBe(2000)
    expect(story.runwayMonths).toBe(2)
    expect(story.billsRunwayMonths).toBe(2)
  })

  it('falls back to estimateMonthlyExpenses when there are no recurring bills', () => {
    const data = createEmptyPortfolio()
    data.monthlyIncome = 4000
    data.monthlyExpenses = 2500
    data.spending = [
      spend({ id: 1, date: '2026-07-02', amount: 100, category: 'food' }),
      spend({ id: 2, date: '2026-08-02', amount: 100, category: 'food' }),
    ]
    const story = buildCashflowStory(data, new Date(2026, 7, 28))
    expect(story.outSource).toBe('settings')
    expect(story.moneyOut).toBe(2500)
    expect(story.canPlot).toBe(true)
  })
})
