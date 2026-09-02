import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { satelliteAwaitingFirstPull } from '../services/sync/satelliteFactorySeed'
import { saveSyncConfig } from '../services/sync/syncService'
import { loadNewsState } from '../storage/newsStore'
import { loadMarketsState } from '../storage/marketsStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.152 satellite blank News/Markets seed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.163')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.163')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.163',
      '1.2.162',
      '1.2.161',
      '1.2.160',
      '1.2.159',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.152\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/factory/)
    expect(section).toMatch(/lastSyncAt/)
    expect(section).toMatch(/~\/MyDSP/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Satellite blank News\/Markets seed \(v1\.2\.152\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.163/)
  })

  it('waiting satellite seeds blank; Mini and first-run keep factory', () => {
    expect(satelliteAwaitingFirstPull()).toBe(false)
    expect(loadNewsState().tags.length).toBeGreaterThan(0)
    localStorage.clear()
    expect(loadMarketsState().tickers.length).toBeGreaterThan(0)

    localStorage.clear()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    expect(satelliteAwaitingFirstPull()).toBe(true)
    expect(loadNewsState().tags).toEqual([])
    localStorage.removeItem('mydsp_markets_v1')
    expect(loadMarketsState().tickers).toEqual([])

    localStorage.clear()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: true,
    })
    expect(satelliteAwaitingFirstPull()).toBe(false)
    expect(loadNewsState().tags.length).toBeGreaterThan(0)
  })
})
