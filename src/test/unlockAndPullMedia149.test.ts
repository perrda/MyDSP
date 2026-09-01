import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { satelliteNeedsMediaUnlock } from '../services/sync/mediaUnlock'
import { unlockAndPullFromCloud } from '../services/sync/oneButtonSync'
import { clearSessionSyncPassphrase } from '../services/sync/sessionPassphrase'
import { saveSyncConfig, type SyncConfig } from '../services/sync/syncService'

const PASS = 'long-enough-passphrase'

function cfg(partial: Partial<SyncConfig>): SyncConfig {
  return {
    remoteUrl: '',
    enabled: false,
    ...partial,
  }
}

describe('satelliteNeedsMediaUnlock', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
  })

  it('hides on Mini (book) and on a first-run empty satellite', () => {
    expect(satelliteNeedsMediaUnlock(cfg({ thisDeviceIsTheBook: true }), { state: 'needs-passphrase' })).toBe(
      false,
    )
    expect(satelliteNeedsMediaUnlock(cfg({}), { state: 'disabled' })).toBe(false)
  })

  it('shows on a satellite with Automatic off but a Remote URL (MacBook leftover)', () => {
    expect(
      satelliteNeedsMediaUnlock(cfg({ remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev' }), {
        state: 'disabled',
      }),
    ).toBe(true)
    expect(
      satelliteNeedsMediaUnlock(cfg({ enabled: true, lastSyncAt: '2026-09-01T12:00:00.000Z' }), {
        state: 'needs-passphrase',
      }),
    ).toBe(true)
  })

  it('shows when the passphrase is remembered but this Mac has never pulled', () => {
    expect(
      satelliteNeedsMediaUnlock(
        cfg({ remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev' }),
        { state: 'idle' },
        true,
      ),
    ).toBe(true)
  })

  it('hides after a successful pull even with the passphrase remembered', () => {
    expect(
      satelliteNeedsMediaUnlock(
        cfg({
          remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
          lastSyncAt: '2026-09-01T12:00:00.000Z',
        }),
        { state: 'idle' },
        true,
      ),
    ).toBe(false)
  })

  it('still shows after a media-only extras stamp — leftover holdings have not REPLACE’d', () => {
    expect(
      satelliteNeedsMediaUnlock(
        cfg({
          remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
          lastWorkspaceExtrasSyncAt: '2026-09-01T16:00:00.000Z',
        }),
        { state: 'idle' },
        true,
      ),
    ).toBe(true)
  })
})

describe('unlockAndPullFromCloud never PUTs', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: false,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('pulls extras and does not PUT even if this Mac is wrongly marked the book', async () => {
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: true,
    })
    const methods: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const method = (init?.method ?? 'GET').toUpperCase()
        methods.push(method)
        if (method === 'PUT' || method === 'POST') {
          return new Response('should-not-push', { status: 200 })
        }
        return new Response('Not found', { status: 404 })
      }),
    )

    await expect(unlockAndPullFromCloud(PASS)).rejects.toThrow(/404|not found/i)
    expect(methods.some((m) => m === 'PUT' || m === 'POST')).toBe(false)
  })
})
