import { describe, expect, it } from 'vitest'
import { buildFullReportHtml } from '../utils/fullReportHtml'

describe('buildFullReportHtml', () => {
  it('includes portfolio, spending, goals, liabilities, and tax residency sections', () => {
    const html = buildFullReportHtml({
      history: [{ netWorth: 125000 }],
      crypto: [{ symbol: 'BTC', qty: 0.5, price: 50000 }],
      equities: [{ symbol: 'TSLA', shares: 10, livePrice: 200 }],
      spending: [
        { date: '2026-07-01', description: 'Food', category: 'groceries', amount: 40 },
        { date: '2026-07-02', description: 'Train', category: 'transport', amount: 12 },
      ],
      goals: [
        {
          name: 'Emergency fund',
          target: 10000,
          deadline: '2027-01-01',
          type: 'networth',
          startVal: 2000,
        },
      ],
      creditCards: [{ name: 'Amex', balance: 500 }],
      loans: [{ name: 'Car', balance: 3000 }],
      settings: { taxResidency: 'GB' },
    })

    expect(html).toContain('Full Financial Report')
    expect(html).toContain('Portfolio summary')
    expect(html).toContain('BTC')
    expect(html).toContain('TSLA')
    expect(html).toContain('Spending')
    expect(html).toContain('Totals by category')
    expect(html).toContain('groceries')
    expect(html).toContain('Goals progress')
    expect(html).toContain('Emergency fund')
    expect(html).toContain('Liabilities')
    expect(html).toContain('Amex')
    expect(html).toContain('Tax residency')
    expect(html).toContain('GB')
    expect(html).not.toContain('Coming soon')
  })

  it('renders empty placeholders without throwing', () => {
    const html = buildFullReportHtml({})
    expect(html).toContain('No crypto holdings')
    expect(html).toContain('No equity holdings')
    expect(html).toContain('No spending')
    expect(html).toContain('No goals')
    expect(html).toContain('No liabilities')
  })
})
