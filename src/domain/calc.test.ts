import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from './defaults'
import {
  applyCryptoCostFallback,
  calcCrypto,
  calcEquity,
  calcNetWorth,
  cryptoMarkPrice,
  goalCurrent,
} from './calc'

describe('calc — mark prices and net worth', () => {
  it('falls crypto back to cost/qty when live price is 0 (equity parity)', () => {
    expect(cryptoMarkPrice({ qty: 0.05, price: 0, cost: 2000 })).toBe(40000)
    expect(cryptoMarkPrice({ qty: 2, price: 50, cost: 80 })).toBe(50)
    expect(cryptoMarkPrice({ qty: 0, price: 0, cost: 10 })).toBe(0)

    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 0, cost: 2000 }]
    data.equities = [
      { id: 1, symbol: 'VWRL', name: 'VWRL', shares: 10, avgCost: 100, livePrice: 0 },
    ]
    expect(calcCrypto(data).value).toBe(2000)
    expect(calcEquity(data).value).toBe(1000)
    expect(calcNetWorth(data)).toBe(3000)
  })

  it('sample crypto at price 0 still counts cost basis in net worth', () => {
    const sample = createSamplePortfolio()
    const crypto = calcCrypto(sample)
    expect(crypto.value).toBe(sample.crypto.reduce((s, c) => s + c.cost, 0))
    expect(calcNetWorth(sample)).toBeGreaterThan(0)
    expect(goalCurrent(sample, 'cash')).toBe(1000)
  })

  it('fills leftover zeros from cost after any coin has a live print', () => {
    const data = createEmptyPortfolio()
    data.crypto = [
      { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 80000, cost: 2000 },
      { id: 3, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 },
    ]
    const next = applyCryptoCostFallback(data)
    expect(next.crypto.find((c) => c.symbol === 'USDC')?.price).toBe(1)
    expect(applyCryptoCostFallback(data)).not.toBe(data)
    const cold = applyCryptoCostFallback({
      ...data,
      crypto: data.crypto.map((c) => ({ ...c, price: 0 })),
    })
    expect(cold.crypto.find((c) => c.symbol === 'USDC')?.price).toBe(1)
    expect(cold.crypto.find((c) => c.symbol === 'BTC')?.price).toBe(40000)
  })
})
