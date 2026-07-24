import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Markets remove Retag row action (v1.2.101)', () => {
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

  it('row actions are Edit + Remove only (no Retag)', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).not.toMatch(/markets-retag/)
    expect(page).not.toMatch(/markets-undo-retag/)
    expect(page).not.toMatch(/setRetagTicker/)
    expect(page).not.toMatch(/applyTickerTag/)
    expect(page).not.toMatch(/label: t\.tag \? `Retag/)
    expect(page).toMatch(/aria-label=\{`Edit \$\{t\.symbol\}`\}/)
    expect(page).toMatch(/aria-label=\{`Remove \$\{t\.symbol\}`\}/)
    // Tag can still be set via Edit form
    expect(page).toMatch(/Tag \/ folder \(optional\)/)
  })
})
