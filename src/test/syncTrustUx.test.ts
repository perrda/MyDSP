import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSyncConfig, saveSyncConfig } from '../services/sync/syncService'

const mem = new Map<string, string>()

describe('Sync trust UX', () => {
  beforeEach(() => {
    mem.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
    })
  })

  afterEach(() => {
    mem.clear()
    vi.unstubAllGlobals()
  })

  it('keeps last media/favourites sync timestamp in SyncConfig whitelist', () => {
    const at = '2026-07-25T09:16:00.000Z'
    saveSyncConfig({
      remoteUrl: 'https://example.workers.dev',
      enabled: true,
      lastWorkspaceExtrasSyncAt: at,
    })

    expect(loadSyncConfig().lastWorkspaceExtrasSyncAt).toBe(at)
  })

  it('surfaces Settings unlock onboarding and media pull CTA', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')

    expect(settings).toMatch(/data-testid="sync-unlock-onboarding"/)
    expect(settings).toMatch(/Cloud sync is locked on this device/)
    expect(settings).toMatch(/Markets live prices still work/)
    expect(settings).toMatch(/Remember passphrase/)
    expect(settings).toMatch(/data-testid="sync-pull-media"/)
    expect(settings).toMatch(/Unlock & pull media from cloud/)
    expect(settings).toMatch(/Pull media from cloud/)
    expect(settings).toMatch(/previewPull\(syncCfg\.remoteUrl, passphrase\)/)
    expect(settings).toMatch(/applyWorkspaceExtrasFromPreview\(preview\)/)
    expect(settings).toMatch(/summarizeWorkspaceExtras/)
  })

  it('shows last media/favourites sync health and cross-page unlock nudges', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(settings).toMatch(/data-testid="sync-last-media-at"/)
    expect(settings).toMatch(/Last media \/ favourites sync/)
    expect(news).toMatch(/data-testid="news-unlock-sync-banner"/)
    expect(news).toMatch(/needs-passphrase/)
    expect(news).toMatch(/Unlock sync to pull saved tickers and headlines/)
    expect(dashboard).toMatch(/data-testid="today-unlock-sync-nudge"/)
    expect(dashboard).toMatch(/settings#sync/)
  })
})
