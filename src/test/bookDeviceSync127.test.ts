import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MONEY_DIRECTORY, MONEY_DOORS } from '../domain/hubPages'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { chooseFirstSyncAction, chooseSyncAction } from '../services/sync/localBook'
import {
  DEFAULT_SYNC_REMOTE_URL,
  isBookDevice,
  loadSyncConfig,
  resolveSyncRemoteUrl,
} from '../services/sync/syncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.127 book device + satellite pull + origin-lock', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.149')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.149')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.149',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
    ])
    const notes127 = RELEASE_NOTES.find((e) => e.version === '1.2.127')
    const tip = notes127?.bullets.map((b) => (typeof b === 'string' ? b : b.text)).join(' ')
    expect(tip).toMatch(/book|satellite|pull/i)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
    const changelog = read('../../CHANGELOG.md')
    const section127 = changelog.match(/## \[1\.2\.127\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section127).toMatch(/1\.2\.127/)
    expect(section127).not.toMatch(/SYNC_KEY/)
  })

  it('keeps Money 12-tile directory + cockpit + orange lock', () => {
    expect(MONEY_DIRECTORY).toHaveLength(12)
    expect(MONEY_DOORS.map((d) => d.label)).toEqual(['Spend', 'Holdings', 'Tax', 'Import'])
    const money = read('../pages/MoneyPage.tsx')
    expect(money).toMatch(/money-directory/)
    expect(money).toMatch(/money-cockpit/)
    const css = read('../index.css')
    expect(css).toMatch(/--accent:\s*#F7931A/)
  })

  it('bakes mydsp-sync without a client access key; Advanced stays folded', () => {
    expect(DEFAULT_SYNC_REMOTE_URL).toBe('https://mydsp-sync.dave-perry.workers.dev')
    expect(resolveSyncRemoteUrl('')).toMatch(/^https:\/\/mydsp-sync\.dave-perry\.workers\.dev\/?$/)
    expect(DEFAULT_SYNC_REMOTE_URL).not.toMatch(/\?key=/)
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/data-testid="sync-simple"/)
    expect(settings).toMatch(/data-testid="sync-one-button"/)
    expect(settings).toMatch(/data-testid="sync-book-device"/)
    expect(settings).toMatch(/data-testid="sync-satellite-copy"/)
    expect(settings).toMatch(/This device pulls the book/)
    expect(settings).toMatch(/data-testid="sync-advanced"/)
    expect(settings).not.toMatch(/SYNC_KEY/)
    expect(read('../services/sync/oneButtonSync.ts')).not.toMatch(/SYNC_KEY/)
    expect(read('../services/sync/syncService.ts')).not.toMatch(/check SYNC_KEY/)
  })

  it('book device always pushes; satellite always pulls when cloud has an envelope', () => {
    expect(chooseSyncAction({ isBookDevice: true })).toBe('push')
    expect(chooseSyncAction({ isBookDevice: false })).toBe('pull')
    expect(chooseFirstSyncAction({ localHasBook: true, alreadySynced: false })).toBe('pull')
    expect(
      chooseFirstSyncAction({ localHasBook: true, alreadySynced: false, isBookDevice: true }),
    ).toBe('push')
    expect(isBookDevice({ remoteUrl: '', enabled: false, thisDeviceIsTheBook: true })).toBe(true)
    expect(isBookDevice({ remoteUrl: '', enabled: false })).toBe(false)
    expect(loadSyncConfig().thisDeviceIsTheBook).toBeFalsy()
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/chooseFirstSyncAction/)
    expect(one).toMatch(/applyRemoteAsBook/)
    expect(one).toMatch(/Cloud empty/)
    expect(one).toMatch(/enabled: true/)
    expect(one).toMatch(/remember: true/)
    expect(one).not.toMatch(/this book was kept/)
    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/applyRemoteAsBook/)
    expect(auto).toMatch(/if \(!isBookDevice\(cfg\)\) \{/)
    expect(auto).toMatch(/if \(!cfg\.lastSyncAt\) return/)
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/runOneButtonSync/)
    expect(shell).toMatch(/isBookDevice/)
    expect(shell).toMatch(/Pulling the book/)
    expect(shell).toMatch(/const onRefresh = async/)
    const toolbar = read('../components/layout/ToolbarControls.tsx')
    expect(toolbar).toMatch(/data-testid="toolbar-desktop-sync"/)
    expect(toolbar).toMatch(/onRefresh\(\)/)
  })

  it('passphrase field hides after an unlocked session', () => {
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/hasSessionSyncPassphrase\(\) \|\| hasRememberedSyncPassphrase\(\)/)
    expect(settings).toMatch(/sync-passphrase-unlocked/)
    expect(settings).toMatch(/remember: true/)
  })
})
