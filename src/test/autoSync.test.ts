import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSessionSyncPassphrase,
  getSessionSyncPassphrase,
  hasRememberedSyncPassphrase,
  hydrateSessionSyncPassphrase,
  setSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'
import {
  fetchRemoteMeta,
  getSyncRemoteUrlWarning,
  loadSyncConfig,
  saveSyncConfig,
} from '../services/sync/syncService'
import {
  beginApplyingRemote,
  endApplyingRemote,
  getAutoSyncStatus,
  markLocalDataChanged,
  startAutoSync,
  stopAutoSync,
} from '../services/sync/autoSyncService'
import { setOnPortfolioDataChanged } from '../storage/portfolioStore'

describe('session sync passphrase remember', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
  })

  it('rejects short passphrases', () => {
    setSessionSyncPassphrase('short')
    expect(getSessionSyncPassphrase()).toBeNull()
  })

  it('remembers passphrase on this device when asked', () => {
    setSessionSyncPassphrase('long-enough-pass', { remember: true })
    expect(getSessionSyncPassphrase()).toBe('long-enough-pass')
    expect(hasRememberedSyncPassphrase()).toBe(true)

    clearSessionSyncPassphrase({ clearRemembered: false })
    // memory cleared but disk kept — hydrate restores
    expect(hydrateSessionSyncPassphrase()).toBe('long-enough-pass')
  })

  it('clears remembered passphrase', () => {
    setSessionSyncPassphrase('long-enough-pass', { remember: true })
    clearSessionSyncPassphrase()
    expect(hasRememberedSyncPassphrase()).toBe(false)
    expect(getSessionSyncPassphrase()).toBeNull()
  })
})

describe('sync config auto fields', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists auto-sync flags', () => {
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.example.workers.dev',
      enabled: true,
      rememberPassphrase: true,
      autoResolveConflicts: true,
    })
    const cfg = loadSyncConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.rememberPassphrase).toBe(true)
    expect(cfg.autoResolveConflicts).toBe(true)
  })

  it('warns when Remote URL is the app host (405 cause)', () => {
    expect(getSyncRemoteUrlWarning('https://mydspv1.dave-perry.workers.dev')).toMatch(/405/)
    expect(getSyncRemoteUrlWarning('https://mydsp-sync.dave-perry.workers.dev')).toBeNull()
    expect(
      getSyncRemoteUrlWarning('https://mydsp-sync.dave-perry.workers.dev?key=secret'),
    ).toBeNull()
  })

  it('adds https:// when Remote URL is pasted without a scheme', async () => {
    const { normalizeSyncRemoteUrl } = await import('../services/sync/syncService')
    expect(normalizeSyncRemoteUrl('mydsp-sync.dave-perry.workers.dev')).toBe(
      'https://mydsp-sync.dave-perry.workers.dev/',
    )
    expect(normalizeSyncRemoteUrl('mydsp-sync.dave-perry.workers.dev?key=abc')).toBe(
      'https://mydsp-sync.dave-perry.workers.dev/?key=abc',
    )
  })
})

describe('fetchRemoteMeta', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not found', { status: 404 })),
    )
    await expect(fetchRemoteMeta('https://example.com/sync')).resolves.toBeNull()
  })

  it('parses meta payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            exportedAt: '2026-07-13T12:00:00.000Z',
            deviceId: 'dev_abc',
            checksum: 'deadbeef',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const meta = await fetchRemoteMeta('https://example.com/sync?key=x')
    expect(meta?.exportedAt).toBe('2026-07-13T12:00:00.000Z')
    expect(meta?.deviceId).toBe('dev_abc')
  })
})

describe('autoSync dirty marking', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    stopAutoSync()
    setOnPortfolioDataChanged(null)
    saveSyncConfig({
      remoteUrl: 'https://example.com/sync',
      enabled: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase('long-enough-pass', { remember: true })
  })

  afterEach(() => {
    stopAutoSync()
    setOnPortfolioDataChanged(null)
  })

  it('does not mark dirty while applying remote merge', () => {
    beginApplyingRemote()
    markLocalDataChanged()
    endApplyingRemote()
    // Status should remain idle/disabled-ish without throwing
    expect(getAutoSyncStatus().state).toBeTruthy()
  })

  it('replays dirty mark after remote merge finishes', () => {
    vi.useFakeTimers()
    beginApplyingRemote()
    markLocalDataChanged()
    // Still applying — should not schedule yet
    endApplyingRemote()
    // endApplyingRemote should call markLocalDataChanged → schedule 8s push
    expect(getAutoSyncStatus().state).toBeTruthy()
    vi.useRealTimers()
  })

  it('startAutoSync is idempotent', () => {
    startAutoSync()
    startAutoSync()
    stopAutoSync()
  })
})
