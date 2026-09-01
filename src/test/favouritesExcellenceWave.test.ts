import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Favourites excellence wave (v1.2.103)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.159')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.159')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.159',
      '1.2.158',
      '1.2.157',
      '1.2.156',
      '1.2.155',
    ])
  })

  it('covers all 10 Favourites sections', () => {
    const changelog = readFileSync(resolve(__dirname, '../../CHANGELOG.md'), 'utf8')
    expect(changelog).toMatch(/## \[1\.2\.103\]/)
    expect(changelog).toMatch(/Today \/ Overview/)
    expect(changelog).toMatch(/Analytics \/ Predictive/)
    expect(changelog).toMatch(/Markets/)
    expect(changelog).toMatch(/Liabilities/)
    expect(changelog).toMatch(/Job Tracker/)
    expect(changelog).toMatch(/To Do/)
    expect(changelog).toMatch(/Equities \/ Crypto/)
    expect(changelog).toMatch(/News \/ YouTube/)
  })
})
