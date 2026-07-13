import { describe, expect, it } from 'vitest'
import { titleCaseHeader, titleCaseWord } from '../components/ui/PageHeader'

describe('page header title case', () => {
  it('capitalises orange accent words', () => {
    expect(titleCaseHeader('Compare portfolios')).toBe('Compare Portfolios')
    expect(titleCaseHeader('Financial overview')).toBe('Financial Overview')
    expect(titleCaseHeader('Trips & splits')).toBe('Trips & Splits')
    expect(titleCaseHeader('Settings & data')).toBe('Settings & Data')
    expect(titleCaseHeader('FIRE calculator')).toBe('FIRE Calculator')
  })

  it('capitalises a single-word title', () => {
    expect(titleCaseWord('family')).toBe('Family')
    expect(titleCaseHeader('Family')).toBe('Family')
  })
})
