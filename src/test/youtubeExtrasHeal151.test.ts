import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { satelliteShouldHealExtrasPull } from '../services/sync/autoSyncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.151 satellite extras heal', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.161')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.161')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.161',
      '1.2.160',
      '1.2.159',
      '1.2.158',
      '1.2.157',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.151\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/lastWorkspaceExtrasSyncAt/)
    expect(section).toMatch(/lastRemoteExportedAt/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Satellite extras heal \(v1\.2\.151\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.161/)
  })

  it('satellites without an extras stamp re-download; Mini does not', () => {
    expect(
      satelliteShouldHealExtrasPull({ thisDeviceIsTheBook: false, lastWorkspaceExtrasSyncAt: undefined }),
    ).toBe(true)
    expect(
      satelliteShouldHealExtrasPull({
        thisDeviceIsTheBook: false,
        lastWorkspaceExtrasSyncAt: '2026-09-01T16:00:00.000Z',
      }),
    ).toBe(false)
    expect(
      satelliteShouldHealExtrasPull({ thisDeviceIsTheBook: true, lastWorkspaceExtrasSyncAt: undefined }),
    ).toBe(false)
    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/extrasNeverLanded/)
    expect(auto).toMatch(/satelliteShouldHealExtrasPull/)
  })
})
