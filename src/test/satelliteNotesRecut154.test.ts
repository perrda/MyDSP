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

function notesFor(version: string) {
  const entry = RELEASE_NOTES.find((e) => e.version === version)
  expect(entry, `missing release notes for ${version}`).toBeTruthy()
  return entry!
}

function newsMarketsBullet(version: string) {
  const entry = notesFor(version)
  const bullet = entry.bullets.find((b) => /News\s*\/\s*Markets/i.test(releaseBulletText(b)))
  expect(bullet, `${version} News/Markets bullet`).toBeTruthy()
  return bullet!
}

describe('MyDSP 1.2.154 What’s new satellite wording + News destination', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.154')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.154')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.154',
      '1.2.153',
      '1.2.152',
      '1.2.151',
      '1.2.150',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.154\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/satellite/i)
    expect(section).toMatch(/\/news/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/1\.2\.128/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).toMatch(/index-38SekjZy/)
    expect(read('../../ROADMAP.md')).toMatch(/What’s new satellite wording \(v1\.2\.154\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.154/)
  })

  it('1.2.152 News/Markets bullet is not MacBook-only and does not link to /youtube', () => {
    const bullet = newsMarketsBullet('1.2.152')
    const text = releaseBulletText(bullet)
    expect(text).toMatch(/satellite/i)
    expect(text).toMatch(/iPhone/)
    expect(text).toMatch(/iPad/)
    expect(text).not.toMatch(/^MacBook /)
    expect(releaseBulletHref(bullet)).toBe('/news')
    expect(releaseBulletHref(bullet)).not.toBe('/youtube')
  })

  it('1.2.154 tip News/Markets line is every satellite and opens /news', () => {
    const tip = notesFor('1.2.154')
    const first = tip.bullets[0]
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
