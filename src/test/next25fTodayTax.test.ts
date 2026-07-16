import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWeeklyDigestContent } from '../domain/weeklyDigest'

describe('next25f Today / digest / tax items 16-20', () => {
  it('16: WeeklyDigestModal supports editable highlights before sharing', () => {
    const modal = readFileSync(resolve(__dirname, '../components/WeeklyDigestModal.tsx'), 'utf8')

    expect(modal).toMatch(/weekly-digest-highlights/)
    expect(modal).toMatch(/highlightsText/)
    expect(modal).toMatch(/shareWeeklyDigest\(editedInput\)/)
    expect(modal).toMatch(/copyWeeklyDigestHtml\(editedInput\)/)
    expect(modal).toMatch(/downloadWeeklyDigest\(editedInput\)/)
  })

  it('17: Dashboard auto-highlights budget pulse, cash runway, and FIRE chips when present', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(dashboard).toMatch(/digestHighlights/)
    expect(dashboard).toMatch(/Budget pulse/)
    expect(dashboard).toMatch(/Cash runway/)
    expect(dashboard).toMatch(/FIRE/)
    expect(dashboard).toMatch(/highlights: digestHighlights/)
  })

  it('18: digest privacy mask is passed by Dashboard and masks money output', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dashboard).toMatch(/privacy/)
    expect(dashboard).toMatch(/privacy,\s*\n\s*highlights: digestHighlights/)

    const html = buildWeeklyDigestContent({
      netWorth: 100_000,
      assets: 120_000,
      liabilities: 20_000,
      crypto: 25_000,
      equity: 75_000,
      privacy: true,
    })
    expect(html).toContain('\u2022\u2022\u2022\u2022')
    expect(html).not.toContain('£100,000')
  })

  it('19: low Tax ISA remaining value contributes a Today highlight string when the ISA field exists', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')

    expect(tax).toMatch(/saveIsaRemainingDraft|isaPrefs/)
    expect(tax).toMatch(/Manual remaining ISA allowance/)
    expect(dashboard).toMatch(/ISA_REMAINING_KEY/)
    expect(dashboard).toMatch(/ISA_LOW_REMAINING_THRESHOLD_GBP/)
    expect(dashboard).toMatch(/ISA remaining low/)
  })

  it('20: Today displays a week-to-date spend chip beside budget pulse', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(dashboard).toMatch(/weekToDateSpend/)
    expect(dashboard).toMatch(/today-week-to-date-spend/)
    expect(dashboard).toMatch(/WTD spend/)
    expect(dashboard).toMatch(/to="\/spending"/)
  })
})
