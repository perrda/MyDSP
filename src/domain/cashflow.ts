/** Monthly cashflow story — compose existing spending, recurring, and runway helpers.
 *  Not a second ledger. No new sync key. Income rows stay off the spend side. */

import { isBudgetSpend } from './budgetChart'
import { calcCash } from './calc'
import { estimateMonthlyExpenses } from './goalProjectedDate'
import { monthKey } from './monthUtils'
import { monthlyEquivalent } from './recurringHelpers'
import type { PortfolioData, RecurringTransaction, SpendingEntry } from './types'

export type CashflowMonth = {
  month: string
  moneyIn: number
  moneyOut: number
  leftover: number
}

export type CashflowSource = 'settings' | 'ledger' | 'recurring' | 'none'

export type CashflowStory = {
  moneyIn: number
  moneyOut: number
  leftover: number
  cash: number
  /** Leftover-based: cash / |leftover| when burning; Infinity when leftover holds. */
  runwayMonths: number | null
  /** Today-style bills runway: cash / monthly out. */
  billsRunwayMonths: number | null
  inSource: CashflowSource
  outSource: CashflowSource
  months: CashflowMonth[]
  canPlot: boolean
}

export function isCashflowIncome(
  entry: Pick<SpendingEntry, 'category'> | { category?: string },
): boolean {
  return !isBudgetSpend(entry)
}

export function monthlyRecurringOut(items: RecurringTransaction[]): number {
  return items
    .filter((r) => isBudgetSpend(r))
    .reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.frequency), 0)
}

export function monthlyRecurringIn(items: RecurringTransaction[]): number {
  return items
    .filter((r) => isCashflowIncome(r))
    .reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.frequency), 0)
}

/** Actual ledger months only — no padded zeros, no recurring projected onto the past. */
export function buildMonthlyCashflowSeries(spending: SpendingEntry[] | undefined): CashflowMonth[] {
  const byMonth = new Map<string, { moneyIn: number; moneyOut: number }>()
  for (const s of spending ?? []) {
    const ym = (s.date ?? '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(ym)) continue
    const row = byMonth.get(ym) ?? { moneyIn: 0, moneyOut: 0 }
    const amt = Math.abs(s.amount)
    if (isCashflowIncome(s)) row.moneyIn += amt
    else row.moneyOut += amt
    byMonth.set(ym, row)
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      moneyIn: v.moneyIn,
      moneyOut: v.moneyOut,
      leftover: v.moneyIn - v.moneyOut,
    }))
}

export function hasCashflowSources(data: Pick<PortfolioData, 'spending' | 'recurringTransactions'>): boolean {
  return (data.recurringTransactions?.length ?? 0) > 0 || (data.spending?.length ?? 0) > 0
}

export function canPlotCashflowChart(months: CashflowMonth[]): boolean {
  return months.length >= 2
}

export function leftoverRunwayMonths(cash: number, leftover: number): number | null {
  if (leftover < 0) {
    const burn = Math.abs(leftover)
    return burn > 0 ? Math.max(0, cash) / burn : null
  }
  if (leftover > 0 || cash > 0) return Number.POSITIVE_INFINITY
  return null
}

export function formatRunwayMonths(months: number | null): string {
  if (months == null) return '—'
  if (!Number.isFinite(months) || months >= 99) return '99+'
  return months < 10 ? `${months.toFixed(1)} mo` : `${months.toFixed(0)} mo`
}

export function buildCashflowStory(data: PortfolioData, now = new Date()): CashflowStory {
  const months = buildMonthlyCashflowSeries(data.spending)
  const currentYm = monthKey(now)
  const thisMonth = months.find((m) => m.month === currentYm)

  const recurringIn = monthlyRecurringIn(data.recurringTransactions ?? [])
  const recurringOut = monthlyRecurringOut(data.recurringTransactions ?? [])

  let moneyIn = 0
  let inSource: CashflowSource = 'none'
  if ((data.monthlyIncome ?? 0) > 0) {
    moneyIn = data.monthlyIncome
    inSource = 'settings'
  } else if ((thisMonth?.moneyIn ?? 0) > 0) {
    moneyIn = thisMonth!.moneyIn
    inSource = 'ledger'
  } else if (recurringIn > 0) {
    moneyIn = recurringIn
    inSource = 'recurring'
  }

  let moneyOut = 0
  let outSource: CashflowSource = 'none'
  if (recurringOut > 0) {
    moneyOut = recurringOut
    outSource = 'recurring'
  } else {
    const estimated = estimateMonthlyExpenses(data, now)
    if (estimated > 0) {
      moneyOut = estimated
      outSource = (data.monthlyExpenses ?? 0) > 0 ? 'settings' : 'ledger'
    }
  }

  const leftover = moneyIn - moneyOut
  const cash = Math.max(0, calcCash(data))
  const runwayMonths = leftoverRunwayMonths(cash, leftover)
  const billsRunwayMonths = moneyOut > 0 ? cash / moneyOut : null

  return {
    moneyIn,
    moneyOut,
    leftover,
    cash,
    runwayMonths,
    billsRunwayMonths,
    inSource,
    outSource,
    months,
    canPlot: canPlotCashflowChart(months),
  }
}
