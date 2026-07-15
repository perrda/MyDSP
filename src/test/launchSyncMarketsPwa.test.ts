import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_LAUNCH_PATH,
  isAllowedLaunchPath,
  loadLaunchPath,
  saveLaunchPath,
} from '../storage/launchPathStore'
import { summarizeConflict, summarizeConflictBatch, type SyncConflict } from '../services/sync/conflicts'
import { appendSyncActivity, loadSyncActivity } from '../services/sync/syncActivity'
import { applyLastSyncedQuotesToHoldings } from '../domain/lastSyncedHoldings'
import { createEmptyPortfolio } from '../domain/defaults'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('launch path preference', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('defaults to Overview (/)', () => {
    expect(loadLaunchPath()).toBe(DEFAULT_LAUNCH_PATH)
    expect(DEFAULT_LAUNCH_PATH).toBe('/')
  })

  it('persists an allowed path and rejects unknown ones', () => {
    saveLaunchPath('/markets')
    expect(loadLaunchPath()).toBe('/markets')
    expect(isAllowedLaunchPath('/markets')).toBe(true)
    saveLaunchPath('/not-a-real-route')
    expect(loadLaunchPath()).toBe(DEFAULT_LAUNCH_PATH)
  })
})

describe('sync conflict summaries', () => {
  it('summarizes a single conflict in plain English', () => {
    const c: SyncConflict = {
      portfolioId: 'default',
      collection: 'todoItems',
      id: 1,
      localLabel: 'Call bank',
      remoteLabel: 'Call bank',
      fieldDiffs: [
        { field: 'status', local: 'todo', remote: 'done' },
        { field: 'priority', local: 'high', remote: 'medium' },
      ],
    }
    const s = summarizeConflict(c)
    expect(s).toMatch(/to-do/i)
    expect(s).toMatch(/Call bank/)
    expect(s).toMatch(/status/)
  })

  it('batches conflict counts by collection', () => {
    const conflicts: SyncConflict[] = [
      {
        portfolioId: 'default',
        collection: 'todoItems',
        id: 1,
        localLabel: 'A',
        remoteLabel: 'A',
      },
      {
        portfolioId: 'default',
        collection: 'todoItems',
        id: 2,
        localLabel: 'B',
        remoteLabel: 'B',
      },
      {
        portfolioId: 'default',
        collection: 'crypto',
        id: 3,
        localLabel: 'BTC',
        remoteLabel: 'BTC',
      },
    ]
    expect(summarizeConflictBatch(conflicts)).toMatch(/3 conflicts/)
    expect(summarizeConflictBatch(conflicts)).toMatch(/2 to-do/)
    expect(summarizeConflictBatch([])).toBe('No conflicts.')
  })
})

describe('sync activity ring buffer', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('appends newest first and caps length', () => {
    expect(loadSyncActivity()).toEqual([])
    appendSyncActivity({ source: 'pull', message: 'Pulled from Mac' })
    appendSyncActivity({ source: 'push', message: 'Pushed to cloud', merged: 2 })
    const list = loadSyncActivity()
    expect(list[0]?.message).toBe('Pushed to cloud')
    expect(list[0]?.merged).toBe(2)
    expect(list[1]?.message).toBe('Pulled from Mac')
  })
})

describe('markets watchlist union import', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('keeps local tickers and appends remote-only symbols', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    const before = store.listMarketTickers().length

    store.addMarketTicker({
      kind: 'fx',
      symbol: 'AUD/USD',
      name: 'Aussie Dollar',
    })

    const remoteOnly = {
      version: 1 as const,
      tickers: [
        {
          id: 'remote_nzd',
          kind: 'fx' as const,
          symbol: 'NZD/USD',
          name: 'Kiwi',
          sortOrder: 99,
        },
        {
          id: 'remote_aud',
          kind: 'fx' as const,
          symbol: 'AUD/USD',
          name: 'Should not replace local',
          sortOrder: 1,
        },
      ],
      collapsed: {
        crypto: false,
        equities: false,
        indices: false,
        fx: false,
        crosses: false,
      },
    }

    store.importMarketsFromBackup(remoteOnly)
    const fx = store.listMarketTickers('fx')
    expect(fx.some((t) => t.symbol === 'NZD/USD')).toBe(true)
    expect(fx.find((t) => t.symbol === 'AUD/USD')?.name).toBe('Aussie Dollar')
    expect(store.listMarketTickers().length).toBeGreaterThanOrEqual(before + 1)
  })
})

describe('applyLastSyncedQuotesToHoldings', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('fills zero crypto prices from Markets quote cache', async () => {
    const store = await import('../storage/marketsStore')
    const domain = await import('../domain/markets')
    store.loadMarketsState()
    const btc = store.listMarketTickers('crypto').find((t) => t.symbol === 'BTC')
    expect(btc).toBeTruthy()
    const quote: domain.MarketQuote = {
      symbol: 'BTC',
      kind: 'crypto',
      last: 50000,
      changeAbs: 100,
      changePct: 0.2,
      sparkline: [49000, 50000],
      unit: 'GBP',
      decimals: 2,
      source: 'coingecko',
      updatedAt: new Date().toISOString(),
    }
    store.saveMarketQuotesCache(new Map([[btc!.id, quote]]))

    const data = createEmptyPortfolio()
    data.crypto = [
      {
        id: 1,
        symbol: 'BTC',
        name: 'Bitcoin',
        qty: 1,
        price: 0,
        cost: 1000,
        includeInPortfolio: true,
        sortOrder: 0,
      },
    ]

    const result = applyLastSyncedQuotesToHoldings(data, { overwrite: false })
    expect(result.crypto).toBe(1)
    expect(result.data.crypto[0]?.price).toBe(50000)
  })
})
