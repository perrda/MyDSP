import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHONE_MEDIA_NAV, PRIMARY_NAV, SIDEBAR_NAV } from '../domain/primaryNav'
import { resolveBottomNavItems } from '../domain/bottomNav'
import { MONEY_DIRECTORY } from '../domain/hubPages'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  loadTodayLayout,
  TODAY_LAYOUT_CARD_OPTIONS,
  TODAY_LAYOUT_PRESETS,
} from '../storage/todayLayoutStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.132 Today layout + left-nav order', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.157')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.157')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.157',
      '1.2.156',
      '1.2.155',
      '1.2.154',
      '1.2.153',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.132\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Weekly [Dd]igest/)
    expect(section).toMatch(/Cloud Sync/)
    expect(section).toMatch(/Settings/)
    expect(section).toMatch(/below YouTube|after YouTube/)
    expect(section).toMatch(/Markets/)
    expect(section).toMatch(/full width|one column/)
    expect(section).toMatch(/Today hero/)
    expect(section).toMatch(/Assets/)
    expect(section).toMatch(/SIPP/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.131/)
    expect(section).toMatch(/index-oymrpnal\.js/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
  })

  it('desktop rail MENU stays Today → YouTube; utilities sit after YouTube', () => {
    expect(SIDEBAR_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
      'News',
      'YouTube',
    ])
    const sidebar = read('../components/layout/Sidebar.tsx')
    const menuLabel = sidebar.indexOf('Menu')
    const youtubeUnread = sidebar.indexOf('sidebar-youtube-unread')
    const digest = sidebar.indexOf('Weekly digest')
    const sync = sidebar.indexOf('Cloud Sync')
    const settingsLink = sidebar.lastIndexOf('to="/settings"')
    expect(menuLabel).toBeGreaterThan(-1)
    expect(youtubeUnread).toBeGreaterThan(menuLabel)
    expect(digest).toBeGreaterThan(youtubeUnread)
    expect(sync).toBeGreaterThan(digest)
    expect(settingsLink).toBeGreaterThan(sync)
    expect(sidebar).toMatch(/to="\/settings#sync"/)
    expect(sidebar).toMatch(/to="\/settings"/)
    expect(sidebar).toMatch(/mydsp-open-weekly-digest|\/\?digest=1/)
    expect(sidebar).not.toMatch(/nav-others-toggle/)
  })

  it('phone keeps five doors + News/YouTube cluster; utilities stay off the bottom bar', () => {
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
    ])
    expect(resolveBottomNavItems().map((i) => i.to)).toEqual([
      '/',
      '/markets',
      '/money',
      '/plan',
      '/household',
    ])
    expect(PHONE_MEDIA_NAV.map((i) => i.to)).toEqual(['/news', '/youtube'])
    const nav = read('../components/layout/BottomNav.tsx')
    expect(nav).toMatch(/PHONE_MEDIA_NAV/)
    expect(nav).toMatch(/bottom-nav-media/)
    expect(nav).not.toMatch(/Weekly digest/)
    expect(nav).not.toMatch(/Cloud Sync/)
    expect(nav).not.toMatch(/to="\/settings/)
  })

  it('Today has no Markets aside; main cards are one full-width column', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-main-column/)
    expect(dash).toMatch(/today-main-column w-full min-w-0/)
    expect(dash).not.toMatch(/today-two-pane/)
    expect(dash).not.toMatch(/today-markets-pane/)
    expect(dash).not.toMatch(/today-section-jump-markets/)
    expect(dash).not.toMatch(/Markets snapshot/)
    expect(dash).not.toMatch(/grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,20rem\)\]/)
    expect(dash).toMatch(/today-net-worth-value/)
    expect(dash).toMatch(/today-section-jump-next/)
    expect(dash).toMatch(/today-section-jump-media/)
    const marketsPage = read('../pages/MarketsPage.tsx')
    expect(marketsPage.length).toBeGreaterThan(100)
    expect(SIDEBAR_NAV.some((i) => i.to === '/markets')).toBe(true)
  })

  it('Customize options do not include a markets card id', () => {
    expect(TODAY_LAYOUT_CARD_OPTIONS.map((o) => o.id)).not.toContain('markets')
    expect(TODAY_LAYOUT_CARD_OPTIONS.some((o) => o.label === 'Markets')).toBe(false)
    expect(TODAY_LAYOUT_PRESETS.work.hidden).not.toContain('markets')
    expect(TODAY_LAYOUT_PRESETS.quiet.hidden).not.toContain('markets')
    expect(TODAY_LAYOUT_PRESETS.money.hidden).not.toContain('markets')
    const store = read('../storage/todayLayoutStore.ts')
    expect(store).not.toMatch(/id: 'markets'/)
    expect(store).not.toMatch(/label: 'Markets'/)
    expect(store).not.toMatch(/'markets'/)
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/TODAY_LAYOUT_CARD_OPTIONS/)
    expect(dash).not.toMatch(/id: 'markets'/)
    expect(dash).not.toMatch(/today-markets/)
    localStorage.setItem(
      'mydsp.today.layout.v1',
      JSON.stringify({
        order: ['next'],
        hidden: ['markets', 'charts'],
        updatedAt: '2026-08-30T00:00:00.000Z',
      }),
    )
    const layout = loadTodayLayout()
    expect(layout.hidden).not.toContain('markets')
    expect(layout.hidden).toContain('charts')
  })

  it('Today hero shows Assets as the big figure and four book rows', () => {
    const dash = read('../pages/Dashboard.tsx')
    const label = dash.indexOf('>Assets</')
    const assetsValue = dash.indexOf('today-hero-assets-value')
    const pulse = dash.indexOf('today-money-pulse')
    const spark = dash.indexOf('today-nw-sparkline')
    const rows = dash.indexOf('today-hero-book-rows')
    expect(label).toBeGreaterThan(-1)
    expect(assetsValue).toBeGreaterThan(label)
    expect(dash).toMatch(/formatGBP\(assets\)/)
    expect(dash).toMatch(/today-money-pulse/)
    expect(dash).toMatch(/formatMoneyPulseLine/)
    expect(pulse).toBeGreaterThan(assetsValue)
    expect(spark).toBeGreaterThan(pulse)
    expect(rows).toBeGreaterThan(spark)
    expect(dash).toMatch(/today-hero-row-net-worth/)
    expect(dash).toMatch(/today-hero-row-crypto/)
    expect(dash).toMatch(/today-hero-row-sipp/)
    expect(dash).toMatch(/today-hero-row-liabilities/)
    expect(dash).toMatch(/Crypto Assets/)
    expect(dash).toMatch(/>SIPP</)
    expect(dash).not.toMatch(/Assets \{formatGBP\(assets\)\} · Liabilities/)
    expect(dash).toMatch(/today-cash-runway/)
    expect(dash).not.toMatch(/today-markets-pane/)
  })

  it('hero crypto / SIPP / liabilities rows use existing Money-tile routes', () => {
    const dash = read('../pages/Dashboard.tsx')
    const around = (id: string) => {
      const i = dash.indexOf(id)
      expect(i).toBeGreaterThan(-1)
      return dash.slice(Math.max(0, i - 80), i + 80)
    }
    expect(around('today-hero-row-crypto')).toMatch(/to="\/crypto"/)
    expect(around('today-hero-row-sipp')).toMatch(/to="\/equities"/)
    expect(around('today-hero-row-liabilities')).toMatch(/to="\/liabilities"/)
    expect(around('today-hero-row-net-worth')).toMatch(/to="\/money"/)
    expect(MONEY_DIRECTORY.some((d) => d.to === '/crypto' && d.label === 'Crypto')).toBe(true)
    expect(MONEY_DIRECTORY.some((d) => d.to === '/equities' && d.label === 'Equities')).toBe(true)
    expect(MONEY_DIRECTORY.some((d) => d.to === '/liabilities' && d.label === 'Liabilities')).toBe(
      true,
    )
    const app = read('../App.tsx')
    expect(app).toMatch(/path="crypto"/)
    expect(app).toMatch(/path="equities"/)
    expect(app).toMatch(/path="liabilities"/)
    expect(app).not.toMatch(/path="sipp"/)
    expect(dash).toMatch(/calcSipp/)
    const calc = read('../domain/calc.ts')
    expect(calc).toMatch(/export function calcSipp/)
    expect(calc).toMatch(/return calcEquity\(data\)\.value/)
    expect(calc).not.toMatch(/if \(e\.accountType !== 'sipp'\) continue/)
  })

  it('does not change Mini-as-book sync, orange lock, header Refresh, or 1.2.131 ping-all', () => {
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/origin-lock|ORIGIN|allowlist|thisDeviceIsTheBook|applyRemoteAsBook/)
    const book = read('../services/sync/localBook.ts')
    expect(book).toMatch(/thisDeviceIsTheBook|localBookIsSourceOfTruth/)
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/applyRemoteAsBook|runOneButtonSync/)
    const toolbar = read('../components/layout/ToolbarControls.tsx')
    expect(toolbar).toMatch(/toolbar-refresh/)
    expect(toolbar).not.toMatch(/MediaChromeChips/)
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/pingAllMarketsProviders/)
    const css = read('../index.css')
    expect(css).toMatch(/#F7931A/)
  })
})
