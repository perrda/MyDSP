import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEmptyPortfolio } from '../domain/defaults'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import type { PortfolioData } from '../domain/types'
import {
  chooseFirstSyncAction,
  chooseSyncAction,
  localBookIsSourceOfTruth,
  mayPushOnEmptyCloud,
} from '../services/sync/localBook'
import { mergePortfolio } from '../services/sync/merge'
import {
  applyRemoteAsBook,
  DEFAULT_SYNC_REMOTE_URL,
  loadSyncConfig,
  saveSyncConfig,
  type MergePreview,
} from '../services/sync/syncService'

import { runOneButtonSync } from '../services/sync/oneButtonSync'

vi.mock('../services/sync/syncService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sync/syncService')>()
  return {
    ...actual,
    pushSync: vi.fn(async () => ({
      exportedAt: '2026-08-30T10:31:34.643Z',
      bytes: 122831,
    })),
  }
})
import {
  clearSessionSyncPassphrase,
  getSessionSyncPassphrase,
  hasRememberedSyncPassphrase,
  hydrateSessionSyncPassphrase,
  setSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'
import {
  emitHydratedAutoSyncStatus,
  getAutoSyncStatus,
  stopAutoSync,
} from '../services/sync/autoSyncService'
import { listPortfolios, loadPortfolio, savePortfolioImmediate } from '../storage/portfolioStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')
const PASS = 'long-enough-passphrase'

function leftoverDavid(): PortfolioData {
  const data = createEmptyPortfolio()
  data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.04, price: 0, cost: 2811 }]
  return data
}

function miniDavid(): PortfolioData {
  const data = createEmptyPortfolio()
  data.crypto = [
    { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 12.5, price: 85000, cost: 400_000 },
    { id: 2, symbol: 'ETH', name: 'Ethereum', qty: 40, price: 2500, cost: 80_000 },
  ]
  data.equities = [
    {
      id: 1,
      symbol: 'VWRL',
      name: 'Vanguard FTSE All-World',
      shares: 200,
      avgCost: 95,
      livePrice: 110,
    },
  ]
  return data
}

function seedLeftoverLocal(): void {
  localStorage.setItem(
    'fcc_portfolios',
    JSON.stringify([
      { id: 'default', name: 'David', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'extra_leftover', name: 'Leftover Extra', createdAt: '2024-01-01T00:00:00.000Z' },
    ]),
  )
  localStorage.setItem('fcc_active_portfolio', 'default')
  savePortfolioImmediate(leftoverDavid(), 'default')
  savePortfolioImmediate(createEmptyPortfolio(), 'extra_leftover')
}

function replacePreview(): MergePreview {
  const local = leftoverDavid()
  const remote = miniDavid()
  const mum = createEmptyPortfolio()
  mum.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.1, price: 0, cost: 5000 }]
  return {
    source: 'pull',
    portfolios: [
      {
        portfolioId: 'default',
        isNew: false,
        local,
        remote,
        conflicts: [
          {
            portfolioId: 'default',
            collection: 'crypto',
            id: 1,
            localLabel: 'BTC',
            remoteLabel: 'BTC',
          },
        ],
      },
      {
        portfolioId: 'mum',
        isNew: true,
        local: null,
        remote: mum,
        conflicts: [],
      },
    ],
    registryPortfolios: [
      { id: 'default', name: 'David', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'extra_leftover', name: 'Leftover Extra', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'mum', name: 'Mum', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    remoteRegistry: [
      { id: 'default', name: 'David', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'mum', name: 'Mum', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    activePortfolioId: 'default',
    conflicts: [
      {
        portfolioId: 'default',
        collection: 'crypto',
        id: 1,
        localLabel: 'BTC',
        remoteLabel: 'BTC',
      },
    ],
  }
}

describe('MyDSP 1.2.128 satellite replace Mini book', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.148')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.148')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.148',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
    ])
    const notes128 = RELEASE_NOTES.find((e) => e.version === '1.2.128')
    const tip = notes128?.bullets.map((b) => (typeof b === 'string' ? b : b.text)).join(' ')
    expect(tip).toMatch(/replace|PUT|Remember/i)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.128\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/1\.2\.128/)
    expect(section).toMatch(/REPLACE/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(DEFAULT_SYNC_REMOTE_URL).not.toMatch(/\?key=/)
  })

  it('book device always chooses push / PUT — lastSyncAt does not skip', () => {
    expect(chooseSyncAction({ isBookDevice: true })).toBe('push')
    expect(
      chooseFirstSyncAction({ localHasBook: true, alreadySynced: false, isBookDevice: true }),
    ).toBe('push')
    expect(
      chooseFirstSyncAction({ localHasBook: true, alreadySynced: true, isBookDevice: true }),
    ).toBe('push')
    expect(
      chooseFirstSyncAction({ localHasBook: false, alreadySynced: true, isBookDevice: true }),
    ).toBe('push')
    expect(chooseSyncAction({ isBookDevice: false })).toBe('pull')
    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/Book device always PUT/)
    expect(auto).toMatch(/dirty = true/)
  })

  it('satellite leftover DAVID is replaced by remote Mini — leftover holdings gone', async () => {
    localStorage.clear()
    seedLeftoverLocal()
    expect(loadPortfolio('default').crypto[0]?.qty).toBe(0.04)
    expect(loadPortfolio('default').crypto[0]?.cost).toBe(2811)

    const merged = mergePortfolio(leftoverDavid(), miniDavid())
    expect(merged.crypto.find((c) => c.id === 1)?.qty).toBe(0.04)

    await applyRemoteAsBook(replacePreview())
    const david = loadPortfolio('default')
    expect(david.crypto.find((c) => c.id === 1)?.qty).toBe(12.5)
    expect(david.crypto.find((c) => c.id === 1)?.cost).toBe(400_000)
    expect(david.equities.find((e) => e.symbol === 'VWRL')?.shares).toBe(200)
    const names = listPortfolios().map((p) => p.name)
    expect(names).toContain('David')
    expect(names).toContain('Mum')
    expect(names).not.toContain('Leftover Extra')
    expect(localStorage.getItem('dfc_data_v3_extra_leftover')).toBeNull()
  })

  it('satellite never PUTs leftover, including on 404 (empty/sample may seed)', async () => {
    expect(
      mayPushOnEmptyCloud({ isBookDevice: true, localHasRealBook: true }),
    ).toBe(true)
    expect(
      mayPushOnEmptyCloud({ isBookDevice: false, localHasRealBook: true }),
    ).toBe(false)
    expect(
      mayPushOnEmptyCloud({ isBookDevice: false, localHasRealBook: false }),
    ).toBe(true)

    localStorage.clear()
    clearSessionSyncPassphrase()
    seedLeftoverLocal()
    expect(localBookIsSourceOfTruth()).toBe(true)
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: false,
      thisDeviceIsTheBook: false,
      rememberPassphrase: false,
    })

    let putOrPost = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'PUT' || method === 'POST') {
          putOrPost += 1
          return new Response('ok', { status: 200 })
        }
        return new Response('Not found', { status: 404 })
      }),
    )

    await expect(runOneButtonSync(PASS)).rejects.toThrow(/leftover book was not uploaded/)
    expect(putOrPost).toBe(0)
    vi.unstubAllGlobals()
  })

  it('after successful one-button sync, remember+automatic persist and refresh hydrates', async () => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    stopAutoSync()
    localStorage.setItem(
      'fcc_portfolios',
      JSON.stringify([{ id: 'default', name: 'David', createdAt: '2024-01-01T00:00:00.000Z' }]),
    )
    savePortfolioImmediate(leftoverDavid(), 'default')
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      lastSyncAt: '2026-08-30T10:30:34.000Z',
      rememberPassphrase: false,
    })

    const result = await runOneButtonSync(PASS)
    expect(result.action).toBe('push')
    const cfg = loadSyncConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.rememberPassphrase).toBe(true)
    expect(cfg.lastSyncAt).toBeTruthy()
    expect(hasRememberedSyncPassphrase()).toBe(true)
    expect(getAutoSyncStatus().state).not.toBe('needs-passphrase')
    expect(getAutoSyncStatus().state).toBe('idle')

    setSessionSyncPassphrase(PASS)
    expect(hasRememberedSyncPassphrase()).toBe(true)

    clearSessionSyncPassphrase({ clearRemembered: false })
    expect(hydrateSessionSyncPassphrase()).toBe(PASS)
    expect(getSessionSyncPassphrase()).toBe(PASS)

    stopAutoSync()
    emitHydratedAutoSyncStatus()
    expect(getAutoSyncStatus().state).not.toBe('needs-passphrase')
    expect(getAutoSyncStatus().state).toBe('idle')
    expect(getAutoSyncStatus().message).toBe('Synced')

    stopAutoSync()
  })
})

describe('session passphrase refresh hydrate (1.2.128)', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
  })

  afterEach(() => {
    clearSessionSyncPassphrase()
  })

  it('push/pull setSessionSyncPassphrase without opts does not wipe remember', () => {
    setSessionSyncPassphrase(PASS, { remember: true })
    expect(hasRememberedSyncPassphrase()).toBe(true)
    setSessionSyncPassphrase(PASS)
    expect(hasRememberedSyncPassphrase()).toBe(true)
    clearSessionSyncPassphrase({ clearRemembered: false })
    expect(hydrateSessionSyncPassphrase()).toBe(PASS)
  })
})
