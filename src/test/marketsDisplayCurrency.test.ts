import { describe, expect, it } from 'vitest'
import { setDisplayCurrency, formatGBPMarket, formatGBPPrecise, formatNativeCurrency, formatGBP } from '../utils/format'

describe('formatGBPMarket display currency', () => {
  it('converts small crypto GBP prints to USD with code (never US$)', () => {
    setDisplayCurrency('USD', { GBP: 1, USD: 1.27 })
    const ada = formatGBPMarket(0.1187)
    expect(ada).toMatch(/USD/)
    expect(ada).not.toMatch(/US\$/)
    expect(ada).not.toMatch(/£/)
    expect(ada).toMatch(/0\.1507|0\.1508/)
  })

  it('keeps GBP symbol when display currency is GBP', () => {
    setDisplayCurrency('GBP', { GBP: 1, USD: 1.27 })
    const night = formatGBPMarket(0.0218)
    expect(night).toMatch(/£/)
    expect(night).toMatch(/0\.0218/)
  })

  it('formats larger prints with 2 dp in USD code', () => {
    setDisplayCurrency('USD', { GBP: 1, USD: 1.25 })
    const btc = formatGBPPrecise(50000)
    expect(btc).toMatch(/USD/)
    expect(btc).not.toMatch(/US\$/)
    expect(btc).not.toMatch(/£/)
    expect(btc).toMatch(/62,500/)
  })

  it('formatGBP never emits US$ for USD display', () => {
    setDisplayCurrency('USD', { GBP: 1, USD: 1.3 })
    const s = formatGBP(1000)
    expect(s).toMatch(/USD/)
    expect(s).not.toMatch(/US\$/)
  })
})

describe('formatNativeCurrency', () => {
  it('defaults to 2 decimal places for GBP/USD', () => {
    expect(formatNativeCurrency(12.5, 'GBP')).toMatch(/12\.50/)
    expect(formatNativeCurrency(12.5, 'USD')).toMatch(/12\.50/)
    expect(formatNativeCurrency(12.5, 'USD')).toMatch(/USD/)
    expect(formatNativeCurrency(12.5, 'USD')).not.toMatch(/US\$/)
  })

  it('uses 0 decimals for JPY and KRW', () => {
    expect(formatNativeCurrency(1234.6, 'JPY')).toMatch(/1,235|1235/)
    expect(formatNativeCurrency(1234.6, 'KRW')).not.toMatch(/\.\d/)
  })
})
