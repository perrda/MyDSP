import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { refreshLiveMarksAfterUnlock } from '../services/marketsQuotes'
import * as fx from '../services/fx'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.154 Unlock fetches live FX and marks', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.164')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.164')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
      '1.2.160',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.154\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(section).toMatch(/fetchFxRates/)
    expect(section).toMatch(/force/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Unlock live FX and marks \(v1\.2\.154\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.164/)
    expect(read('../services/sync/oneButtonSync.ts')).toMatch(/refreshLiveMarksAfterUnlock/)
    const unlock = read('../services/sync/oneButtonSync.ts')
    const start = unlock.indexOf('export async function unlockAndPullFromCloud')
    const body = unlock.slice(start, unlock.indexOf('export async function flushQueuedSyncPush'))
    expect(body).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(body).not.toMatch(/pushSync/)
    expect(read('../context/PortfolioContext.tsx')).toMatch(/mydsp-unlock-live-marks/)
    expect(read('../context/PortfolioContext.tsx')).toMatch(/refreshPrices\(\{ force: true \}\)/)
    expect(read('../services/marketsQuotes.ts')).toMatch(/fromSync: true/)
  })

  it('quote failure does not throw; live-marks events still fire', async () => {
    vi.spyOn(fx, 'fetchFxRates').mockRejectedValue(new Error('fx down'))
    const events: string[] = []
    vi.spyOn(window, 'dispatchEvent').mockImplementation((ev) => {
      if (ev instanceof Event) events.push(ev.type)
      return true
    })
    await expect(refreshLiveMarksAfterUnlock()).resolves.toBeUndefined()
    expect(events).toContain('mydsp-unlock-live-marks')
    expect(events).toContain('mydsp-global-refresh')
  })
})
