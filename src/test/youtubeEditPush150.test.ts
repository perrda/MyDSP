import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { shouldRunSyncCycle } from '../services/sync/autoSyncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.150 Mini edits push with Automatic off', () => {
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
    const section = changelog.match(/## \[1\.2\.150\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Automatic off/)
    expect(section).toMatch(/markLocalDataChanged/)
    expect(section).toMatch(/lastSyncAt/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Mini edits push with Automatic off \(v1\.2\.150\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.158/)
    expect(read('../../DEPLOY.md')).toMatch(/git clone https:\/\/github.com\/perrda\/MyDSP.git ~\/MyDSP/)
    expect(read('../../DEPLOY.md')).toMatch(/scripts\/go-live\.sh/)
    expect(read('../../DEPLOY.md')).toMatch(/cd ~\/MyDSP/)
    expect(read('../../DEPLOY.md')).not.toMatch(/cd ~\/AI_Projects\/MyDSP/)
    expect(read('../../README.md')).toMatch(/scripts\/go-live\.sh/)
    expect(read('../../README.md')).toMatch(/git clone https:\/\/github.com\/perrda\/MyDSP.git ~\/MyDSP/)
    expect(read('../../README.md')).not.toMatch(/Sole build home/)
  })

  it('edit cycles run without Automatic; interval stays quiet', () => {
    const url = { remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev', enabled: false }
    expect(shouldRunSyncCycle(url, 'edit', true)).toBe(true)
    expect(shouldRunSyncCycle(url, 'manual', false)).toBe(true)
    expect(shouldRunSyncCycle(url, 'hide', true)).toBe(true)
    expect(shouldRunSyncCycle(url, 'interval', false)).toBe(false)
    expect(shouldRunSyncCycle(url, 'focus', false)).toBe(false)
    expect(shouldRunSyncCycle({ remoteUrl: '', enabled: false }, 'edit', true)).toBe(false)
    expect(
      shouldRunSyncCycle(
        { remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev', enabled: true },
        'interval',
        false,
      ),
    ).toBe(true)

    const auto = read('../services/sync/autoSyncService.ts')
    const mark = auto.indexOf('export function markLocalDataChanged')
    expect(auto.slice(mark, mark + 700)).toMatch(/if \(!cfg\.remoteUrl\) return/)
    expect(auto.slice(mark, mark + 700)).not.toMatch(/!cfg\.enabled/)
    expect(auto.slice(mark, mark + 900)).toMatch(/lastSyncAt/)
    expect(read('../pages/SettingsPage.tsx')).toMatch(/Only the Mini should be the book/)
    expect(read('../pages/SettingsPage.tsx')).toMatch(/window\.confirm/)
  })
})
