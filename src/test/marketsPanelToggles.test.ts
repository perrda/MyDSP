import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Markets Assets/Timeframe/Format panels (v1.2.97)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.101')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.101')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.101',
      '1.2.100',
      '1.2.99',
      '1.2.98',
      '1.2.97',
    ])
  })

  it('removes search + partial-price status chrome; uses disclosure panels', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).not.toMatch(/markets-in-list-search/)
    expect(page).not.toMatch(/Showing \$\{shown\}\/\$\{allTickers\.length\} prices/)
    expect(page).not.toMatch(/retrying sources shortly/)
    expect(page).toMatch(/markets-panel-toggles/)
    expect(page).toMatch(/data-testid=\{`markets-panel-\$\{id\}`\}/)
    expect(page).toMatch(/\['assets', 'Assets'/)
    expect(page).toMatch(/\['timeframe', 'Timeframe'/)
    expect(page).toMatch(/\['format', 'Format'/)
    expect(page).toMatch(/toolbarPanel === 'assets'/)
    expect(page).toMatch(/toolbarPanel === 'timeframe'/)
    expect(page).toMatch(/toolbarPanel === 'format'/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.markets-panel-toggles/)
    expect(css).toMatch(/grid-template-columns:\s*repeat\(3/)
  })
})
