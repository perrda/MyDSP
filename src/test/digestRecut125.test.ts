import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  BTC_ORANGE,
  dedupeHighlightLines,
  digestDeltaLabel,
  digestHtmlFilename,
  digestNwSeries,
  digestPdfFilename,
  digestTitle,
  periodDeltaFromHistory,
  spendInDigestWindow,
} from '../domain/digestPeriod'
import { buildDigestPdfBytes } from '../domain/digestPdf'
import {
  buildDigestViewModel,
  buildWeeklyDigestContent,
  buildWeeklyDigestHtml,
  weekDeltaFromHistory,
} from '../domain/weeklyDigest'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

const sample = {
  netWorth: 9810.43,
  assets: 13310.43,
  liabilities: 3500,
  crypto: 6310.43,
  equity: 7000,
}

describe('MyDSP 1.2.125 digest recut', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.150')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.150')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.150',
      '1.2.149',
      '1.2.148',
      '1.2.147',
      '1.2.146',
    ])
    const digestTip = RELEASE_NOTES.find((e) => e.version === '1.2.125')
    expect(digestTip?.bullets.map((b) => (typeof b === 'string' ? b : b.text)).join(' ')).toMatch(
      /Daily|PDF|1\.2\.121/,
    )
  })

  it('period switcher is Daily / Weekly / Monthly / Quarterly / Annual', () => {
    const modal = read('../components/WeeklyDigestModal.tsx')
    const period = read('../domain/digestPeriod.ts')
    expect(modal).toMatch(/DIGEST_PERIODS/)
    expect(period).toMatch(/daily.*weekly.*monthly.*quarterly.*annual/)
    expect(period).toMatch(/Daily/)
    expect(period).toMatch(/Weekly/)
    expect(period).toMatch(/Monthly/)
    expect(period).toMatch(/Quarterly/)
    expect(period).toMatch(/Annual/)
    expect(digestTitle('daily')).toBe('MyDSP daily digest')
    expect(digestDeltaLabel('daily')).toBe('24h Δ')
    expect(digestDeltaLabel('weekly')).toBe('Week Δ')
    expect(digestDeltaLabel('monthly')).toBe('Month Δ')
    expect(digestDeltaLabel('quarterly')).toBe('Quarter Δ')
    expect(digestDeltaLabel('annual')).toBe('Year Δ')
  })

  it('Daily is rolling 24h and never prints Week Δ', () => {
    const now = new Date(2026, 7, 29, 18, 17, 23)
    const older = new Date(2026, 7, 28, 17, 0, 0)
    const intra = new Date(2026, 7, 29, 10, 0, 0)
    const html = buildWeeklyDigestContent(
      {
        ...sample,
        title: 'MyDSP weekly digest',
        history: [
          { date: '2026-08-28', at: older.toISOString(), netWorth: 9000 },
          { date: '2026-08-29', at: intra.toISOString(), netWorth: 9700 },
        ],
        generatedAt: now,
      },
      'daily',
    )
    expect(html).toMatch(/daily digest/i)
    expect(html).toMatch(/24h Δ|24h change|Rolling last 24 hours/)
    expect(html).not.toMatch(/Week Δ/)
    expect(html).not.toMatch(/Week change/)
    expect(html).not.toMatch(/0\.00%/)

    const noBaseline = periodDeltaFromHistory(
      [{ date: '2026-08-29', at: intra.toISOString(), netWorth: 9700 }],
      9810.43,
      'daily',
      now,
    )
    expect(noBaseline).toBeNull()

    const withBaseline = periodDeltaFromHistory(
      [{ date: '2026-08-28', at: older.toISOString(), netWorth: 9000 }],
      9810.43,
      'daily',
      now,
    )
    expect(withBaseline).toBeCloseTo(810.43)
  })

  it('missing series stays an em dash — never invents points or fake 0.00%', () => {
    const now = new Date('2026-08-29T18:17:23')
    const model = buildDigestViewModel(
      { ...sample, history: [], weekDelta: 1250 },
      'annual',
      now,
    )
    expect(model.deltaValue).toBe('—')
    expect(model.seriesEmpty).toBe(true)
    expect(model.series).toEqual([])
    expect(digestNwSeries([], 9810.43, 'monthly', now)).toEqual([])
    expect(model.deltaLabel).toBe('Year Δ')
    expect(model.deltaLabel).not.toBe('Week Δ')

    const weeklyLegacy = buildDigestViewModel({ ...sample, weekDelta: 1250 }, 'weekly', now)
    expect(weeklyLegacy.deltaValue).toMatch(/\+/)
    expect(weeklyLegacy.deltaLabel).toBe('Week Δ')
  })

  it('de-dupes Top mover + Commodity mover for the same symbol', () => {
    expect(
      dedupeHighlightLines([
        '1 To Do due today',
        'Top mover SI=F (commodity) -2.5%',
        'Commodity mover SI=F -2.5%',
        'Cash runway 0.6 mo',
      ]),
    ).toEqual(['1 To Do due today', 'Top mover SI=F (commodity) -2.5%', 'Cash runway 0.6 mo'])

    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/commodity\.symbol !== top\?\.symbol/)
  })

  it('A4 PDF landscape + portrait include period/date filename and real bytes', () => {
    const generatedAt = new Date('2026-08-29T18:17:23Z')
    const model = buildDigestViewModel(
      {
        ...sample,
        history: [
          { date: '2026-08-01', netWorth: 8000 },
          { date: '2026-08-22', netWorth: 9200 },
        ],
        highlights: ['1 To Do due today'],
        generatedAt,
      },
      'monthly',
      generatedAt,
    )
    const land = buildDigestPdfBytes(model, 'landscape')
    const port = buildDigestPdfBytes(model, 'portrait')
    const landText = new TextDecoder('latin1').decode(land)
    const portText = new TextDecoder('latin1').decode(port)
    expect(landText.startsWith('%PDF-1.4')).toBe(true)
    expect(portText.startsWith('%PDF-1.4')).toBe(true)
    expect(landText).toMatch(/MediaBox \[0 0 841\.89 595\.28\]/)
    expect(portText).toMatch(/MediaBox \[0 0 595\.28 841\.89\]/)
    expect(landText).toContain(String.fromCharCode(0xa3))
    expect(digestPdfFilename('monthly', 'landscape', generatedAt)).toBe(
      'mydsp-monthly-digest-landscape-2026-08-29.pdf',
    )
    expect(digestHtmlFilename('daily', generatedAt)).toBe('mydsp-daily-digest-2026-08-29.html')
    expect(landText).toMatch(/MONTH CHANGE/)
    expect(landText).not.toMatch(/MONTH D/)
    expect(read('../domain/digestPdf.ts')).not.toMatch(/'Δ':\s*0x44/)

    const daily = buildDigestPdfBytes(
      buildDigestViewModel({ ...sample, generatedAt }, 'daily', generatedAt),
      'landscape',
    )
    const dailyText = new TextDecoder('latin1').decode(daily)
    expect(dailyText).toMatch(/24H CHANGE/)
    expect(dailyText).not.toMatch(/24H D/)
    expect(dailyText).not.toMatch(/WEEK D/)
  })

  it('HTML share/copy keeps Share path and no-email copy; weekly default still works', () => {
    const content = buildWeeklyDigestContent({
      ...sample,
      weekDelta: 1250,
      portfolios: [{ name: 'David', netWorth: 8000 }],
      highlights: ['3 todos due'],
      generatedAt: new Date('2026-07-16T12:00:00Z'),
    })
    expect(content).toMatch(/weekly digest/i)
    expect(content).toMatch(/Net worth/)
    expect(content).toMatch(/Week Δ/)
    expect(content).toMatch(/David/)
    expect(content).toMatch(/no email is sent/i)
    expect(content).toMatch(/digest-kpis|Allocation/)
    expect(buildWeeklyDigestHtml({ ...sample })).toMatch(/<!DOCTYPE html>/i)

    expect(
      weekDeltaFromHistory(
        [
          { date: '2026-07-01', netWorth: 90_000 },
          { date: '2026-07-09', netWorth: 95_000 },
          { date: '2026-07-16', netWorth: 100_000 },
        ],
        100_000,
        new Date('2026-07-16T12:00:00'),
      ),
    ).toBe(5_000)
  })

  it('spend highlight follows the selected window', () => {
    const now = new Date('2026-08-29T18:00:00')
    const spending = [
      { date: '2026-08-29', amount: 12, category: 'food' },
      { date: '2026-08-23', amount: 40, category: 'food' },
      { date: '2026-06-01', amount: 400, category: 'food' },
    ]
    expect(spendInDigestWindow(spending, 'daily', now)).toBe(12)
    expect(spendInDigestWindow(spending, 'weekly', now)).toBe(52)
    expect(spendInDigestWindow(spending, 'annual', now)).toBe(452)
    const daily = buildDigestViewModel({ ...sample, spending, highlights: [] }, 'daily', now)
    expect(daily.highlights.join(' ')).toMatch(/Spend \(24h\)/)
    expect(daily.highlights.join(' ')).not.toMatch(/Week-to-date/)
  })

  it('modal keeps Share / Copy HTML / Download and sticky period + PDF controls', () => {
    const modal = read('../components/WeeklyDigestModal.tsx')
    expect(modal).toMatch(/shareWeeklyDigest\(editedInput\)/)
    expect(modal).toMatch(/copyWeeklyDigestHtml\(editedInput\)/)
    expect(modal).toMatch(/downloadWeeklyDigest\(editedInput\)/)
    expect(modal).toMatch(/downloadWeeklyDigestPdf/)
    expect(modal).toMatch(/digest-sticky-controls/)
    expect(modal).toMatch(/Download PDF/)
    expect(modal).toMatch(/Nothing is emailed automatically/)
    expect(modal).not.toMatch(/thumb-cta-bar/)
  })

  it('Light/Dark digest accents lock to #F7931A — no muted brown, negative stays red', () => {
    const css = read('../index.css')
    expect(css).toMatch(/1\.2\.125 digest recut/)
    expect(css).toMatch(/#F7931A/)
    const digestCss = css.slice(css.indexOf('1.2.125 digest recut'))
    expect(digestCss).toMatch(/#F7931A/)
    expect(digestCss).toMatch(/#ef4444/)
    expect(digestCss).not.toMatch(/#91591D|#A26A2F|#9a5500|#7a4200/i)
    expect(BTC_ORANGE).toBe('#F7931A')
  })

  it('logo tile + Debt chrome lock to #F7931A; leftover brown hex is gone', () => {
    const css = read('../index.css')
    expect(css).toMatch(/\.brand-mark[\s\S]*?background:\s*#F7931A/)
    expect(css).toMatch(/html\.light \.brand-mark[\s\S]*?background:\s*#F7931A/)
    expect(css).toMatch(/\.btn-primary[\s\S]*?background-color:\s*#F7931A/)
    expect(css).toMatch(/\.chart-range-btn\.is-active[\s\S]*?background:\s*#F7931A/)
    expect(css).toMatch(/\.eyebrow[\s\S]*?color:\s*#F7931A/)
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutComments).not.toMatch(/#91591D|#A26A2F|#8c5d2e|#9a5500|#7a4200|#c47210|#d97706/i)
    const debt = read('../pages/LiabilitiesPage.tsx')
    expect(debt).toMatch(/btn-primary/)
    expect(debt).toMatch(/Mark paid/)
    expect(debt).toMatch(/text-accent/)
    const chart = read('../components/charts/PortfolioSeriesChart.tsx')
    expect(chart).toMatch(/text-red-500/)
    expect(chart).toMatch(/text-accent/)
  })

  it('does not delete Money pages or the four-door fold', () => {
    expect(read('../pages/MoneyPage.tsx')).toMatch(/Money/)
    expect(read('../domain/hubPages.ts')).toMatch(/MONEY_DOORS/)
    expect(read('../pages/LiabilitiesPage.tsx')).toMatch(/Liabilit/)
    expect(read('../pages/CashflowPage.tsx')).toMatch(/Cashflow/)
  })
})
