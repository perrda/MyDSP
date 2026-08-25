import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Mobile / tablet / landscape QA (v1.2.98)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.117')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.117')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.117',
      '1.2.116',
      '1.2.114',
      '1.2.113',
      '1.2.112',
    ])
  })

  it('measures app header + thumb CTA heights', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/useCssVarFromElementSize\(headerRef,\s*'--app-header-offset'\)/)
    expect(shell).toMatch(/usePublishThumbCtaHeight/)
    const hook = readFileSync(resolve(__dirname, '../hooks/usePublishThumbCtaHeight.ts'), 'utf8')
    expect(hook).toMatch(/--thumb-cta-height/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/--thumb-cta-height/)
    expect(css).toMatch(/var\(--thumb-cta-height/)
  })

  it('phone header overflow stays visible for menus', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).not.toMatch(
      /\.app-header-row\s*\{[^}]*overflow:\s*hidden/s,
    )
    expect(css).toMatch(/Must stay visible — More \/ Notifications/)
  })

  it('content-first: Markets create in header; no fixed bottom create bar', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/mobile-content-first-chrome/)
    expect(css).toMatch(/\.thumb-cta-bar,\s*\n\.thumb-cta-bar-spacer/)
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/PagePrimaryActions/)
    expect(markets).not.toMatch(/className="thumb-cta-bar"/)
    expect(markets).not.toMatch(/markets-density-thumb/)
    expect(markets).not.toMatch(/markets-add-commodity-thumb/)
    expect(markets).not.toMatch(/Refresh now/)
    expect(markets).toMatch(/Add equity/)
  })

  it('Markets sticky filters sit under measured toolbar', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /\.markets-sticky-filters\s*\{[\s\S]*?--markets-toolbar-height/m,
    )
  })

  it('News/YouTube header creates have no Refresh CTA', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(news).toMatch(/PagePrimaryActions/)
    expect(yt).toMatch(/PagePrimaryActions/)
    expect(news).not.toMatch(/className="thumb-cta-bar"/)
    expect(yt).not.toMatch(/className="thumb-cta-bar"/)
    expect(news).not.toMatch(/Refreshing…/)
    expect(yt).not.toMatch(/Refreshing…/)
    expect(news).toMatch(/Add tag/)
    expect(yt).toMatch(/Add channel/)
  })

  it('Job Detail measures action bar + landscape keeps it', () => {
    const job = readFileSync(resolve(__dirname, '../pages/JobDetailPage.tsx'), 'utf8')
    expect(job).toMatch(/useCssVarFromElementSize\(actionBarRef,\s*'--job-detail-action-height'\)/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/--job-detail-action-height/)
    expect(css).toMatch(
      /orientation: landscape\) and \(max-height: 500px\)[\s\S]*?\.job-detail-action-bar[\s\S]*?display:\s*flex/m,
    )
  })

  it('design rule is alwaysApply', () => {
    const rule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/mobile-tablet-landscape.mdc'),
      'utf8',
    )
    expect(rule).toMatch(/alwaysApply:\s*true/)
    expect(rule).toMatch(/--thumb-cta-height/)
    expect(rule).toMatch(/portrait/)
  })
})
