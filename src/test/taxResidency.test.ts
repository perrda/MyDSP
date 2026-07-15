import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { normalizeTaxResidency } from '../domain/normalize'

describe('tax residency defaults', () => {
  it('defaults empty and sample portfolios to GB', () => {
    expect(createEmptyPortfolio().settings.taxResidency).toBe('GB')
    expect(createSamplePortfolio().settings.taxResidency).toBe('GB')
  })

  it('normalizes residency codes', () => {
    expect(normalizeTaxResidency('gb')).toBe('GB')
    expect(normalizeTaxResidency('US')).toBe('US')
    expect(normalizeTaxResidency('')).toBe('GB')
  })
})
