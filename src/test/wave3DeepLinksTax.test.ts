import { describe, expect, it } from 'vitest'
import { makeRuleHref } from '../domain/deepLinks'
import { getTaxPack, taxMatchingMethodLabel } from '../domain/taxPacks'

describe('wave 3 deep links and tax labels', () => {
  it('prefills a merchant rule from a spending transaction', () => {
    expect(makeRuleHref({ description: 'ACME & Sons', category: 'Food' })).toBe(
      '/rules?pattern=ACME+%26+Sons&category=food',
    )
  })

  it('labels UK pooling separately from simplified matching', () => {
    expect(taxMatchingMethodLabel(getTaxPack('GB'))).toBe('UK §104 pooling')
    expect(taxMatchingMethodLabel(getTaxPack('US'))).toBe('Simplified FIFO/manual cost')
    expect(taxMatchingMethodLabel(getTaxPack('SG'))).toBe('Record-only disposal journal')
  })
})
