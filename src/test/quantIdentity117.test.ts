import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcBreakdown, calcCash, calcNetWorth, goalCurrent } from '../domain/calc'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { equityNativeCurrency, equityNeedsUsdToGbp } from '../domain/equityCurrency'
import { estimateMonthlySurplus } from '../domain/goalProjectedDate'
import { normalizePortfolio } from '../domain/normalize'

describe('quant identity (v1.2.117)', () => {
  it('uses one asset engine: Analytics totals match calcBreakdown on seed prices', () => {
    const sample = normalizePortfolio(createSamplePortfolio())
    const b = calcBreakdown(sample)
    expect(b.assets).toBeGreaterThan(0)
    expect(b.equity.value).toBe(50 * 95 + 30 * 75)
    const page = readFileSync(resolve(__dirname, '../pages/PredictiveAnalyticsPage.tsx'), 'utf8')
    expect(page).toMatch(/const totalAssets = breakdown\.assets/)
    expect(page).toMatch(/const totalLiabilities = breakdown\.liabilities/)
    expect(page).not.toMatch(/e\.shares \* e\.livePrice/)
  })

  it('emergency-fund Current is cash/stables, not net worth', () => {
    const sample = normalizePortfolio(createSamplePortfolio())
    const emergency = sample.goals.find((g) => /^emergency fund$/i.test(g.name))
    expect(emergency?.metric).toBe('cash')
    expect(goalCurrent(sample, 'cash')).toBe(1000)
    expect(goalCurrent(sample, 'cash')).not.toBe(calcNetWorth(sample))
    expect(calcCash(sample)).toBe(1000)

    const persisted = normalizePortfolio({
      ...createEmptyPortfolio(),
      crypto: [{ id: 3, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 }],
      goals: [
        {
          id: 2,
          name: 'Emergency fund',
          type: 'networth',
          target: 10000,
          metric: 'networth',
          deadline: '2027-06-30',
          created: '2026-01-01',
        },
      ],
    })
    expect(persisted.goals[0]?.metric).toBe('cash')
    expect(goalCurrent(persisted, persisted.goals[0]!.metric)).toBe(1000)
    expect(goalCurrent(sample, 'networth', { name: 'Emergency fund' })).toBe(1000)
    expect(goalCurrent(sample, 'networth', { name: 'Emergency fund' })).not.toBe(
      calcNetWorth(sample),
    )
  })

  it('treats VWRL and VUSA as GBP LSE listings, not USD', () => {
    expect(equityNativeCurrency('VWRL')).toBe('GBP')
    expect(equityNativeCurrency('VUSA')).toBe('GBP')
    expect(equityNeedsUsdToGbp('VWRL')).toBe(false)
    expect(equityNeedsUsdToGbp('TSLA')).toBe(true)
    expect(equityNativeCurrency('VOD.L')).toBe('GBP')
  })

  it('uses cashflow leftover for monthly surplus — not Settings income', () => {
    const data = createEmptyPortfolio()
    data.monthlyIncome = 5000
    data.monthlyExpenses = 3000
    data.recurringTransactions = [
      { id: 1, name: 'Pay', amount: 5000, category: 'income', frequency: 'monthly', nextDue: '2026-07-01' },
      { id: 2, name: 'Rent', amount: 3000, category: 'bills', frequency: 'monthly', nextDue: '2026-07-02' },
    ]
    data.creditCards = [
      { id: 1, name: 'Card', balance: 500, apr: 20, minPay: 50, limit: 3000 },
    ]
    data.loans = [{ id: 1, name: 'Loan', balance: 3000, apr: 1.5, minPay: 50, original: 5000 }]
    expect(estimateMonthlySurplus(data)).toBe(2000)
  })
})
