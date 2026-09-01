import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { shouldPushCloudAfterBackup } from '../storage/backupStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.157 Mini boot pushes extras with Automatic off', () => {
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
    const section = changelog.match(/## \[1\.2\.157\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/pushSync/)
    expect(section).toMatch(/shouldPushCloudAfterBackup/)
    expect(section).toMatch(/Automatic/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Mini boot extras push \(v1\.2\.157\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.161/)
    const auto = read('../services/sync/autoSyncService.ts')
    const boot = auto.slice(auto.indexOf('export function startAutoSync'))
    expect(boot).toMatch(/shouldPushCloudAfterBackup/)
    expect(boot).toMatch(/pushSync/)
    expect(boot).toMatch(/unlockAndPullFromCloud/)
    expect(boot).toMatch(/isBookDevice\(cfg\)/)
  })

  it('Backup gate still book-only; satellites never push from that helper', () => {
    const url = { remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev', thisDeviceIsTheBook: true }
    expect(shouldPushCloudAfterBackup(url, 'long-enough-passphrase')).toBe(true)
    expect(shouldPushCloudAfterBackup({ ...url, thisDeviceIsTheBook: false }, 'long-enough-passphrase')).toBe(
      false,
    )
    expect(shouldPushCloudAfterBackup(url, null)).toBe(false)
  })
})
