import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from './defaults'
import {
  buildCashflowRunway,
  buildCashflowStory,
  buildMonthlyCashflowSeries,
  canPlotCashflowChart,
  formatRunwayMonths,
  hasCashflowSources,
  monthlyRecurringIn,
  monthlyRecurringOut,
} from './cashflow'
import { monthlyRecurringTotal } from './recurringHelpers'
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
  it('splits recurring income from bills — total matches out, not all rows', () => {
    const items = createSamplePortfolio().recurringTransactions
    expect(monthlyRecurringOut(items)).toBeCloseTo(12.99 + 1200, 5)
    expect(monthlyRecurringTotal(items)).toBe(monthlyRecurringOut(items))
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
    expect(monthlyRecurringTotal(withPay)).toBe(monthlyRecurringOut(withPay))
    expect(monthlyRecurringTotal(withPay)).not.toBeCloseTo(12.99 + 1200 + 3600, 5)
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

  it('sample leftover is recurring book only — Settings income is not mixed in', () => {
    const now = new Date(2026, 7, 28)
    const sample = createSamplePortfolio()
    const story = buildCashflowStory(sample, now)
    expect(hasCashflowSources(sample)).toBe(true)
    expect(story.canPlot).toBe(false)
    expect(story.book).toBe('recurring')
    expect(story.moneyIn).toBe(0)
    expect(story.moneyOut).toBeCloseTo(1212.99, 5)
    expect(story.leftover).toBeCloseTo(-1212.99, 5)
    expect(story.cash).toBe(1000)
    expect(story.runway?.months).toBeCloseTo(1000 / 1212.99, 5)
    expect(formatRunwayMonths(story.runway?.months ?? null)).toBe('0.8 mo')
    expect(story.runway?.months).not.toBe(Number.POSITIVE_INFINITY)
  })

  it('one runway is stables ÷ monthly bills — leftover does not print Infinity', () => {
    const data = createEmptyPortfolio()
    data.monthlyIncome = 5000
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
    const today = buildCashflowRunway(data)
    expect(story.book).toBe('recurring')
    expect(story.moneyIn).toBe(0)
    expect(story.leftover).toBe(-1000)
    expect(story.runway).toEqual(today)
    expect(story.runway?.months).toBe(2)
    expect(formatRunwayMonths(2)).toBe('2.0 mo')
    expect(formatRunwayMonths(12)).toBe('12 mo')
    expect(formatRunwayMonths(120)).toBe('99+')
  })

  it('ledger leftover matches the focus month on the same series as the chart', () => {
    const data = createEmptyPortfolio()
    data.monthlyIncome = 9999
    data.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 2000, price: 1, cost: 2000 }]
    data.spending = [
      spend({ id: 1, date: '2026-07-10', amount: 500, category: 'food' }),
      spend({ id: 2, date: '2026-08-10', amount: 400, category: 'food' }),
      spend({ id: 3, date: '2026-08-01', amount: 3000, category: 'income', description: 'Salary' }),
    ]
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
    const aug = story.months.find((m) => m.month === '2026-08')
    expect(story.book).toBe('ledger')
    expect(story.canPlot).toBe(true)
    expect(story.focusMonth).toBe('2026-08')
    expect(story.moneyIn).toBe(aug?.moneyIn)
    expect(story.moneyOut).toBe(aug?.moneyOut)
    expect(story.leftover).toBe(aug?.leftover)
    expect(story.leftover).toBe(2600)
    expect(story.moneyIn).not.toBe(9999)
    expect(story.runway?.months).toBe(2)
    expect(buildCashflowRunway(data)?.months).toBe(2)
  })

  it('recurring income does not count as Today / runway out', () => {
    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 1, cost: 1000 }]
    data.recurringTransactions = [
      {
        id: 1,
        name: 'Salary',
        amount: 4000,
        frequency: 'monthly',
        category: 'income',
        nextDue: '2026-09-01',
      },
      {
        id: 2,
        name: 'Rent',
        amount: 1000,
        frequency: 'monthly',
        category: 'bills',
        nextDue: '2026-09-01',
      },
    ]
    const story = buildCashflowStory(data, new Date(2026, 7, 28))
    expect(story.moneyIn).toBe(4000)
    expect(story.moneyOut).toBe(1000)
    expect(story.leftover).toBe(3000)
    expect(story.runway?.monthlyBills).toBe(1000)
    expect(story.runway?.months).toBe(1)
    expect(buildCashflowRunway(data)?.monthlyBills).toBe(1000)
  })
})
