import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Mobile / tablet / landscape QA (v1.2.98)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.98')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.98')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.98',
      '1.2.97',
      '1.2.96',
      '1.2.95',
      '1.2.94',
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

  it('thumb CTAs remain in short landscape + Markets thumb is slim', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /@media \(max-width: 639px\), \(orientation: landscape\) and \(max-height: 500px\)/,
    )
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/Primary markets actions/)
    expect(markets).not.toMatch(/markets-density-thumb/)
    expect(markets).not.toMatch(/markets-add-commodity-thumb/)
    expect(markets).not.toMatch(/Refresh now/)
    expect(markets).toMatch(/hidden sm:flex[\s\S]*Add equity/)
  })

  it('Markets sticky filters sit under measured toolbar', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /\.markets-sticky-filters\s*\{[\s\S]*?--markets-toolbar-height/m,
    )
  })

  it('News/YouTube thumbs have no Refresh CTA', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(news).toMatch(/Primary news actions/)
    expect(yt).toMatch(/Primary YouTube actions/)
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
