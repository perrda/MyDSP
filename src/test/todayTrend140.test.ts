import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { NW_SPARK_WINDOWS, netWorthTrendSeries } from '../domain/netWorthSparkline'
import { normalizeNwSparkWindow } from '../domain/nwSparkWindowPref'
import type { HistoryPoint } from '../domain/types'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function day(y: number, m: number, d: number, nw: number): HistoryPoint {
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { date, netWorth: nw }
}

function monthlyHistory(fromY: number, toY: number): HistoryPoint[] {
  const history: HistoryPoint[] = []
  for (let y = fromY; y <= toY; y++) {
    for (let m = 1; m <= 12; m++) {
      history.push(day(y, m, 15, 50_000 + y * 10 + m))
    }
  }
  return history
}

describe('MyDSP 1.2.140 Today TREND 6m + YTD', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.152')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.152')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.152',
      '1.2.151',
      '1.2.150',
      '1.2.149',
      '1.2.148',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.140\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/6M/)
    expect(section).toMatch(/YTD/)
    expect(section).toMatch(/30D/)
    expect(section).toMatch(/12M/)
    expect(section).toMatch(/MMM/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.137/)
    expect(section).toMatch(/index-CxpikgZP\.js/)
    expect(read('../../ROADMAP.md')).toMatch(/Today TREND 6m \+ YTD \(v1\.2\.140\)/)
    const shipped = changelog.match(/## \[1\.2\.139\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(shipped).toMatch(/Reset and delete family profiles/)
    expect(shipped).not.toMatch(/Today TREND adds 6m/)
  })

  it('6m and YTD sit between 30D and 12M on Today chips', () => {
    expect(NW_SPARK_WINDOWS).toEqual(['24H', '7D', '30D', '6M', 'YTD', '12M', '5Y', 'ALL'])
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/\{d\}/)
    expect(dash).not.toMatch(/'7d'/)
    expect(dash).not.toMatch(/'30d'/)
    expect(dash).not.toMatch(/'6m'/)
    const spark = read('../domain/netWorthSparkline.ts')
    expect(spark.indexOf("'6M'")).toBeLessThan(spark.indexOf("'YTD'"))
    expect(spark.indexOf("'30D'")).toBeLessThan(spark.indexOf("'6M'"))
    expect(spark.indexOf("'YTD'")).toBeLessThan(spark.indexOf("'12M'"))
    expect(normalizeNwSparkWindow('6m')).toBe('6M')
    expect(normalizeNwSparkWindow('YTD')).toBe('YTD')
    expect(normalizeNwSparkWindow('ytd')).toBe('YTD')
  })

  it('6M labels are the last six months as MMM', () => {
    const now = new Date(2026, 7, 30)
    const m6 = netWorthTrendSeries(monthlyHistory(2025, 2026), 80_000, '6M', now)
    expect(m6).toHaveLength(6)
    expect(m6.map((p) => p.label)).toEqual(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'])
    expect(m6[m6.length - 1]!.value).toBe(80_000)
  })

  it('YTD labels are Jan through the current month as MMM', () => {
    const now = new Date(2026, 7, 30)
    const ytd = netWorthTrendSeries(monthlyHistory(2025, 2026), 80_000, 'YTD', now)
    expect(ytd).toHaveLength(8)
    expect(ytd.map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'])
    expect(ytd[0]!.label).toBe('Jan')
    expect(ytd[ytd.length - 1]!.label).toBe('Aug')
    expect(ytd[ytd.length - 1]!.value).toBe(80_000)
  })

  it('YTD in January uses DD/MM days so the line has points', () => {
    const now = new Date(2026, 0, 15)
    const history: HistoryPoint[] = []
    for (let d = 1; d <= 15; d++) history.push(day(2026, 1, d, 70_000 + d))
    const ytd = netWorthTrendSeries(history, 90_000, 'YTD', now)
    expect(ytd).toHaveLength(15)
    expect(ytd[0]!.label).toBe('01/01')
    expect(ytd[ytd.length - 1]!.label).toBe('15/01')
    expect(ytd[ytd.length - 1]!.value).toBe(90_000)
  })
})
