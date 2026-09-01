import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.133 fluid-fit', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.155')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.155')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.155',
      '1.2.154',
      '1.2.153',
      '1.2.152',
      '1.2.151',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.133\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/[Ff]luid-fit/)
    expect(section).toMatch(/VALUE/)
    expect(section).toMatch(/container-query|minmax\(0/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.132/)
    expect(section).toMatch(/index-ClzYneLT\.js/)
    expect(section).toMatch(/cursor-.*-mydsp/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
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
    const sidebar = read('../components/layout/Sidebar.tsx')
    const youtubeUnread = sidebar.indexOf('sidebar-youtube-unread')
    const digest = sidebar.indexOf('Weekly digest')
    expect(digest).toBeGreaterThan(youtubeUnread)
    const css = read('../index.css')
    expect(css).toMatch(/#F7931A/)
    expect(css).not.toMatch(/overflow:\s*hidden[\s\S]{0,80}markets-section-sticky/)
  })

  it('holding detail four-up uses fluid-metric grid + figures', () => {
    const page = read('../pages/HoldingDetailPage.tsx')
    expect(page).toMatch(/fluid-metric-grid fluid-metric-grid--4/)
    expect(page).toMatch(/data-testid="holding-metric-grid"/)
    expect(page).toMatch(/fluid-figure/)
    expect(page).toMatch(/holding-price-strip fluid-metric/)
    expect(page).toMatch(/holding-markets-sparkline min-w-0/)
    expect(page).not.toMatch(/grid grid-cols-2 lg:grid-cols-4 gap-px mb-6/)
  })

  it('shared CSS scales figures inside the box — no clip, no unreadably truncated money', () => {
    const css = read('../index.css')
    expect(css).toMatch(/1\.2\.133 fluid-fit/)
    expect(css).toMatch(/\.fluid-metric-grid/)
    expect(css).toMatch(/minmax\(0,\s*1fr\)/)
    expect(css).toMatch(/container-type:\s*inline-size/)
    expect(css).toMatch(/@container fluid-metric/)
    expect(css).toMatch(/\.fluid-figure/)
    expect(css).toMatch(/overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.chart-range-scroll[\s\S]*flex-wrap:\s*wrap/)
    expect(css).toMatch(/\.holdings-list-row__metrics p[\s\S]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.sparkline-draw-on/)
    expect(css).toMatch(/max-width:\s*100%/)
    expect(css).not.toMatch(/\.fluid-metric-grid[\s\S]{0,200}overflow:\s*hidden/)
  })

  it('Money StatCards, Equities/Crypto/Liabilities KPIs, and Markets last use fluid-figure', () => {
    expect(read('../components/ui/PageHeader.tsx')).toMatch(/fluid-figure/)
    expect(read('../pages/EquitiesPage.tsx')).toMatch(/fluid-metric-grid--3/)
    expect(read('../pages/CryptoPage.tsx')).toMatch(/fluid-metric-grid--3/)
    expect(read('../pages/LiabilitiesPage.tsx')).toMatch(/fluid-metric-grid--4/)
    expect(read('../pages/LiabilityDetailPage.tsx')).toMatch(/fluid-metric-grid--4/)
    expect(read('../pages/FirePage.tsx')).toMatch(/fluid-metric-grid--4/)
    expect(read('../pages/BudgetsPage.tsx')).toMatch(/fluid-metric-grid--4/)
    expect(read('../pages/TaxPage.tsx')).toMatch(/fluid-metric-grid--4/)
    expect(read('../pages/OptimizerPage.tsx')).toMatch(/fluid-metric-grid--4/)
    expect(read('../pages/MarketsPage.tsx')).toMatch(/fluid-figure/)
    expect(read('../pages/Dashboard.tsx')).toMatch(/fluid-figure/)
    expect(read('../components/charts/HoldingPriceChart.tsx')).toMatch(/fluid-figure/)
  })
})
