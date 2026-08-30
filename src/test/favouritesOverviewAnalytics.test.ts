import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateFinancialHealth } from '../domain/advancedAnalytics'

function numericLeaves(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap((v) => numericLeaves(v))
}

describe('favourites Overview + predictive analytics fixes', () => {
  it('keeps Today nav while shell and PageHeader say Today', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(shell).toMatch(/'\/': \{ eyebrow: 'Portfolio', title: 'Today' \}/)
    expect(sidebar).toMatch(/SIDEBAR_NAV/)
    expect(readFileSync(resolve(__dirname, '../domain/primaryNav.ts'), 'utf8')).toMatch(
      /label: 'Today'/,
    )
    expect(dashboard).toMatch(/gradient-text">Today</)
  })

  it('wires Today customization, conditional chips, trust strip, and five movers', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(dashboard).toMatch(/mydsp\.today\.layout\.v1/)
    expect(dashboard).toMatch(/TODAY_LAYOUT_CARD_OPTIONS/)
    expect(dashboard).toMatch(/hiddenCards/)
    expect(dashboard).toMatch(/showBillsCard[\s\S]*today-section-jump-bills/)
    expect(dashboard).toMatch(/showGoalsCard[\s\S]*today-section-jump-goals/)
    expect(dashboard).toMatch(/today-trust-strip/)
    expect(css).toMatch(/\.today-trust-strip/)
    expect(dashboard).toMatch(/\.slice\(0, 5\)/)
  })

  it('uses predictive market values, privacy classes, honest copy, and action links', () => {
    const page = readFileSync(resolve(__dirname, '../pages/PredictiveAnalyticsPage.tsx'), 'utf8')

    expect(page).toMatch(/const totalAssets = breakdown\.assets/)
    expect(page).toMatch(/const totalLiabilities = breakdown\.liabilities/)
    expect(page).toMatch(/privacyClass\(privacy\)/)
    expect(page).toMatch(/Projection models/)
    expect(page).not.toMatch(/AI-powered/)
    expect(page).toMatch(/to: '\/liabilities'/)
    expect(page).toMatch(/to: '\/budgets'/)
    expect(page).toMatch(/grid grid-cols-1 sm:grid-cols-3/)
  })

  it('returns finite health numbers with zero income and no budgets', () => {
    const health = calculateFinancialHealth({
      netWorth: 1000,
      assets: 1000,
      liabilities: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      spending: [],
      budgetGoals: {},
    })

    expect(numericLeaves(health).every(Number.isFinite)).toBe(true)
    expect(health.components.savingsRate.value).toBe(0)
    expect(health.components.emergencyFund.months).toBe(6)
    expect(health.components.budgetAdherence.value).toBe(100)
  })

  it('returns finite health numbers when expenses exist without income', () => {
    const health = calculateFinancialHealth({
      netWorth: 500,
      assets: 1000,
      liabilities: 500,
      monthlyIncome: 0,
      monthlyExpenses: 250,
      spending: [],
      budgetGoals: {},
    })

    expect(numericLeaves(health).every(Number.isFinite)).toBe(true)
    expect(health.components.savingsRate.value).toBe(-100)
    expect(health.components.debtRatio.value).toBe(50)
    expect(health.components.emergencyFund.months).toBe(4)
  })
})
