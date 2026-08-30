import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calculateReminders } from '../components/SmartReminders'
import { projectScenario } from '../domain/advancedAnalytics'
import { buildAlerts } from '../domain/alerts'
import { calcCash, goalProgress, ownedHoldingSymbols } from '../domain/calc'
import { createEmptyPortfolio } from '../domain/defaults'
import { calcFamilyTotals } from '../domain/family'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { createTodoItem, isDueToday, isOverdue } from '../domain/todos'
import type { FamilyState, NetWorthBreakdown } from '../domain/types'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function breakdown(assets: number, liabilities: number): NetWorthBreakdown {
  const empty = { value: 0, cost: 0, pnl: 0, pct: 0 }
  return {
    netWorth: assets - liabilities,
    assets,
    liabilities,
    crypto: empty,
    equity: empty,
    liability: { cc: 0, loans: liabilities, total: liabilities, monthly: 0 },
  }
}

describe('bug hunt (v1.2.119)', () => {
  it('bumps package + release notes', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.141')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.141')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.141',
      '1.2.140',
      '1.2.139',
      '1.2.137',
      '1.2.135',
    ])
  })

  it('parses todo due dates as local calendar days', () => {
    const due = createTodoItem({ title: 'Call', listId: 1, dueDate: '2026-08-26' })
    const morning = new Date(2026, 7, 26, 8, 0, 0)
    const late = new Date(2026, 7, 26, 23, 30, 0)
    const nextMorning = new Date(2026, 7, 27, 8, 0, 0)
    expect(isDueToday(due, morning)).toBe(true)
    expect(isDueToday(due, late)).toBe(true)
    expect(isOverdue(due, morning)).toBe(false)
    expect(isOverdue(due, late)).toBe(false)
    expect(isOverdue(due, nextMorning)).toBe(true)
    expect(read('../domain/todos.ts')).toMatch(/new Date\(y, m - 1, d\)/)
  })

  it('uses cash/stables for Today and scenario runway, not net worth', () => {
    expect(read('../pages/Dashboard.tsx')).toMatch(/buildCashflowRunway/)
    expect(read('../pages/Dashboard.tsx')).not.toMatch(/liquidishNetWorth/)
    const cashOnly = projectScenario({
      assets: 100_000,
      liabilities: 0,
      monthlyIncome: 0,
      monthlyExpenses: 2_000,
      incomeDeltaPct: 0,
      marketReturnPct: 0,
      inflationPct: 0,
      cash: 4_000,
    })
    expect(cashOnly.runwayMonths).toBe(2)
    const empty = createEmptyPortfolio()
    empty.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 1, cost: 1000 }]
    expect(calcCash(empty)).toBe(1000)
  })

  it('keeps manual family NW when shareDebt is off and assets are blank', () => {
    const primary = breakdown(10_000, 2_000)
    const family: FamilyState = {
      members: [
        { id: 'primary', name: 'You', role: 'Primary', type: 'primary', isActive: true },
        {
          id: 'partner',
          name: 'Partner',
          role: 'Partner',
          type: 'partner',
          isActive: true,
          networth: 2_500,
        },
      ],
      settings: { combined: true, shareDebt: false, familyPrivacy: false },
    }
    const totals = calcFamilyTotals(primary, family, new Map())
    expect(totals.assets).toBe(12_500)
    expect(totals.debt).toBe(0)
    expect(totals.netWorth).toBe(12_500)
    expect(totals.contributions.map((c) => c.netWorth)).toEqual([10_000, 2_500])
  })

  it('skips income rows and excluded debts in alerts / reminders', () => {
    const data = createEmptyPortfolio()
    data.spending = [
      { id: 1, date: '2026-08-01', description: 'Salary', category: 'income', amount: 4000 },
      { id: 2, date: '2026-08-02', description: 'Food', category: 'food', amount: 80 },
    ]
    data.budgetGoals = { food: 200 }
    data.creditCards = [
      {
        id: 9,
        name: 'Hidden card',
        balance: 4000,
        apr: 29.9,
        minPay: 80,
        limit: 5000,
        includeInPortfolio: false,
        ragStatus: 'red',
      },
    ]
    data.loans = [{ id: 2, name: 'Card loan', balance: 2500, apr: 22, minPay: 50, original: 3000 }]
    const alerts = buildAlerts(data)
    expect(alerts.some((a) => a.id.startsWith('budget-'))).toBe(false)
    expect(alerts.some((a) => a.id === 'card-rag-9')).toBe(false)
    const reminders = calculateReminders(data)
    expect(reminders.some((r) => r.id.startsWith('budget-'))).toBe(false)
    expect(reminders.some((r) => r.id === 'debt-high-interest-2')).toBe(true)
    expect(reminders.some((r) => r.id === 'debt-high-interest-9')).toBe(false)
  })

  it('uses live goal progress instead of a missing goal.current field', () => {
    const data = createEmptyPortfolio()
    data.equities = [{ id: 1, symbol: 'VWRL', name: 'VWRL', shares: 90, avgCost: 100, livePrice: 100 }]
    data.goals = [
      {
        id: 1,
        name: 'ISA pot',
        type: 'investment',
        target: 10_000,
        metric: 'equity',
        deadline: '2026-09-10',
        created: '2026-01-01',
      },
    ]
    const reminders = calculateReminders(data)
    expect(reminders.some((r) => r.id === 'goal-behind-ISA pot')).toBe(false)
    expect(goalProgress(data, data.goals[0])).toBe(90)
    expect(read('../components/ExportReport.tsx')).toMatch(/goalCurrent\(data, goal.metric, goal\)/)
    expect(read('../components/SmartReminders.tsx')).toMatch(/goalProgress\(data, goal\)/)
  })

  it('owns News / YouTube / Markets from the live included book', () => {
    const data = createEmptyPortfolio()
    data.equities = [
      { id: 1, symbol: 'VWRL', name: 'VWRL', shares: 10, avgCost: 95, livePrice: 100 },
      {
        id: 2,
        symbol: 'TSLA',
        name: 'Tesla',
        shares: 1,
        avgCost: 200,
        livePrice: 200,
        includeInPortfolio: false,
      },
    ]
    data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.1, price: 80_000, cost: 4000 }]
    expect(ownedHoldingSymbols(data).sort()).toEqual(['BTC', 'VWRL'])
    expect(read('../pages/NewsPage.tsx')).toMatch(/ownedHoldingSymbols\(data\)/)
    expect(read('../pages/YouTubePage.tsx')).toMatch(/ownedHoldingSymbols\(data\)/)
    expect(read('../pages/MarketsPage.tsx')).toMatch(/if \(c\.includeInPortfolio === false\) continue/)
    expect(read('../pages/MarketsPage.tsx')).toMatch(/if \(!t\.includeInNetWorth\) continue/)
    expect(read('../pages/FamilyPage.tsx')).toMatch(/calcBreakdownWithPaper/)
    expect(read('../pages/ComparePage.tsx')).toMatch(/Commodities/)
  })
})
