import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRIMARY_NAV, SIDEBAR_NAV } from '../domain/primaryNav'
import { resolveBottomNavItems } from '../domain/bottomNav'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.129 nav + header chrome', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.158')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.158')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.158',
      '1.2.157',
      '1.2.156',
      '1.2.155',
      '1.2.154',
    ])
  })

  it('sidebar MENU is Today · Markets · Money · Plan · Household · News · YouTube', () => {
    expect(SIDEBAR_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
      'News',
      'YouTube',
    ])
    expect(SIDEBAR_NAV.map((i) => i.to)).toEqual([
      '/',
      '/markets',
      '/money',
      '/plan',
      '/household',
      '/news',
      '/youtube',
    ])
    const sidebar = read('../components/layout/Sidebar.tsx')
    expect(sidebar).toMatch(/SIDEBAR_NAV/)
    expect(sidebar).toMatch(/sidebar-news-unread/)
    expect(sidebar).toMatch(/Weekly digest/)
    expect(sidebar).toMatch(/Cloud Sync/)
    expect(sidebar).toMatch(/Settings/)
    expect(sidebar).not.toMatch(/nav-others-toggle/)
  })

  it('bottom nav doors stay five — News / YouTube are a compact media cluster', () => {
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
    const nav = read('../components/layout/BottomNav.tsx')
    expect(nav).toMatch(/PHONE_MEDIA_NAV/)
    expect(nav).toMatch(/bottom-nav-media/)
  })

  it('header Refresh is visible and orange; bell is only inside …', () => {
    const toolbar = read('../components/layout/ToolbarControls.tsx')
    expect(toolbar).toMatch(/toolbar-refresh/)
    expect(toolbar).toMatch(/Refresh all data/)
    expect(toolbar).toMatch(/data-testid="toolbar-desktop-sync"/)
    expect(toolbar).toMatch(/<NotificationCenter/)
    expect(toolbar).not.toMatch(/MediaChromeChips/)
    expect(toolbar).not.toMatch(/toolbar-more-hint/)
    expect(toolbar).not.toMatch(/Refresh · Privacy · Theme · Glass · Search/)
    const css = read('../index.css')
    expect(css).toMatch(/\.toolbar-refresh/)
    expect(css).toMatch(/#f7931a|#F7931A/)
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).not.toMatch(/MediaChromeChips/)
    expect(shell).toMatch(/isBookDevice|runOneButtonSync/)
  })

  it('Today media card keeps News / YouTube; header does not duplicate them', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/News and YouTube favourites stay in sync across devices/)
    expect(dash).toMatch(/to="\/news"/)
    expect(dash).toMatch(/to="\/youtube"/)
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).not.toMatch(/chrome-news-chip/)
    expect(read('../components/layout/ToolbarControls.tsx')).not.toMatch(/chrome-news-chip/)
  })

  it('does not change the 1.2.128 Cloud Sync lock', () => {
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/origin-lock|ORIGIN|allowlist|thisDeviceIsTheBook|applyRemoteAsBook/)
    const book = read('../services/sync/localBook.ts')
    expect(book).toMatch(/thisDeviceIsTheBook|localBookIsSourceOfTruth/)
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/applyRemoteAsBook|runOneButtonSync/)
  })
})
