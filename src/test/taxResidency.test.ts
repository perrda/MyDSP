import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { normalizeTaxResidency } from '../domain/normalize'
import {
  calcTaxSummaryForPack,
  getCurrentPackYear,
  getTaxPack,
  listPackYears,
  matchDisposalsSimple,
} from '../domain/taxPacks'

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

describe('tax jurisdiction packs', () => {
  it('returns UK pack with Apr–Apr year and §104 matching', () => {
    const pack = getTaxPack('GB')
    expect(pack.matching).toBe('uk-section104')
    expect(pack.yearKind).toBe('uk-apr')
    expect(pack.exportLabel).toMatch(/UK/)
    expect(getCurrentPackYear(pack, new Date('2026-07-15'))).toBe('2026/27')
    expect(listPackYears(pack)[0]).toMatch(/^\d{4}\/\d{2}$/)
  })

  it('uses calendar years and simplified rate for US', () => {
    const pack = getTaxPack('US')
    expect(pack.yearKind).toBe('calendar')
    expect(pack.rate).toBe(0.15)
    expect(pack.exportLabel).toMatch(/not Form 8949/)
    expect(getCurrentPackYear(pack, new Date('2026-07-15'))).toBe('2026')
    const matched = matchDisposalsSimple(
      [
        {
          id: 1,
          date: '2026-03-01',
          assetType: 'equity',
          symbol: 'AAPL',
          qty: 1,
          proceeds: 1000,
          cost: 400,
        },
      ],
      pack,
      '2026',
    )
    const summary = calcTaxSummaryForPack(matched, '2026', pack)
    expect(summary.netGain).toBe(600)
    expect(summary.cgtDue).toBeCloseTo(90)
  })

  it('SG / TH packs have no CGT due', () => {
    const sg = getTaxPack('SG')
    expect(sg.hasCgt).toBe(false)
    const summary = calcTaxSummaryForPack(
      [{ gain: 500, disposal: { id: 1, date: '2026-01-01', assetType: 'crypto', symbol: 'BTC', qty: 1, proceeds: 1000, cost: 500 } }],
      '2026',
      sg,
    )
    expect(summary.cgtDue).toBe(0)
    expect(summary.taxableGain).toBe(0)
  })
})
