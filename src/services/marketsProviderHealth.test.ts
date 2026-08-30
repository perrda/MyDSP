import { beforeEach, describe, expect, it } from 'vitest'
import {
  formatMarketsProviderHealthHint,
  getMarketsProviderHealth,
  pingAllMarketsProviders,
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

  it('ping-all records success per provider id', async () => {
    const ok = async () => ({ ok: true as const, detail: 'OK' })
    const outcomes = await pingAllMarketsProviders({
      finnhubKey: 'test-key',
      probes: {
        coingecko: ok,
        yahoo: ok,
        finnhub: async () => ({ ok: true, detail: 'OK · AAPL 190' }),
        coincap: ok,
        coinbase: ok,
        fx: ok,
      },
    })
    expect(outcomes).toEqual({
      coingecko: 'ok',
      yahoo: 'ok',
      finnhub: 'ok',
      coincap: 'ok',
      coinbase: 'ok',
      fx: 'ok',
    })
    for (const row of getMarketsProviderHealth()) {
      expect(row.consecutiveFailures).toBe(0)
      expect(row.lastSuccessAt).toMatch(/T/)
    }
  })

  it('missing Finnhub key does not mark Finnhub OK or fail', async () => {
    localStorage.removeItem('finnhub_key')
    const ok = async () => ({ ok: true as const })
    const outcomes = await pingAllMarketsProviders({
      finnhubKey: '',
      probes: {
        coingecko: ok,
        yahoo: ok,
        finnhub: async () => ({ ok: true, detail: 'should not run' }),
        coincap: ok,
        coinbase: ok,
        fx: ok,
      },
    })
    expect(outcomes.finnhub).toBe('skip')
    const finnhub = getMarketsProviderHealth().find((p) => p.id === 'finnhub')!
    expect(finnhub.lastSuccessAt).toBeUndefined()
    expect(finnhub.consecutiveFailures).toBe(0)
    expect(finnhub.lastError).toBeUndefined()
    expect(getMarketsProviderHealth().find((p) => p.id === 'yahoo')!.lastSuccessAt).toBeTruthy()
  })

  it('CoinGecko 429 backoff is a skip, not a failure', async () => {
    const outcomes = await pingAllMarketsProviders({
      finnhubKey: '',
      probes: {
        coingecko: async () => ({ ok: false, skipped: true, detail: 'CoinGecko 429 backoff' }),
        yahoo: async () => ({ ok: true }),
        coincap: async () => ({ ok: true }),
        coinbase: async () => ({ ok: true }),
        fx: async () => ({ ok: true }),
      },
    })
    expect(outcomes.coingecko).toBe('skip')
    const gecko = getMarketsProviderHealth().find((p) => p.id === 'coingecko')!
    expect(gecko.lastSuccessAt).toBeUndefined()
    expect(gecko.consecutiveFailures).toBe(0)
  })

  it('holdings success this tick records OK without a second probe', async () => {
    let geckoCalls = 0
    const outcomes = await pingAllMarketsProviders({
      finnhubKey: '',
      sampledThisTick: [
        { source: 'coingecko', last: 50000 },
        { source: '', last: 1 },
        { source: 'coingecko', last: 0 },
        { source: 'manual', last: 12 },
      ],
      probes: {
        coingecko: async () => {
          geckoCalls += 1
          return { ok: true, detail: 'must not run' }
        },
        yahoo: async () => ({ ok: true }),
        coincap: async () => ({ ok: true }),
        coinbase: async () => ({ ok: true }),
        fx: async () => ({ ok: true }),
      },
    })
    expect(geckoCalls).toBe(0)
    expect(outcomes.coingecko).toBe('ok')
    const gecko = getMarketsProviderHealth().find((p) => p.id === 'coingecko')!
    expect(gecko.lastSuccessAt).toBeTruthy()
    expect(gecko.consecutiveFailures).toBe(0)
  })

  it('empty/undefined last does not count as success', async () => {
    const outcomes = await pingAllMarketsProviders({
      finnhubKey: '',
      sampledThisTick: [
        { source: 'yahoo', last: 0 },
        { source: 'yahoo', last: Number.NaN },
        { source: '', last: 190 },
      ],
      probes: {
        yahoo: async () => ({ ok: false, skipped: true, detail: 'Yahoo empty body' }),
        coingecko: async () => ({ ok: true }),
        coincap: async () => ({ ok: true }),
        coinbase: async () => ({ ok: true }),
        fx: async () => ({ ok: true }),
      },
    })
    expect(outcomes.yahoo).toBe('skip')
    const yahoo = getMarketsProviderHealth().find((p) => p.id === 'yahoo')!
    expect(yahoo.lastSuccessAt).toBeUndefined()
    expect(yahoo.consecutiveFailures).toBe(0)
  })

  it('ping-all records existing fail(s) copy on a down provider', async () => {
    await pingAllMarketsProviders({
      finnhubKey: '',
      probes: {
        yahoo: async () => ({ ok: false, detail: 'Yahoo empty quote' }),
        coingecko: async () => ({ ok: true }),
        coincap: async () => ({ ok: true }),
        coinbase: async () => ({ ok: true }),
        fx: async () => ({ ok: true }),
      },
    })
    const yahoo = getMarketsProviderHealth().find((p) => p.id === 'yahoo')!
    expect(yahoo.consecutiveFailures).toBe(1)
    expect(yahoo.lastError).toBe('Yahoo empty quote')
    expect(yahoo.lastSuccessAt).toBeUndefined()
  })
})
