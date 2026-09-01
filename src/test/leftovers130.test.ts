import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PHONE_MEDIA_NAV, PRIMARY_NAV, SIDEBAR_NAV } from '../domain/primaryNav'
import { resolveBottomNavItems } from '../domain/bottomNav'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { shouldImportSyncedMarketQuotes } from '../domain/marketQuotesSync'
import {
  bookDeviceNeedsLiveQuotes,
  QUOTE_FRESHNESS_SLA_MS,
} from '../domain/quoteFreshnessSla'
import type { MarketQuote } from '../domain/markets'
import {
  clearSessionSyncPassphrase,
  hasRememberedSyncPassphrase,
  setSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'
import {
  displayAutoSyncStatus,
  emitHydratedAutoSyncStatus,
  getAutoSyncStatus,
  stopAutoSync,
} from '../services/sync/autoSyncService'
import { DEFAULT_SYNC_REMOTE_URL, loadSyncConfig, saveSyncConfig } from '../services/sync/syncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')
const PASS = 'long-enough-passphrase'

function quote(partial: Partial<MarketQuote>): MarketQuote {
  return {
    symbol: 'BTC',
    kind: 'crypto',
    last: 100_000,
    changeAbs: 0,
    changePct: 0,
    sparkline: [],
    unit: 'GBP',
    decimals: 2,
    source: 'yahoo',
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('MyDSP 1.2.130 leftovers', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.153')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.153')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.153',
      '1.2.152',
      '1.2.151',
      '1.2.150',
      '1.2.149',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.130\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Unlock/)
    expect(section).toMatch(/Mini owns live quotes/)
    expect(section).toMatch(/News \+ YouTube/)
    expect(section).toMatch(/REPLACE/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
  })

  it('does not change the 1.2.128 Cloud Sync lock', () => {
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/origin-lock|ORIGIN|allowlist|thisDeviceIsTheBook|applyRemoteAsBook/)
    const book = read('../services/sync/localBook.ts')
    expect(book).toMatch(/thisDeviceIsTheBook|localBookIsSourceOfTruth/)
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/applyRemoteAsBook|runOneButtonSync/)
    expect(DEFAULT_SYNC_REMOTE_URL).not.toMatch(/\?key=/)
    expect(read('../services/sync/syncService.ts')).not.toMatch(/check SYNC_KEY/)
  })
})

describe('Job 1 — Unlock Sync after a working session', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    stopAutoSync()
  })

  afterEach(() => {
    clearSessionSyncPassphrase()
    stopAutoSync()
  })

  it('remembered passphrase hydrates the chip to Synced, not Unlock', () => {
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: true,
      rememberPassphrase: true,
      lastSyncAt: '2026-08-30T10:30:00.000Z',
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    expect(hasRememberedSyncPassphrase()).toBe(true)

    clearSessionSyncPassphrase({ clearRemembered: false })
    emitHydratedAutoSyncStatus()
    expect(getAutoSyncStatus().state).not.toBe('needs-passphrase')
    expect(getAutoSyncStatus().state).toBe('idle')
    expect(getAutoSyncStatus().message).toBe('Synced')
    expect(getAutoSyncStatus().lastAt).toBe('2026-08-30T10:30:00.000Z')
  })

  it('displayAutoSyncStatus heals needs-passphrase when remember exists', () => {
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: true,
      rememberPassphrase: true,
      lastSyncAt: '2026-08-30T10:30:00.000Z',
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    const healed = displayAutoSyncStatus({
      state: 'needs-passphrase',
      message: 'Enter passphrase in Settings (enable Remember for auto-sync)',
      lastAt: '2026-08-30T10:30:00.000Z',
    })
    expect(healed.state).toBe('idle')
    expect(healed.message).toBe('Synced')
    expect(healed.lastAt).toBe('2026-08-30T10:30:00.000Z')
  })

  it('chip hydrates on mount and uses displayAutoSyncStatus', () => {
    const chip = read('../components/SyncStatusChip.tsx')
    expect(chip).toMatch(/displayAutoSyncStatus/)
    expect(chip).toMatch(/emitHydratedAutoSyncStatus/)
    expect(chip).not.toMatch(/forceSyncNow/)
  })
})

describe('Job 3 — Mini owns live quotes', () => {
  it('book device does not import satellite quote cache', () => {
    expect(shouldImportSyncedMarketQuotes(true)).toBe(false)
    expect(shouldImportSyncedMarketQuotes(false)).toBe(true)
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/shouldImportSyncedMarketQuotes\(isBookDevice\(\)\)/)
    expect(sync).toMatch(/importMarketQuotesFromBackup\(preview\.workspaceExtras\.marketQuotes\)/)
  })

  it('sync-tagged or stale cache means Mini must fetch live', () => {
    const staleSync = quote({
      source: 'sync:yahoo',
      updatedAt: new Date(Date.now() - QUOTE_FRESHNESS_SLA_MS - 60_000).toISOString(),
    })
    expect(bookDeviceNeedsLiveQuotes([staleSync])).toBe(true)
    const freshSync = quote({
      source: 'sync:yahoo',
      updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    })
    expect(bookDeviceNeedsLiveQuotes([freshSync])).toBe(true)
    const live = quote({ source: 'yahoo', updatedAt: new Date().toISOString() })
    expect(bookDeviceNeedsLiveQuotes([live])).toBe(false)

    const ctx = read('../context/PortfolioContext.tsx')
    expect(ctx).toMatch(/refreshLiveQuotesForBookDevice/)
    expect(ctx).toMatch(/bookDeviceNeedsLiveQuotes/)
    expect(ctx).toMatch(/isBookDevice\(\)/)
    const quotes = read('../services/marketsQuotes.ts')
    expect(quotes).toMatch(/refreshLiveQuotesForBookDevice/)
    expect(quotes).not.toMatch(/finnhub_key.*=.*sk_/)
  })
})

describe('Job 4 — phone News and YouTube first-class', () => {
  it('sidebar order stays Today · Markets · Money · Plan · Household · News · YouTube', () => {
    expect(SIDEBAR_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
      'News',
      'YouTube',
    ])
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
    ])
    expect(resolveBottomNavItems().map((i) => i.to)).toEqual([
      '/',
      '/markets',
      '/money',
      '/plan',
      '/household',
    ])
    expect(PHONE_MEDIA_NAV.map((i) => i.to)).toEqual(['/news', '/youtube'])
  })

  it('bottom nav adds a compact media cluster — not seven equal tabs', () => {
    const nav = read('../components/layout/BottomNav.tsx')
    expect(nav).toMatch(/PHONE_MEDIA_NAV/)
    expect(nav).toMatch(/bottom-nav-media/)
    expect(nav).toMatch(/bottom-nav-news/)
    expect(nav).toMatch(/bottom-nav-youtube/)
    expect(nav).toMatch(/bottom-nav-news-unread/)
    expect(nav).toMatch(/newsUnreadFromCache/)
    const css = read('../index.css')
    expect(css).toMatch(/\.bottom-nav-media/)
    expect(css).toMatch(/not seven equal tabs/)
    expect(css).toMatch(/bottom-nav-media-link \.bottom-nav-link-label/)
    expect(css).toMatch(/#f7931a|#F7931A/)
  })
})

describe('Job 5 — satellite PTR / Refresh REPLACE Mini', () => {
  it('PTR and header Refresh hydrate then REPLACE without requiring Automatic', () => {
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/replaceOrPushBook/)
    expect(shell).toMatch(/hydrateSessionSyncPassphrase/)
    expect(shell).toMatch(/runOneButtonSync\(pass\)/)
    expect(shell).toMatch(/Pulling the book/)
    expect(shell).not.toMatch(/if \(cfg\.enabled\) await runOneButtonSync/)
    const ptr = read('../components/ui/PullToRefresh.tsx')
    expect(ptr).toMatch(/isTouchUi/)
    expect(ptr).toMatch(/effectivelyDisabled = disabled \?\? !isTouchUi\(\)/)
  })
})
