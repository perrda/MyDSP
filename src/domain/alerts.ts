/** Overview / command-centre alerts. */

import type { PortfolioData, RagStatus } from './types'
import { calcBreakdown } from './calc'
import { monthKey } from './monthUtils'
import { calcAllocation, calcRebalanceActions } from './rebalance'

export interface AppAlert {
  id: string
  severity: 'red' | 'amber' | 'green' | 'info'
  title: string
  detail: string
  to: string
}

export function buildAlerts(data: PortfolioData): AppAlert[] {
  const alerts: AppAlert[] = []
  const breakdown = calcBreakdown(data)
  const ym = monthKey()

  for (const c of data.creditCards) {
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
    if (c.limit > 0 && c.balance / c.limit >= 0.85 && c.includeInPortfolio !== false) {
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
    const cat = s.category.toLowerCase()
    spent.set(cat, (spent.get(cat) ?? 0) + Math.abs(s.amount))
  }
  for (const [category, limit] of Object.entries(data.budgetGoals)) {
    if (limit <= 0) continue
    const used = spent.get(category.toLowerCase()) ?? 0
    if (used > limit) {
      alerts.push({
        id: `budget-${category}`,
        severity: 'red',
        title: `Budget overrun: ${category}`,
        detail: `Spent ${used.toFixed(0)} vs limit ${limit.toFixed(0)} this month.`,
        to: `/spending?category=${encodeURIComponent(category.toLowerCase())}&month=${ym}`,
      })
    } else if (used / limit >= 0.8) {
      alerts.push({
        id: `budget-near-${category}`,
        severity: 'amber',
        title: `Budget nearly full: ${category}`,
        detail: 'Approaching the monthly cap.',
        to: `/spending?category=${encodeURIComponent(category.toLowerCase())}&month=${ym}`,
      })
    }
  }

  const alloc = calcAllocation(breakdown.equity.value, data.crypto)
  const actions = calcRebalanceActions(alloc, data.targetAllocations)
  if (actions.some((a) => Math.abs(a.pctDiff) >= 10) && alloc.total > 0) {
    alerts.push({
      id: 'alloc-drift',
      severity: 'amber',
      title: 'Allocation drift',
      detail: 'Portfolio weights have drifted from targets.',
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
