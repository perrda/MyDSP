import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from './defaults'
import {
  applyCryptoCostFallback,
  calcCrypto,
  calcDebtBalance,
  calcEquity,
  calcNetWorth,
  calcSipp,
  cryptoMarkPrice,
  debtPaydownProgress,
  goalCurrent,
  goalProgress,
  hasLiveCryptoQuote,
  listUnpricedHoldings,
  unpricedExclusionCopy,
} from './calc'

describe('calc — priced book vs display mark', () => {
  it('keeps cost/qty as a display mark only — NW uses live quotes', () => {
    expect(cryptoMarkPrice({ qty: 0.05, price: 0, cost: 2000 })).toBe(40000)
    expect(hasLiveCryptoQuote({ price: 0 })).toBe(false)
    expect(hasLiveCryptoQuote({ price: 50 })).toBe(true)

    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 0, cost: 2000 }]
    data.equities = [
      { id: 1, symbol: 'VWRL', name: 'VWRL', shares: 10, avgCost: 100, livePrice: 0 },
    ]
    expect(calcCrypto(data).value).toBe(0)
    expect(calcEquity(data).value).toBe(0)
    expect(calcNetWorth(data)).toBe(0)
    expect(listUnpricedHoldings(data)).toHaveLength(2)
    expect(unpricedExclusionCopy(2)).toMatch(/2 holdings unpriced/)
  })

  it('sample unpriced crypto is excluded from net worth', () => {
    const sample = createSamplePortfolio()
    expect(calcCrypto(sample).value).toBe(0)
    expect(calcNetWorth(sample)).toBe(-calcDebtBalance(sample))
    expect(goalCurrent(sample, 'cash')).toBe(1000)
    expect(listUnpricedHoldings(sample).length).toBeGreaterThan(0)
  })

  it('does not write cost into price — that would fake a live quote', () => {
    const data = createEmptyPortfolio()
    data.crypto = [
      { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 80000, cost: 2000 },
      { id: 3, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 },
    ]
    const next = applyCryptoCostFallback(data)
    expect(next).toBe(data)
    expect(next.crypto.find((c) => c.symbol === 'USDC')?.price).toBe(0)
  })

  it('SIPP line is the full priced equity sleeve — not accountType sipp-only', () => {
    const data = createEmptyPortfolio()
    data.equities = [
      {
        id: 1,
        symbol: 'TSLA',
        name: 'Tesla',
        shares: 3149,
        avgCost: 51.5,
        livePrice: 348.75,
        accountType: 'general',
      },
      {
        id: 2,
        symbol: 'MSTR',
        name: 'MicroStrategy',
        shares: 10,
        avgCost: 200,
        livePrice: 400,
        accountType: 'isa',
      },
      {
        id: 3,
        symbol: 'VUSA',
        name: 'Unpriced',
        shares: 8,
        avgCost: 70,
        livePrice: 0,
        accountType: 'sipp',
      },
    ]
    const priced = 3149 * 348.75 + 10 * 400
    expect(calcEquity(data).value).toBe(priced)
    expect(calcSipp(data)).toBe(priced)
    expect(calcSipp(data)).toBe(calcEquity(data).value)
    expect(goalCurrent(data, 'sipp')).toBe(priced)
    expect(goalCurrent(data, 'equity')).toBe(priced)
  })

  it('one debt balance and descending pay-down', () => {
    const data = createEmptyPortfolio()
    data.creditCards = [{ id: 1, name: 'Card', balance: 400, apr: 20, minPay: 20, limit: 2000 }]
    data.loans = [{ id: 1, name: 'Loan', balance: 600, apr: 5, minPay: 30, original: 1000 }]
    expect(calcDebtBalance(data)).toBe(1000)
    expect(debtPaydownProgress(1000, 400, 0)).toBe(60)
    expect(
      goalProgress(data, {
        id: 1,
        name: 'Pay down',
        type: 'debt',
        target: 0,
        metric: 'debt',
        deadline: '2027-01-01',
        created: '2026-01-01',
        startVal: 1000,
      }),
    ).toBe(0)
  })
})
