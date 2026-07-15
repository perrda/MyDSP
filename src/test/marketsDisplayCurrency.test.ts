import { describe, expect, it } from 'vitest'
import { setDisplayCurrency, formatGBPMarket, formatGBPPrecise, formatNativeCurrency } from '../utils/format'

describe('formatGBPMarket display currency', () => {
  it('converts small crypto GBP prints to USD with extra decimals', () => {
    setDisplayCurrency('USD', { GBP: 1, USD: 1.27 })
    const ada = formatGBPMarket(0.1187)
    expect(ada).toMatch(/US\$|\$/)
    expect(ada).not.toMatch(/£/)
    // 0.1187 / (1/1.27) wait — convertFromGbp: amount * rates.USD = 0.1187 * 1.27
    expect(ada).toMatch(/0\.1507|0\.1508/)
  })

  it('keeps GBP symbol when display currency is GBP', () => {
    setDisplayCurrency('GBP', { GBP: 1, USD: 1.27 })
    const night = formatGBPMarket(0.0218)
    expect(night).toMatch(/£/)
    expect(night).toMatch(/0\.0218/)
  })

  it('formats larger prints with 2 dp in USD', () => {
    setDisplayCurrency('USD', { GBP: 1, USD: 1.25 })
    const btc = formatGBPPrecise(50000)
    expect(btc).toMatch(/US\$|\$/)
    expect(btc).not.toMatch(/£/)
    expect(btc).toMatch(/62,500/)
  })
})

describe('formatNativeCurrency', () => {
  it('defaults to 2 decimal places for GBP/USD', () => {
    expect(formatNativeCurrency(12.5, 'GBP')).toMatch(/12\.50/)
    expect(formatNativeCurrency(12.5, 'USD')).toMatch(/12\.50/)
  })

  it('uses 0 decimals for JPY and KRW', () => {
    expect(formatNativeCurrency(1234.6, 'JPY')).toMatch(/1,235|1235/)
    expect(formatNativeCurrency(1234.6, 'KRW')).not.toMatch(/\.\d/)
  })
})
