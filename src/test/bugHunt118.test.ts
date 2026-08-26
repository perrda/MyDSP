import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calculateFinancialHealth, estimateFireYears, projectScenario } from '../domain/advancedAnalytics'
import { calcCash, calcLiabilities, cryptoMarkPrice } from '../domain/calc'
import { simulateDebt } from '../domain/debt'
import { debtsFromLiabilities, estimateDebtPaydown } from '../domain/debtStrategies'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { estimateMonthlyExpenses, estimateMonthlySurplus } from '../domain/goalProjectedDate'
import { equityUnitPriceGbp } from '../domain/migrateEquityGbp'
import { normalizePortfolio } from '../domain/normalize'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { firstSyncHighlightHref } from '../services/sync/syncHighlights'
import { buildFullReportHtml } from '../utils/fullReportHtml'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('bug hunt (v1.2.118)', () => {
  it('bumps package + release notes', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.118')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.118')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.118',
      '1.2.117',
      '1.2.116',
      '1.2.114',
      '1.2.113',
    ])
  })

  it('rolls freed minimum payments in the Optimizer simulation', () => {
    const cards = [
      { id: 1, name: 'Card', balance: 500, apr: 20, minPay: 50, limit: 3000 },
    ]
    const loans = [{ id: 1, name: 'Loan', balance: 3000, apr: 1.5, minPay: 50, original: 5000 }]
    const sim = simulateDebt(cards, loans, 'avalanche', 0)
    const est = estimateDebtPaydown(debtsFromLiabilities(cards, loans), 'avalanche')
    expect(est.months).not.toBeNull()
    expect(sim.months).toBe(est.months)
    expect(sim.totalInt).toBeCloseTo(est.totalInterest, 0)
    expect(sim.months).toBeLessThan(65)
  })

  it('uses Settings expenses (not income rows) and cash emergency coverage', () => {
    const data = normalizePortfolio(createSamplePortfolio())
    expect(estimateMonthlyExpenses(data)).toBe(2500)
    expect(estimateMonthlySurplus(data)).toBe(
      data.monthlyIncome - 2500 - calcLiabilities(data).monthly,
    )

    const incomeInflated = createEmptyPortfolio()
    incomeInflated.monthlyIncome = 4000
    incomeInflated.spending = [
      { id: 1, date: '2026-08-01', description: 'Salary', category: 'income', amount: 4000 },
      { id: 2, date: '2026-08-02', description: 'Food', category: 'food', amount: 200 },
    ]
    expect(estimateMonthlyExpenses(incomeInflated)).toBe(200)

    const health = calculateFinancialHealth({
      netWorth: 10000,
      assets: 13500,
      liabilities: 3500,
      monthlyIncome: 5000,
      monthlyExpenses: 2500,
      spending: [],
      budgetGoals: {},
      cashBalance: calcCash(data),
      monthlyDebtService: calcLiabilities(data).monthly,
    })
    expect(health.components.emergencyFund.months).toBeCloseTo(1000 / 2500, 1)
    expect(health.components.savingsRate.value).toBe(
      Math.round(((5000 - 2500 - calcLiabilities(data).monthly) / 5000) * 100),
    )
  })

  it('subtracts minPay from scenario surplus and FIRE-ish years', () => {
    const base = projectScenario({
      assets: 10000,
      liabilities: 3500,
      monthlyIncome: 5000,
      monthlyExpenses: 2500,
      incomeDeltaPct: 0,
      marketReturnPct: 0,
      inflationPct: 0,
      monthlyDebtService: 100,
    })
    expect(base.monthlySurplus).toBe(2400)

    const fire = estimateFireYears({
      assets: 10000,
      monthlyIncome: 5000,
      monthlyExpenses: 2500,
      monthlyDebtService: 100,
      annualReturnPct: 0,
    })
    const fireIgnoreDebt = estimateFireYears({
      assets: 10000,
      monthlyIncome: 5000,
      monthlyExpenses: 2500,
      annualReturnPct: 0,
    })
    expect(fire).not.toBeNull()
    expect(fireIgnoreDebt).not.toBeNull()
    expect(fire!).toBeGreaterThan(fireIgnoreDebt!)
  })

  it('values unquoted holdings via mark-price helpers in reports and Markets', () => {
    expect(cryptoMarkPrice({ qty: 1000, price: 0, cost: 1000 })).toBe(1)
    expect(equityUnitPriceGbp({ livePrice: 0, avgCost: 95 } as never)).toBe(95)
    const html = buildFullReportHtml({
      crypto: [{ symbol: 'USDC', qty: 1000, price: 0, cost: 1000 }],
      equities: [{ symbol: 'VWRL', shares: 50, livePrice: 0, avgCost: 95 }],
    })
    expect(html).toContain('USDC')
    expect(html).not.toMatch(/>£0\.00<|>\$0\.00</)
    const markets = read('../pages/MarketsPage.tsx')
    expect(markets).toMatch(/c\.qty \* cryptoMarkPrice\(c\)/)
    expect(markets).toMatch(/e\.shares \* equityUnitPriceGbp\(e\)/)
    expect(markets).not.toMatch(/e\.shares \* e\.livePrice/)
  })

  it('lands sync Open first on Journal highlight and Todos list', () => {
    expect(firstSyncHighlightHref({ journal: [9] })).toBe('/journal?highlight=9')
    expect(firstSyncHighlightHref({ todoLists: [3] })).toBe('/todos?list=3')
    expect(read('../pages/JournalPage.tsx')).toMatch(/searchParams\.get\('highlight'\)/)
    expect(read('../pages/JournalPage.tsx')).toMatch(/id=\{`journal-\$\{j\.id\}`\}/)
    expect(read('../pages/TodosPage.tsx')).toMatch(/searchParams\.get\('list'\)/)
    expect(read('../pages/TodosPage.tsx')).toMatch(/setSelectedListId\(id\)/)
  })

  it('wires Planning inflation/scenario, Commodities chrome, silent Markets migrate', () => {
    const planning = read('../pages/PlanningPage.tsx')
    expect(planning).toMatch(/planning-inflation/)
    expect(planning).toMatch(/planning-scenario-seed/)
    expect(planning).not.toMatch(/void urlInflation/)
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/'\/commodities': \{ eyebrow: 'Holdings', title: 'Commodities' \}/)
    expect(shell).toMatch(/pathname === '\/commodities'/)
    expect(read('../storage/marketsStore.ts')).toMatch(
      /writeState\(state, \{ silent: true \}\)/,
    )
  })

  it('highlights Daily plan / Career jump chips and honest Analytics spend', () => {
    const dash = read('../pages/Dashboard.tsx')
    const observer = dash.slice(dash.indexOf('const sectionIds = ['), dash.indexOf('const elements ='))
    expect(observer).toMatch(/today-daily-plan/)
    expect(observer).toMatch(/today-career-pulse/)
    expect(observer).not.toMatch(/today-debt/)
    expect(dash).toMatch(/openWeeklyDigestRef/)
    const analytics = read('../pages/AnalyticsPage.tsx')
    expect(analytics).toMatch(/isBudgetSpend\(s\)/)
    expect(analytics).not.toMatch(/monthSpend \* 1\.2/)
    expect(read('../pages/PredictiveAnalyticsPage.tsx')).toMatch(/estimateMonthlyExpenses/)
    expect(read('../pages/PredictiveAnalyticsPage.tsx')).toMatch(/Net worth change/)
    expect(read('../components/AdvancedAnalyticsDashboard.tsx')).toMatch(/goalCurrent\(/)
    expect(read('../pages/LiabilityDetailPage.tsx')).toMatch(/Payment logged: \$\{formatGBP\(amount\)\}/)
  })
})
