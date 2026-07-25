import { describe, expect, it } from 'vitest'
import {
  coerceJobTitleAndUrl,
  formatJobSalary,
  jobPostingHost,
  looksLikeUrl,
} from '../domain/jobDisplay'

describe('jobDisplay helpers', () => {
  it('detects pasted posting URLs', () => {
    expect(looksLikeUrl('https://www.linkedin.com/jobs/view/123')).toBe(true)
    expect(looksLikeUrl('linkedin.com/jobs/view/123')).toBe(true)
    expect(looksLikeUrl('Senior Engineer')).toBe(false)
  })

  it('coerces URL-as-title into jobUrl and readable title', () => {
    const out = coerceJobTitleAndUrl({
      companyName: 'ByBit',
      jobTitle: 'https://www.linkedin.com/jobs/view/123',
      jobUrl: undefined,
    })
    expect(out.jobUrl).toBe('https://www.linkedin.com/jobs/view/123')
    expect(out.jobTitle).toBe('Role at ByBit')
  })

  it('extracts muted host for secondary URL line', () => {
    expect(jobPostingHost('https://www.linkedin.com/jobs/view/123')).toBe('linkedin.com')
  })

  it('formats salary without duplicated currency codes', () => {
    expect(
      formatJobSalary({
        salaryMin: 90000,
        salaryMax: 110000,
        salaryCurrency: 'GBP',
        salaryPeriod: 'annual',
      }),
    ).toBe('£90,000 – £110,000 / year')

    expect(
      formatJobSalary({
        salaryMin: 2,
        salaryMax: undefined,
        salaryCurrency: 'GBP',
        salaryPeriod: 'annual',
      }),
    ).toBe('from £2 / year')
  })
})
