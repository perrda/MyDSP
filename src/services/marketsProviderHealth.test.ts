import { beforeEach, describe, expect, it } from 'vitest'
import {
  formatMarketsProviderHealthHint,
  getMarketsProviderHealth,
  providerFromQuoteSource,
  recordMarketsRefreshHealth,
  resetMarketsProviderHealth,
} from './marketsProviderHealth'

describe('marketsProviderHealth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    resetMarketsProviderHealth()
  })

  it('maps quote sources onto provider buckets', () => {
    expect(providerFromQuoteSource('coingecko')).toBe('coingecko')
    expect(providerFromQuoteSource('yahoo-chart')).toBe('yahoo')
    expect(providerFromQuoteSource('finnhub')).toBe('finnhub')
    expect(providerFromQuoteSource('manual')).toBeNull()
    expect(providerFromQuoteSource('error')).toBeNull()
  })

  it('records successes and escalates consecutive failures', () => {
    recordMarketsRefreshHealth([
      { kind: 'crypto', last: 50000, source: 'coingecko' },
      { kind: 'equity', last: 0, source: 'none' },
    ])
    let yahoo = getMarketsProviderHealth().find((p) => p.id === 'yahoo')!
    expect(yahoo.consecutiveFailures).toBe(1)
    expect(getMarketsProviderHealth().find((p) => p.id === 'coingecko')!.consecutiveFailures).toBe(0)

    recordMarketsRefreshHealth([{ kind: 'equity', last: 0, source: 'error' }])
    yahoo = getMarketsProviderHealth().find((p) => p.id === 'yahoo')!
    expect(yahoo.consecutiveFailures).toBe(2)
    expect(formatMarketsProviderHealthHint()).toMatch(/Yahoo 2× fail/)
  })

  it('does not hint until minFailures threshold', () => {
    recordMarketsRefreshHealth([{ kind: 'index', last: 0, source: 'none' }])
    expect(formatMarketsProviderHealthHint()).toBeNull()
    expect(formatMarketsProviderHealthHint(1)).toMatch(/Yahoo/)
  })
})
