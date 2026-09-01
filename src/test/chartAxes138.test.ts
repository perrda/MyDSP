import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  formatChartQuoteYTick,
  labeledSeriesFromValues,
  padLabeledSeriesFromValues,
} from '../domain/chartAxis'
import { loadNwSparkWindowPref, normalizeNwSparkWindow } from '../domain/nwSparkWindowPref'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { setDisplayCurrency } from '../utils/format'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.141 chart axes follow display CCY', () => {
  afterEach(() => {
    setDisplayCurrency('GBP', { GBP: 1 })
  })

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
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.141\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/formatChartYTick|display CCY|CCY/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/30D/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/Fetching|sparkline\.length|pad/)
    expect(section).toMatch(/1\.2\.137 \/ `index-CxpikgZP\.js`/)
    expect(read('../../ROADMAP.md')).toMatch(/Chart axes \+ display CCY \(v1\.2\.141\)/)
  })

  it('24H / 7D / 30D / 12M / 5Y labels match Today-style windows', () => {
    const now = new Date(2026, 7, 30, 15, 0, 0)
    const h24 = labeledSeriesFromValues(Array.from({ length: 24 }, (_, i) => 100 + i), '24H', now)
    expect(h24).toHaveLength(24)
    expect(h24[0]!.label).toMatch(/^\d{2}$/)
    expect(h24[h24.length - 1]!.label).toBe('15')
    expect(h24.map((p) => p.label)).toContain('00')
    expect(h24.map((p) => p.label)).toContain('23')

    const d7 = labeledSeriesFromValues([1, 2, 3, 4, 5, 6, 7], '7D', now)
    expect(d7.map((p) => p.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

    const d30 = labeledSeriesFromValues(Array.from({ length: 30 }, (_, i) => i), '1M', now)
    expect(d30[0]!.label).toMatch(/^\d{2}\/\d{2}$/)
    expect(d30[d30.length - 1]!.label).toBe('30/08')

    const m12 = labeledSeriesFromValues(Array.from({ length: 12 }, (_, i) => i), '12M', now)
    expect(m12.map((p) => p.label)).toEqual([
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
    ])

    const y5 = labeledSeriesFromValues([1, 2, 3, 4, 5], '5Y', now)
    expect(y5.map((p) => p.label)).toEqual(['2022', '2023', '2024', '2025', '2026'])
  })

  it('GBP-stored quote Y ticks follow display CCY; FX stays native', () => {
    setDisplayCurrency('USD', { GBP: 1, USD: 1.27, THB: 45, BTC: 0.000012 })
    expect(formatChartQuoteYTick(160_000, 'crypto')).toMatch(/USD|\$|203/)
    expect(formatChartQuoteYTick(1.27, 'fx')).toMatch(/1\.27/)
    expect(formatChartQuoteYTick(1.27, 'fx')).not.toMatch(/USD/)
    setDisplayCurrency('BTC', { GBP: 1, USD: 1.27, THB: 45, BTC: 0.000012 })
    expect(formatChartQuoteYTick(160_000, 'equity')).toMatch(/₿/)
  })

  it('Today TREND defaults to 30D and marks the active window', () => {
    expect(normalizeNwSparkWindow(null)).toBe('30D')
    expect(normalizeNwSparkWindow(undefined)).toBe('30D')
    try {
      localStorage.removeItem('mydsp_nw_spark_window_v1')
    } catch {
      /* node */
    }
    expect(loadNwSparkWindowPref()).toBe('30D')
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-trend-window/)
    expect(dash).toMatch(/is-active/)
    expect(read('../../src/index.css')).toMatch(/\.today-trend-window\.is-active/)
    expect(read('../../src/index.css')).toMatch(/#F7931A/)
  })

  it('full-size charts use labeled X/Y — list-row Sparkline stays compact', () => {
    const markets = read('../pages/MarketsPage.tsx')
    expect(markets).toMatch(/QuoteDetailTrend/)
    expect(markets).toMatch(/LabeledTrendChart/)
    expect(markets).toMatch(/padLabeledSeriesFromValues/)
    expect(markets).toMatch(/<Sparkline/)
    expect(markets).toMatch(/showSpark = Boolean\(q && q\.sparkline\.length > 1\)/)
    expect(markets).not.toMatch(
      /quoteDetail\.quote && quoteDetail\.quote\.sparkline\.length > 1 \?/,
    )
    expect(read('../components/charts/LabeledTrendChart.tsx')).toMatch(/formatChartYTick/)
    expect(read('../components/JobAnalytics.tsx')).toMatch(/formatChartYTick/)
    expect(read('../components/charts/AdvancedCharts.tsx')).toMatch(/formatChartMonthYear/)
    expect(read('../pages/PredictiveAnalyticsPage.tsx')).toMatch(/formatChartMonthYear/)
    expect(read('../pages/PlanningPage.tsx')).toMatch(/formatChartYTick/)
    expect(read('../components/charts/PortfolioSeriesChart.tsx')).toMatch(/formatChartYTick/)
    expect(read('../components/charts/SpendingSeriesChart.tsx')).toMatch(/formatChartYTick/)
    expect(read('../components/charts/HoldingPriceChart.tsx')).toMatch(/formatChartYTick/)
    expect(read('../components/charts/CashflowChart.tsx')).toMatch(/formatChartYTick/)
  })

  it('pads empty / last-good Fetching series so the 176px detail chart can paint', () => {
    const now = new Date(2026, 7, 30, 15, 0, 0)
    const empty = padLabeledSeriesFromValues([], '24H', undefined, now)
    expect(empty.length).toBeGreaterThanOrEqual(2)
    expect(empty.map((p) => p.label)).toContain('00')
    expect(empty.map((p) => p.label)).toContain('15')
    expect(empty.every((p) => p.value === 0)).toBe(true)

    const lastGood = padLabeledSeriesFromValues([], '1W', 64_000, now)
    expect(lastGood).toHaveLength(7)
    expect(lastGood.every((p) => p.value === 64_000)).toBe(true)
    expect(lastGood.map((p) => p.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

    const single = padLabeledSeriesFromValues([99], 'ALL', undefined, now)
    expect(single.length).toBeGreaterThanOrEqual(2)
    expect(single.every((p) => p.value === 99)).toBe(true)

    const live = padLabeledSeriesFromValues([10, 11, 12], '1M', 12, now)
    expect(live).toHaveLength(3)
    expect(live.map((p) => p.value)).toEqual([10, 11, 12])
  })
})
