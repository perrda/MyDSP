import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.134 SIPP = Equities sleeve', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.159')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.159')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.159',
      '1.2.158',
      '1.2.157',
      '1.2.156',
      '1.2.155',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.134\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/SIPP = Equities/)
    expect(section).toMatch(/TSLA/)
    expect(section).toMatch(/calcEquity/)
    expect(section).toMatch(/accountType === 'sipp'/)
    expect(section).toMatch(/Liabilities in red/)
    expect(section).toMatch(/Money \/ Plan \/ Household grab/)
    expect(section).toMatch(/Hourly manual backup/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.132/)
    expect(section).toMatch(/index-ClzYneLT\.js/)
    expect(section).toMatch(/cursor-.*-mydsp/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/SIPP = Equities \(v1\.2\.134\)/)
  })

  it('SIPP line equals the priced Equities sleeve', () => {
    const calc = read('../domain/calc.ts')
    expect(calc).toMatch(/SIPP line = the equity sleeve/)
    expect(calc).toMatch(/return calcEquity\(data\)\.value/)
    expect(calc).toMatch(/case 'sipp':/)
    expect(calc).not.toMatch(/if \(e\.accountType !== 'sipp'\) continue/)
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/calcSipp\(data\)/)
    expect(dash).toMatch(/>SIPP</)
    expect(dash).toMatch(/today-hero-row-sipp/)
    expect(dash).toMatch(/to="\/equities"/)
    expect(read('../App.tsx')).not.toMatch(/path="sipp"/)
  })

  it('Liabilities line and figure are red', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-hero-book-row--liabilities/)
    expect(dash).toMatch(/today-hero-row-liabilities/)
    const css = read('../index.css')
    expect(css).toMatch(/\.today-hero-book-row--liabilities[\s\S]{0,160}#ef4444/)
    expect(css).toMatch(/\.digest-kpi--liabilities[\s\S]{0,80}#ef4444/)
    expect(read('../components/WeeklyDigestModal.tsx')).toMatch(/digest-kpi--liabilities/)
    expect(read('../pages/LiabilitiesPage.tsx')).toMatch(/text-red-500/)
    expect(read('../pages/AnalyticsPage.tsx')).toMatch(/text-red-500/)
  })

  it('does not change Mini-as-book sync, Today one-column, or orange lock', () => {
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/origin-lock|ORIGIN|allowlist|thisDeviceIsTheBook|applyRemoteAsBook/)
    const book = read('../services/sync/localBook.ts')
    expect(book).toMatch(/thisDeviceIsTheBook|localBookIsSourceOfTruth/)
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/applyRemoteAsBook|runOneButtonSync/)
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-main-column/)
    expect(dash).toMatch(/today-hero-assets-value/)
    expect(dash).not.toMatch(/today-markets-pane/)
    const css = read('../index.css')
    expect(css).toMatch(/#F7931A/)
  })
})
