import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Favourites phase 2 wave (v1.2.106)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.129')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.129')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.129',
      '1.2.128',
      '1.2.127',
      '1.2.126',
      '1.2.125',
    ])
  })

  it('changelog covers all 10 Favourites + Shorts', () => {
    const changelog = readFileSync(resolve(__dirname, '../../CHANGELOG.md'), 'utf8')
    expect(changelog).toMatch(/## \[1\.2\.106\]/)
    expect(changelog).toMatch(/Daily plan/)
    expect(changelog).toMatch(/Payment ledger/)
    expect(changelog).toMatch(/Screener/)
    expect(changelog).toMatch(/calendar strip/)
    expect(changelog).toMatch(/Subtasks/)
    expect(changelog).toMatch(/Dividend schedule/)
    expect(changelog).toMatch(/Transfers ledger/)
    expect(changelog).toMatch(/Scenario sliders/)
    expect(changelog).toMatch(/Save\/read-later/)
    expect(changelog).toMatch(/Shorts filtered/)
  })

  it('Shorts filter helpers remain', () => {
    const yt = readFileSync(resolve(__dirname, '../domain/youtube.ts'), 'utf8')
    expect(yt).toMatch(/export function isYoutubeShort/)
    expect(yt).toMatch(/export function filterOutYoutubeShorts/)
  })
})
