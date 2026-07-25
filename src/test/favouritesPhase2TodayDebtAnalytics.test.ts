import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compareDebtStrategies,
  estimateDebtPaydown,
  type DebtStrategyDebt,
} from '../domain/debtStrategies'
import type { CreditCard, Loan } from '../domain/types'

describe('favourites phase-2 Today, debt, and analytics follow-ups', () => {
  it('wires Daily plan and Career pulse into Today customization', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(dashboard).toMatch(/data-testid="today-daily-plan"/)
    expect(dashboard).toMatch(/data-testid="today-career-pulse"/)
    expect(dashboard).toMatch(/id: 'dailyPlan'/)
    expect(dashboard).toMatch(/id: 'careerPulse'/)
    expect(dashboard).toMatch(/needsFollowUp\(job\)/)
  })

  it('models and renders liability payment ledger, strategy compare, and settlement CRM', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/LiabilityDetailPage.tsx'), 'utf8')
    const types = readFileSync(resolve(__dirname, '../domain/types.ts'), 'utf8')
    const normalize = readFileSync(resolve(__dirname, '../domain/normalize.ts'), 'utf8')

    expect(types).toMatch(/paymentHistory\?: LiabilityPayment\[\]/)
    expect(types).toMatch(/settlementStatus\?: SettlementStatus/)
    expect(normalize).toMatch(/normalizePaymentHistory/)
    expect(normalize).toMatch(/normalizeSettlementStatus/)
    expect(detail).toMatch(/data-testid="liability-payment-ledger"/)
    expect(detail).toMatch(/data-testid="liability-paydown-compare"/)
    expect(detail).toMatch(/data-testid="liability-settlement"/)
  })

  it('wires honest scenario sliders and projection summaries in analytics', () => {
    const predictive = readFileSync(resolve(__dirname, '../pages/PredictiveAnalyticsPage.tsx'), 'utf8')
    const analytics = readFileSync(resolve(__dirname, '../pages/AnalyticsPage.tsx'), 'utf8')
    const advanced = readFileSync(resolve(__dirname, '../domain/advancedAnalytics.ts'), 'utf8')

    expect(predictive).toMatch(/data-testid="analytics-scenarios"/)
    expect(predictive).toMatch(/data-testid="analytics-projections"/)
    expect(predictive).toMatch(/Simple sliders, not AI/)
    expect(predictive).toMatch(/privacyClass\(privacy\)/)
    expect(advanced).toMatch(/projectScenario/)
    expect(advanced).toMatch(/estimateFireYears/)
    expect(analytics).toMatch(/Model-based forecasting/)
  })

  it('estimates snowball and avalanche payoff with rolled minimum payments', () => {
    const debts: DebtStrategyDebt[] = [
      { id: 'high-apr', name: 'High APR', balance: 1000, apr: 29.9, minPay: 80 },
      { id: 'small', name: 'Small balance', balance: 300, apr: 5, minPay: 40 },
    ]

    const snowball = estimateDebtPaydown(debts, 'snowball')
    const avalanche = estimateDebtPaydown(debts, 'avalanche')

    expect(snowball.monthlyPayment).toBe(120)
    expect(avalanche.months).not.toBeNull()
    expect(snowball.months).not.toBeNull()
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest)
  })

  it('compares all credit cards and loans and returns a finite winner state', () => {
    const cards: CreditCard[] = [
      { id: 1, name: 'Card', balance: 900, apr: 24, minPay: 75, limit: 1500 },
    ]
    const loans: Loan[] = [
      { id: 1, name: 'Loan', balance: 1200, apr: 8, minPay: 100, original: 2000 },
    ]

    const result = compareDebtStrategies(cards, loans)

    expect(result.avalanche.startingDebt).toBe(2100)
    expect(result.snowball.monthlyPayment).toBe(175)
    expect(['snowball', 'avalanche', 'tie', 'none']).toContain(result.winner)
  })
})
