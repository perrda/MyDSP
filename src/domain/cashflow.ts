/** Monthly cashflow story — compose existing spending, recurring, and runway helpers.
 *  Not a second ledger. No new sync key. Income rows stay off the spend side. */

import { isBudgetSpend } from './budgetChart'
import { calcCash, cryptoMarkPrice, isCashCryptoSymbol } from './calc'
import { monthKey } from './monthUtils'
import { monthlyRecurringIn, monthlyRecurringOut } from './recurringHelpers'
import type { PortfolioData, SpendingEntry } from './types'

export type CashflowMonth = {
  month: string
  moneyIn: number
  moneyOut: number
  leftover: number
}

export type CashflowBook = 'ledger' | 'recurring'

export type CashflowRunway = {
  months: number
  monthlyBills: number
  cash: number
}

export type CashflowStory = {
  book: CashflowBook
  focusMonth: string | null
  moneyIn: number
  moneyOut: number
  leftover: number
  cash: number
  /** One runway: stables (calcCash) ÷ monthly bills. Same number as Today. */
  runway: CashflowRunway | null
  months: CashflowMonth[]
  canPlot: boolean
}

export { monthlyRecurringIn, monthlyRecurringOut }

export function isCashflowIncome(
  entry: Pick<SpendingEntry, 'category'> | { category?: string },
): boolean {
  return !isBudgetSpend(entry)
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

/** Honest chart copy — 0 or 1 month, never a padded series. */
export function ledgerMonthCountCopy(count: number): string {
  if (count === 0) return '0 months'
  if (count === 1) return '1 month'
  return `${count} months`
}

export type StableLine = { symbol: string; name: string; value: number }

/** Stables used for runway — mark is OK here (cash-like), not NW mix. */
export function stablesBreakdown(data: Pick<PortfolioData, 'crypto'>): StableLine[] {
  const rows: StableLine[] = []
  for (const c of data.crypto ?? []) {
    if (c.includeInPortfolio === false) continue
    if (!isCashCryptoSymbol(c.symbol)) continue
    const value = c.qty * cryptoMarkPrice(c)
    if (!(value > 0)) continue
    rows.push({ symbol: c.symbol, name: c.name, value })
  }
  return rows.sort((a, b) => b.value - a.value)
}

/** Settings monthlyIncome is a label only — never mixed into leftover. */
export function settingsMonthlyInflow(data: Pick<PortfolioData, 'monthlyIncome'>): number {
  return Math.max(0, data.monthlyIncome ?? 0)
}

/** Leftover for FIRE / goals / Monte Carlo. Negative leftover is 0 — no silent £1,500. */
export function cashflowLeftoverSavings(data: PortfolioData, now = new Date()): number {
  return Math.max(0, buildCashflowStory(data, now).leftover)
}

/** Stables ÷ monthly bills. Null when there are no bills — same gate as Today. */
export function buildCashflowRunway(
  data: Pick<PortfolioData, 'crypto' | 'recurringTransactions'>,
): CashflowRunway | null {
  const monthlyBills = monthlyRecurringOut(data.recurringTransactions ?? [])
  if (!(monthlyBills > 0)) return null
  const cash = Math.max(0, calcCash(data as PortfolioData))
  return { months: cash / monthlyBills, monthlyBills, cash }
}

export function formatRunwayMonths(months: number | null): string {
  if (months == null) return '—'
  if (!Number.isFinite(months) || months >= 99) return '99+'
  return months < 10 ? `${months.toFixed(1)} mo` : `${months.toFixed(0)} mo`
}

export function buildCashflowStory(data: PortfolioData, now = new Date()): CashflowStory {
  const months = buildMonthlyCashflowSeries(data.spending)
  const currentYm = monthKey(now)
  const runway = buildCashflowRunway(data)
  const cash = runway?.cash ?? Math.max(0, calcCash(data))

  if (months.length > 0) {
    const focus = months.find((m) => m.month === currentYm) ?? months[months.length - 1]!
    return {
      book: 'ledger',
      focusMonth: focus.month,
      moneyIn: focus.moneyIn,
      moneyOut: focus.moneyOut,
      leftover: focus.leftover,
      cash,
      runway,
      months,
      canPlot: canPlotCashflowChart(months),
    }
  }

  const rec = data.recurringTransactions ?? []
  const moneyIn = monthlyRecurringIn(rec)
  const moneyOut = monthlyRecurringOut(rec)
  return {
    book: 'recurring',
    focusMonth: null,
    moneyIn,
    moneyOut,
    leftover: moneyIn - moneyOut,
    cash,
    runway,
    months,
    canPlot: false,
  }
}
