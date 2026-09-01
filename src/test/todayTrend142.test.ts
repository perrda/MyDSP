import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { NW_SPARK_WINDOWS } from '../domain/netWorthSparkline'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.144 Today TREND capital chips', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.149')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.149')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.149',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.144\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/24H/)
    expect(section).toMatch(/7D/)
    expect(section).toMatch(/30D/)
    expect(section).toMatch(/6M/)
    expect(section).toMatch(/YTD/)
    expect(section).toMatch(/12M/)
    expect(section).toMatch(/5Y/)
    expect(section).toMatch(/ALL/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.143/)
    expect(section).toMatch(/1\.2\.141/)
    expect(section).toMatch(/index-DGB5GGns\.js/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Today TREND chip capitals \(v1\.2\.144\)/)
    expect(changelog).toMatch(/## \[1\.2\.143\]/)
    expect(changelog).toMatch(/3,000 ADA/)
    const shipped = changelog.match(/## \[1\.2\.143\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(shipped).toMatch(/Family TSLA/)
    expect(shipped).not.toMatch(/capital window labels/)
  })

  it('Today chips render the eight capital window ids', () => {
    expect(NW_SPARK_WINDOWS).toEqual(['24H', '7D', '30D', '6M', 'YTD', '12M', '5Y', 'ALL'])
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-trend-window/)
    expect(dash).toMatch(/\{d\}/)
    expect(dash).not.toMatch(/'7d'/)
    expect(dash).not.toMatch(/'30d'/)
    expect(dash).not.toMatch(/'6m'/)
    expect(dash).not.toMatch(/\? '7d'/)
    expect(dash).not.toMatch(/\? '30d'/)
    expect(dash).not.toMatch(/\? '6m'/)
  })
})
