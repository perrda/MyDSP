import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RELEASE_NOTES,
  releaseBulletHref,
  releaseBulletText,
  releaseNotesArchive,
} from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.155 What’s new satellite wording + News destination', () => {
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
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.155\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/satellite/i)
    expect(section).toMatch(/\/news/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/What’s new satellite wording \(v1\.2\.155\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.158/)
  })

  it('1.2.155 tip News/Markets line is every satellite and opens /news', () => {
    const tip = RELEASE_NOTES.find((e) => e.version === '1.2.155')
    expect(tip).toBeTruthy()
    const first = tip!.bullets[0]
    const text = releaseBulletText(first)
    expect(text).toMatch(/News\s*\/\s*Markets/)
    expect(text).toMatch(/satellite/i)
    expect(text).toMatch(/iPhone/)
    expect(text).toMatch(/iPad/)
    expect(text).not.toMatch(/on a MacBook/)
    expect(releaseBulletHref(first)).toBe('/news')
    expect(releaseBulletHref(first)).not.toBe('/youtube')
  })
})
