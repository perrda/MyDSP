import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MARKET_TIMEFRAMES } from '../domain/marketTimeframe'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Markets toolbar layout · headers · YTD/ALL (v1.2.96+)', () => {
  it('package + release notes tip tracks current tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe(RELEASE_NOTES[0]?.version)
    expect(releaseNotesArchive(5)[0]?.version).toBe(pkg.version)
  })

  it('timeframes include YTD/ALL; no search placeholder / Tag+Yield hint', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(MARKET_TIMEFRAMES).toEqual(['24H', '1W', '1M', '12M', 'YTD', 'ALL'])
    expect(page).not.toMatch(/placeholder="Search watchlist by symbol or name"/)
    expect(page).not.toMatch(/markets-tag-yield-settings-hint/)
    expect(page).not.toMatch(/Tag \+ Yield chips are hidden/)
  })

  it('page/shell headers match section title scale app-wide', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    const header = readFileSync(resolve(__dirname, '../components/ui/PageHeader.tsx'), 'utf8')
    expect(css).toMatch(/\.app-header-eyebrow/)
    expect(css).toMatch(/\.app-page-title/)
    expect(shell).toMatch(/app-header-eyebrow/)
    expect(shell).toMatch(/app-header-title/)
    expect(header).toMatch(/app-page-eyebrow/)
    expect(header).toMatch(/app-page-title/)
  })
})
