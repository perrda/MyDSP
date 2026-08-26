/** Overview / command-centre alerts. */

import type { PortfolioData, RagStatus } from './types'
import { formatGBP } from '../utils/format'
import { isBudgetSpend } from './budgetChart'
import { calcBreakdown } from './calc'
import { monthKey } from './monthUtils'
import { calcAllocation, calcRebalanceActions } from './rebalance'
import { dueWithinDays } from './recurringDueStrip'
import { recurringFocusUrl, spendingHighlightUrl } from './deepLinks'
import { liabilitiesDueWithinDays } from './liabilityHelpers'
import { isCorporateActionDue } from './corporateActions'

export interface AppAlert {
  id: string
  severity: 'red' | 'amber' | 'green' | 'info'
  title: string
  detail: string
  to: string
}

function largestSpendingIdForCategory(
  data: PortfolioData,
  category: string,
  ym: string,
): number | null {
  let bestId: number | null = null
  let bestAbs = 0
  for (const s of data.spending) {
    if (!s.date.startsWith(ym)) continue
    if (!isBudgetSpend(s)) continue
    if (s.category.toLowerCase() !== category.toLowerCase()) continue
    const abs = Math.abs(s.amount)
    if (abs >= bestAbs) {
      bestAbs = abs
      bestId = s.id
    }
  }
  return bestId
}

export function buildAlerts(data: PortfolioData): AppAlert[] {
  const alerts: AppAlert[] = []
  const breakdown = calcBreakdown(data)
  const ym = monthKey()

  for (const c of data.creditCards) {
    if (c.includeInPortfolio === false) continue
    if (c.ragStatus === 'red') {
      alerts.push({
        id: `card-rag-${c.id}`,
        severity: 'red',
        title: `${c.name} marked critical`,
        detail: 'Open the debt workspace to log progress or adjust pay-down.',
        to: `/liabilities/card/${c.id}`,
      })
    } else if (c.ragStatus === 'amber') {
      alerts.push({
        id: `card-rag-a-${c.id}`,
        severity: 'amber',
        title: `${c.name} on watch`,
        detail: 'Credit card flagged amber.',
        to: `/liabilities/card/${c.id}`,
      })
    }
    if (c.limit > 0 && c.balance / c.limit >= 0.85) {
      alerts.push({
        id: `card-util-${c.id}`,
        severity: 'red',
        title: `${c.name} utilisation high`,
        detail: `${Math.round((c.balance / c.limit) * 100)}% of limit used.`,
        to: `/liabilities/card/${c.id}`,
      })
    }
  }

  for (const l of data.loans) {
    if (l.includeInPortfolio === false) continue
    if (l.ragStatus === 'red') {
      alerts.push({
        id: `loan-rag-${l.id}`,
        severity: 'red',
        title: `${l.name} marked critical`,
        detail: 'Loan RAG is red — review commentary and contacts.',
        to: `/liabilities/loan/${l.id}`,
      })
    }
  }

  const spent = new Map<string, number>()
  for (const s of data.spending) {
    if (!s.date.startsWith(ym)) continue
    if (!isBudgetSpend(s)) continue
    const cat = s.category.toLowerCase()
    spent.set(cat, (spent.get(cat) ?? 0) + Math.abs(s.amount))
  }
  for (const [category, limit] of Object.entries(data.budgetGoals)) {
    if (limit <= 0) continue
    const used = spent.get(category.toLowerCase()) ?? 0
    const highlightId = largestSpendingIdForCategory(data, category, ym)
    const spendingTo = highlightId
      ? spendingHighlightUrl(highlightId, { category: category.toLowerCase(), month: ym })
      : `/spending?category=${encodeURIComponent(category.toLowerCase())}&month=${ym}`
    if (used > limit) {
      alerts.push({
        id: `budget-${category}`,
        severity: 'red',
        title: `Budget overrun: ${category}`,
        detail: `Spent ${formatGBP(used)} vs limit ${formatGBP(limit)} this month.`,
        to: spendingTo,
      })
    } else if (used / limit >= 0.8) {
      alerts.push({
        id: `budget-near-${category}`,
        severity: 'amber',
        title: `Budget nearly full: ${category}`,
        detail: 'Approaching the monthly cap.',
        to: spendingTo,
      })
    }
  }

  for (const bill of dueWithinDays(data.recurringTransactions, 7).slice(0, 3)) {
    alerts.push({
      id: `bill-due-${bill.id}`,
      severity: 'amber',
      title: `Bill due: ${bill.name}`,
      detail: `Next due ${bill.nextDue.slice(0, 10)}.`,
      to: recurringFocusUrl(bill.id),
    })
  }

  const alloc = calcAllocation(breakdown.equity.value, data.crypto)
  const actions = calcRebalanceActions(alloc, data.targetAllocations)
  if (actions.some((a) => Math.abs(a.pctDiff) >= 10) && alloc.total > 0) {
    const worst = actions.reduce((acc, a) =>
      Math.abs(a.pctDiff) > Math.abs(acc.pctDiff) ? a : acc,
    )
    const sleeveLabel =
      worst.bucket === 'equity'
        ? 'Equities'
        : worst.bucket === 'crypto'
          ? 'Crypto'
          : 'Cash'
    const overUnder = worst.pctDiff > 0 ? 'under' : 'over'
    const pts = Math.abs(Math.round(worst.pctDiff))
    alerts.push({
      id: 'alloc-drift',
      severity: 'amber',
      title: 'Allocation drift',
      detail: `${sleeveLabel} ${pts}pts ${overUnder} target — open Planning to rebalance.`,
      to: '/planning',
    })
  }

  if (breakdown.liability.monthly > 0 && data.monthlyIncome > 0) {
    const ratio = breakdown.liability.monthly / data.monthlyIncome
    if (ratio >= 0.4) {
      alerts.push({
        id: 'dti',
        severity: 'red',
        title: 'High debt service vs income',
        detail: `Min payments are ~${Math.round(ratio * 100)}% of monthly income.`,
        to: '/optimizer',
      })
    }
  }

  for (const g of data.goals) {
    if (g.ragStatus === 'red') {
      alerts.push({
        id: `goal-${g.id}`,
        severity: 'red',
        title: `Goal at risk: ${g.name}`,
        detail: 'Marked critical — open Goals to update plan.',
        to: '/goals',
      })
    }
  }

  for (const due of liabilitiesDueWithinDays(data.creditCards, data.loans, 7).slice(0, 3)) {
    alerts.push({
      id: `liability-due-${due.kind}-${due.id}`,
      severity: due.daysUntil <= 2 ? 'red' : 'amber',
      title: `Payment due: ${due.name}`,
      detail:
        due.daysUntil === 0
          ? `Minimum ${formatGBP(due.minPay)} due today.`
          : `Minimum ${formatGBP(due.minPay)} due in ${due.daysUntil} day${due.daysUntil === 1 ? '' : 's'}.`,
      to: `/liabilities/${due.kind}/${due.id}?payment=1&amount=${encodeURIComponent(String(due.minPay))}`,
    })
  }

  for (const holding of data.equities) {
    if (!holding.corporateActionNote || !isCorporateActionDue(holding.corporateActionDate)) continue
    alerts.push({
      id: `corp-action-${holding.id}`,
      severity: 'amber',
      title: `Corporate action: ${holding.symbol}`,
      detail: holding.corporateActionNote,
      to: `/equities/${holding.id}#corporate-action`,
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      severity: 'green',
      title: 'No critical alerts',
      detail: 'RAG, budgets, and allocation look calm. Keep logging progress.',
      to: '/liabilities',
    })
  }

  return alerts.slice(0, 12)
}

export function ragFromPct(pct: number): RagStatus {
  if (pct < -20) return 'red'
  if (pct < 0) return 'amber'
  return 'green'
}
