import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { netWorthSparkSeries, netWorthTrendSeries } from '../domain/netWorthSparkline'
import type { HistoryPoint } from '../domain/types'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function day(y: number, m: number, d: number, nw: number): HistoryPoint {
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { date, netWorth: nw }
}

describe('MyDSP 1.2.137 Today trend axes', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.164')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.164')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
      '1.2.160',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.137\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/24H/)
    expect(section).toMatch(/12M/)
    expect(section).toMatch(/5Y/)
    expect(section).toMatch(/DD\/MM|01\/12/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(read('../../ROADMAP.md')).toMatch(/Today trend axes \(v1\.2\.137\)/)
  })

  it('Today chart is full width with X and Y axes', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/TodayTrendChart/)
    expect(dash).not.toMatch(/max-w-xs/)
    expect(dash).toMatch(/NW_SPARK_WINDOWS/)
    expect(dash).toMatch(/today-trend-window/)
    expect(dash).toMatch(/is-active/)
    expect(read('../domain/netWorthSparkline.ts')).toMatch(/'24H'/)
    expect(read('../components/charts/TodayTrendChart.tsx')).toMatch(/today-trend-chart/)
    const chart = read('../components/charts/LabeledTrendChart.tsx')
    expect(chart).toMatch(/<XAxis/)
    expect(chart).toMatch(/<YAxis/)
    expect(chart).toMatch(/formatChartYTick/)
    expect(chart).toMatch(/labeled-trend-chart/)
  })

  it('7D labels are weekdays and 30D labels are DD/MM', () => {
    const now = new Date(2026, 6, 16) // Thu 16 Jul 2026
    const history: HistoryPoint[] = []
    for (let i = 0; i < 40; i++) {
      const d = new Date(2026, 6, 16 - (39 - i))
      history.push(day(d.getFullYear(), d.getMonth() + 1, d.getDate(), 100_000 + i))
    }
    const d7 = netWorthTrendSeries(history, 103_000, '7D', now)
    expect(d7).toHaveLength(7)
    expect(d7.map((p) => p.label)).toEqual(['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'])
    expect(netWorthSparkSeries(history, 103_000, 7, now)).toHaveLength(7)

    const d30 = netWorthTrendSeries(history, 103_000, '30D', now)
    expect(d30).toHaveLength(30)
    expect(d30[0]!.label).toMatch(/^\d{2}\/\d{2}$/)
    expect(d30[d30.length - 1]!.label).toBe('16/07')
  })

  it('24H labels are 24 clock hours ending at the current hour', () => {
    const now = new Date(2026, 6, 16, 15, 30, 0)
    const history: HistoryPoint[] = []
    for (let i = 0; i < 24; i++) {
      const t = new Date(now)
      t.setHours(15 - (23 - i), 0, 0, 0)
      history.push({
        date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
        at: t.toISOString(),
        netWorth: 90_000 + i * 10,
      })
    }
    const h24 = netWorthTrendSeries(history, 99_000, '24H', now)
    expect(h24).toHaveLength(24)
    expect(h24[0]!.label).toMatch(/^\d{2}$/)
    expect(h24[h24.length - 1]!.label).toBe('15')
    expect(h24.map((p) => p.label)).toContain('00')
    expect(h24.map((p) => p.label)).toContain('23')
  })

  it('12M uses MMM and 5Y / ALL use years', () => {
    const now = new Date(2026, 7, 30)
    const history: HistoryPoint[] = []
    for (let y = 2021; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        history.push(day(y, m, 15, 50_000 + y * 10 + m))
      }
    }
    const m12 = netWorthTrendSeries(history, 80_000, '12M', now)
    expect(m12).toHaveLength(12)
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
    const y5 = netWorthTrendSeries(history, 80_000, '5Y', now)
    expect(y5.map((p) => p.label)).toEqual(['2022', '2023', '2024', '2025', '2026'])
    const all = netWorthTrendSeries(history, 80_000, 'ALL', now)
    expect(all[0]!.label).toBe('2021')
    expect(all[all.length - 1]!.label).toBe('2026')
  })
})
