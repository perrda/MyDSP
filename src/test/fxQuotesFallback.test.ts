import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchFrankfurterFxQuote, fetchFxPairQuote } from '../services/prices'

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return String(input)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FX quote fallbacks', () => {
  it('builds a short sparkline from Frankfurter daily rates', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = urlOf(input as RequestInfo | URL)
      if (url.includes('frankfurter')) {
        return new Response(
          JSON.stringify({
            amount: 1,
            base: 'GBP',
            rates: {
              '2026-07-07': { USD: 1.32 },
              '2026-07-08': { USD: 1.325 },
              '2026-07-09': { USD: 1.33 },
              '2026-07-10': { USD: 1.328 },
              '2026-07-11': { USD: 1.335 },
              '2026-07-13': { USD: 1.338 },
              '2026-07-14': { USD: 1.34 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('no', { status: 404 })
    })

    const q = await fetchFrankfurterFxQuote('GBP', 'USD')
    expect(q).not.toBeNull()
    expect(q!.last).toBe(1.34)
    expect(q!.sparkline.length).toBeGreaterThan(1)
    expect(q!.changePct).not.toBe(0)
    expect(q!.source).toBe('frankfurter')
  })

  it('attaches Frankfurter spark when Yahoo fails and exchangerate returns spot', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = urlOf(input as RequestInfo | URL)
      if (url.includes('frankfurter')) {
        return new Response(
          JSON.stringify({
            amount: 1,
            base: 'GBP',
            rates: {
              '2026-07-08': { USD: 1.32 },
              '2026-07-09': { USD: 1.325 },
              '2026-07-10': { USD: 1.33 },
              '2026-07-11': { USD: 1.328 },
              '2026-07-13': { USD: 1.335 },
              '2026-07-14': { USD: 1.338 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('exchangerate-api.com')) {
        return new Response(
          JSON.stringify({ rates: { USD: 1.3401, EUR: 1.17, THB: 44.8 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      // Yahoo proxies / direct — fail or HTML
      if (url.includes('yahoo') || url.includes('corsproxy') || url.includes('allorigins')) {
        return new Response('<html>blocked</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      }
      return new Response('no', { status: 404 })
    })

    const q = await fetchFxPairQuote('GBP', 'USD')
    expect(q).not.toBeNull()
    expect(q!.last).toBeCloseTo(1.3401, 4)
    expect(q!.sparkline.length).toBeGreaterThan(1)
    expect(q!.source).toContain('frankfurter')
  })
})
