import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.149 YouTube channels unlock-and-pull across devices', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.162')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.162')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.162',
      '1.2.161',
      '1.2.160',
      '1.2.159',
      '1.2.158',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.149\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/YouTube/)
    expect(section).toMatch(/passphrase/)
    expect(section).toMatch(/Mini/)
    expect(section).toMatch(/unlockAndPullFromCloud/)
    expect(section).toMatch(/pull only/)
    expect(section).toMatch(/fxRates/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/YouTube channels unlock-and-pull \(v1\.2\.149\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.162/)
  })

  it('YouTube and News unlock banners pull extras without Settings-only', () => {
    const yt = read('../pages/YouTubePage.tsx')
    expect(yt).toMatch(/UnlockSyncMediaBanner/)
    expect(yt).toMatch(/satelliteNeedsMediaUnlock/)
    expect(yt).toMatch(/These channels are only on this Mac/)
    expect(yt).not.toMatch(/Unlock in Settings → Sync/)
    const news = read('../pages/NewsPage.tsx')
    expect(news).toMatch(/UnlockSyncMediaBanner/)
    expect(news).toMatch(/satelliteNeedsMediaUnlock/)
    const markets = read('../pages/MarketsPage.tsx')
    expect(markets).toMatch(/UnlockSyncMediaBanner/)
    expect(markets).toMatch(/satelliteNeedsMediaUnlock/)
    expect(markets).toMatch(/markets-unlock-sync-banner/)
    const today = read('../pages/Dashboard.tsx')
    expect(today).toMatch(/UnlockSyncMediaBanner/)
    expect(today).toMatch(/today-unlock-sync-banner/)
    expect(today).not.toMatch(/Cloud sync locked — unlock in Settings/)
    const banner = read('../components/UnlockSyncMediaBanner.tsx')
    expect(banner).toMatch(/unlockAndPullFromCloud/)
    expect(banner).not.toMatch(/runOneButtonSync/)
    expect(banner).toMatch(/mydsp-youtube-changed/)
    expect(banner).toMatch(/mydsp-news-changed/)
    expect(banner).toMatch(/mydsp-markets-changed/)
    const one = read('../services/sync/oneButtonSync.ts')
    const start = one.indexOf('export async function unlockAndPullFromCloud')
    expect(start).toBeGreaterThan(-1)
    const flushAt = one.indexOf('export async function flushQueuedSyncPush')
    const body = one.slice(start, flushAt > start ? flushAt : start + 1800)
    expect(body).toMatch(/applyWorkspaceExtrasFromPreview/)
    expect(body).toMatch(/applyRemoteAsBook/)
    expect(body).not.toMatch(/pushThisBook/)
    expect(body).not.toMatch(/pushSync/)
    const auto = read('../services/sync/autoSyncService.ts')
    const mark = auto.indexOf('export function markLocalDataChanged')
    expect(mark).toBeGreaterThan(-1)
    expect(auto.slice(mark, mark + 900)).toMatch(/lastSyncAt/)
    expect(auto).toMatch(/dirty \? 'manual' : reason/)
    const backup = read('../storage/backupStore.ts')
    expect(backup).toMatch(/source === 'auto' \|\| source === 'manual'|!opts\?\.skipAutoSync/)
    expect(backup).toMatch(/Satellites never push/)
    expect(backup).toMatch(/thisDeviceIsTheBook !== true/)
    expect(backup).toMatch(/shouldPushCloudAfterBackup/)
    expect(backup).toMatch(/Automatic sync can be off/)
    expect(backup).toMatch(/exportFxRatesForBackup/)
    expect(read('../services/sync/syncService.ts')).toMatch(/importFxRatesFromBackup/)
    expect(read('../pages/SettingsPage.tsx')).toMatch(/unlockAndPullFromCloud\(pass\)/)
    expect(read('../pages/SettingsPage.tsx')).toMatch(/flushQueuedSyncPush/)
    expect(read('../components/layout/AppShell.tsx')).toMatch(/unlockAndPullFromCloud\(pass\)/)
    const mediaUnlock = read('../services/sync/mediaUnlock.ts')
    expect(mediaUnlock).toMatch(/unlocked && pulled/)
    expect(mediaUnlock).toMatch(/lastSyncAt/)
    expect(mediaUnlock).not.toMatch(/lastWorkspaceExtrasSyncAt/)
    expect(auto).toMatch(/Cloud empty — waiting for Mini/)
    expect(auto).toMatch(/unlockAndPullFromCloud/)
    expect(one).toMatch(/export async function flushQueuedSyncPush/)
    expect(one.slice(one.indexOf('export async function flushQueuedSyncPush'))).toMatch(
      /unlockAndPullFromCloud/,
    )
    expect(read('../context/PortfolioContext.tsx')).toMatch(/flushQueuedSyncPush/)
    expect(read('../pages/Dashboard.tsx')).toMatch(/flushQueuedSyncPush/)
  })
})
