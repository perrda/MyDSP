import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldPushCloudAfterBackup } from '../storage/backupStore'
import { satelliteNeedsMediaUnlock } from '../services/sync/mediaUnlock'
import { flushQueuedSyncPush } from '../services/sync/oneButtonSync'
import { clearSessionSyncPassphrase } from '../services/sync/sessionPassphrase'
import { saveSyncConfig } from '../services/sync/syncService'
import { importMarketsFromBackup, loadMarketsState, listMarketTickers } from '../storage/marketsStore'

const PASS = 'long-enough-passphrase'

describe('Mini Backup pushes extras even when Automatic is off', () => {
  it('book + passphrase + URL — Automatic off still pushes', () => {
    expect(
      shouldPushCloudAfterBackup(
        {
          remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
          thisDeviceIsTheBook: true,
        },
        PASS,
      ),
    ).toBe(true)
  })

  it('satellite never pushes from Backup', () => {
    expect(
      shouldPushCloudAfterBackup(
        {
          remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
          thisDeviceIsTheBook: false,
        },
        PASS,
      ),
    ).toBe(false)
  })

  it('book without passphrase does not push', () => {
    expect(
      shouldPushCloudAfterBackup(
        {
          remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
          thisDeviceIsTheBook: true,
        },
        null,
      ),
    ).toBe(false)
  })
})

describe('flushQueuedSyncPush is pull-only on a satellite', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: false,
      thisDeviceIsTheBook: false,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not PUT leftover YouTube over Mini', async () => {
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
    await expect(flushQueuedSyncPush('https://mydsp-sync.dave-perry.workers.dev', PASS)).rejects.toThrow(
      /404|not found/i,
    )
    expect(methods.some((m) => m === 'PUT' || m === 'POST')).toBe(false)
  })
})

describe('Markets same-symbol rows last-write-wins from Mini', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('satellite leftover notes lose to a newer Mini row', () => {
    loadMarketsState()
    const localBtc = listMarketTickers('crypto').find((t) => t.symbol === 'BTC')
    expect(localBtc).toBeTruthy()
    importMarketsFromBackup({
      version: 1,
      tickers: [
        {
          ...localBtc!,
          notes: 'Mini sleeve note',
          updatedAt: '2026-09-01T16:00:00.000Z',
          createdAt: localBtc!.createdAt,
        },
      ],
      collapsed: {
        crypto: false,
        equities: false,
        commodities: false,
        indices: false,
        fx: false,
        crosses: false,
      },
      deletedTickers: [],
    })
    expect(listMarketTickers('crypto').find((t) => t.symbol === 'BTC')?.notes).toBe('Mini sleeve note')
  })
})

describe('Unlock banner vs remembered passphrase', () => {
  it('still needs Unlock when Automatic is off and lastSyncAt is missing', () => {
    expect(
      satelliteNeedsMediaUnlock(
        {
          remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
          enabled: false,
          lastSyncAt: undefined,
        },
        { state: 'disabled' },
        true,
      ),
    ).toBe(true)
  })
})
