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

function notesOf(version: string) {
  const entry = RELEASE_NOTES.find((e) => e.version === version)
  expect(entry, `missing What’s new ${version}`).toBeTruthy()
  return entry!
}

function namesEverySatellite(text: string) {
  const mentionsMacBook = /\bMacBook\b/.test(text)
  if (!mentionsMacBook) return /\bsatellite/i.test(text) || /\biPhone\b/.test(text)
  return (
    /\bsatellite/i.test(text) ||
    /\biPhone\b/.test(text) ||
    /\biPad\b/.test(text) ||
    /\bMum\b/.test(text) ||
    /\bAndrew\b/.test(text)
  )
}

function isNewsMarketsOrLeftoverLists(text: string) {
  return (
    /News/.test(text) ||
    /Markets/.test(text) ||
    /leftover/i.test(text) ||
    /factory/.test(text) ||
    /pull-only/.test(text)
  )
}

describe('MyDSP 1.2.157 What’s new archive satellites + News dest', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.157')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.157')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.157',
      '1.2.156',
      '1.2.155',
      '1.2.154',
      '1.2.153',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.157\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/satellite/i)
    expect(section).toMatch(/\/news/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(changelog).toMatch(/## \[1\.2\.156\]/)
    expect(changelog).toMatch(/## \[1\.2\.155\]/)
    expect(read('../../ROADMAP.md')).toMatch(/What’s new archive satellites \+ News dest \(v1\.2\.157\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.157/)
  })

  it('1.2.157 banner describes the archive heal', () => {
    const tip = notesOf('1.2.157')
    const texts = tip.bullets.map(releaseBulletText)
    expect(texts.some((t) => /satellite/i.test(t))).toBe(true)
    expect(texts.some((t) => /News/.test(t) && /YouTube/.test(t))).toBe(true)
    for (const b of tip.bullets) {
      const text = releaseBulletText(b)
      if (isNewsMarketsOrLeftoverLists(text)) {
        expect(releaseBulletHref(b)).not.toBe('/youtube')
      }
    }
  })

  it('1.2.152–1.2.155 satellite unlock/lists are not MacBook-only; News/leftover dest not /youtube', () => {
    const versions = ['1.2.152', '1.2.153', '1.2.154', '1.2.155'] as const
    for (const version of versions) {
      const entry = notesOf(version)
      for (const b of entry.bullets) {
        const text = releaseBulletText(b)
        const href = releaseBulletHref(b)
        const satelliteUnlockOrLists =
          /Unlock|satellite|leftover|factory News|factory.*Markets|channel added/i.test(text)
        if (satelliteUnlockOrLists && /\bMacBook\b/.test(text)) {
          expect(namesEverySatellite(text), `${version}: ${text}`).toBe(true)
        }
        if (isNewsMarketsOrLeftoverLists(text) && !/^Later pulls still union/.test(text)) {
          expect(href, `${version}: ${text} dest`).not.toBe('/youtube')
        }
      }
    }

    const v152 = notesOf('1.2.152').bullets[0]
    expect(releaseBulletText(v152)).toMatch(/satellite/i)
    expect(releaseBulletText(v152)).toMatch(/News\s*\/\s*Markets/)
    expect(releaseBulletText(v152)).not.toMatch(/^MacBook does not/)
    expect(releaseBulletHref(v152)).toBe('/news')

    const v153first = notesOf('1.2.153').bullets[0]
    expect(releaseBulletText(v153first)).toMatch(/satellite/i)
    expect(releaseBulletText(v153first)).not.toMatch(/on a MacBook/)
    expect(releaseBulletHref(v153first)).not.toBe('/youtube')

    const v153union = notesOf('1.2.153').bullets[2]
    expect(releaseBulletText(v153union)).toMatch(/satellite/i)
    expect(releaseBulletText(v153union)).not.toMatch(/on MacBook reaches Mini/)

    const v154 = notesOf('1.2.154').bullets[2]
    expect(releaseBulletText(v154)).toMatch(/satellite/i)
    expect(releaseBulletText(v154)).not.toMatch(/leftover MacBook lists/)
    expect(releaseBulletHref(v154)).not.toBe('/youtube')

    const v155union = notesOf('1.2.155').bullets[2]
    expect(releaseBulletText(v155union)).toMatch(/satellite/i)
    expect(releaseBulletText(v155union)).not.toMatch(/on MacBook reaches Mini/)
  })
})
