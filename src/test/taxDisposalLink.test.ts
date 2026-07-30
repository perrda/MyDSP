import { describe, expect, it } from 'vitest'
import { buildTaxDisposalHref } from '../domain/taxDisposalLink'

describe('buildTaxDisposalHref', () => {
  it('builds an encoded Tax disposal prefill URL', () => {
    const href = buildTaxDisposalHref({
      assetType: 'equity',
      symbol: 'BRK B',
      date: '2026-07-30',
      qty: 2.5,
      proceeds: 1000,
      cost: 750,
    })

    expect(href).toBe(
      '/tax?assetType=equity&symbol=BRK+B&date=2026-07-30&qty=2.5&proceeds=1000&cost=750',
    )
  })

  it('does not prefill negative proceeds or cost', () => {
    const href = buildTaxDisposalHref({
      assetType: 'crypto',
      symbol: 'BTC',
      date: '2026-07-30',
      qty: 0.01,
      proceeds: -1,
      cost: -2,
    })

    expect(href).toContain('proceeds=0&cost=0')
  })
})
