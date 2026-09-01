import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEmptyPortfolio } from '../domain/defaults'
import {
  FAMILY_SLEEVES_APPLIED_EXTRA,
  FAMILY_SLEEVES_APPLIED_VERSION,
  familyBookMissingGiftedRows,
  hasFamilySleevesApplied,
} from '../domain/familyHoldingSleeves'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { applyRemoteAsBook, type MergePreview } from '../services/sync/syncService'
import {
  applyFamilyHoldingsToNamedBooks,
  listPortfolios,
  loadPortfolio,
  priceNamedFamilyBooksFromLastSynced,
  resetPortfolio,
  savePortfolioImmediate,
  savePortfolioPreservingFamilySleeve,
} from '../storage/portfolioStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

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

function qty(data: { crypto: { symbol: string; qty: number }[] }, symbol: string) {
  return data.crypto.find((c) => c.symbol === symbol)?.qty
}

function andrewReplacePreview(): MergePreview {
  const local = createEmptyPortfolio()
  const remote = createEmptyPortfolio()
  const emptyV2 = createEmptyPortfolio()
  emptyV2.extras = { [FAMILY_SLEEVES_APPLIED_EXTRA]: 'v2' }
  return {
    source: 'pull',
    portfolios: [
      { portfolioId: 'default', isNew: false, local, remote, conflicts: [] },
      { portfolioId: 'mum', isNew: true, local: null, remote: createEmptyPortfolio(), conflicts: [] },
      { portfolioId: 'andrew', isNew: true, local: null, remote: emptyV2, conflicts: [] },
    ],
    registryPortfolios: [
      { id: 'default', name: 'David', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'mum', name: 'Mum', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'andrew', name: 'Andrew', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    remoteRegistry: [
      { id: 'default', name: 'David', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'mum', name: 'Mum', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'andrew', name: 'Andrew', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    activePortfolioId: 'default',
    conflicts: [],
  }
}

describe('MyDSP 1.2.147 Andrew gifted figures land', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.160')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.160')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.160',
      '1.2.159',
      '1.2.158',
      '1.2.157',
      '1.2.156',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.147\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/v3/)
    expect(section).toMatch(/Andrew/)
    expect(section).toMatch(/295/)
    expect(section).toMatch(/14,285 ADA/)
    expect(section).toMatch(/Fund & Share/)
    expect(section).toMatch(/v2/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Andrew gifted figures land \(v1\.2\.147\)/)
    expect(read('../domain/familyHoldingSleeves.ts')).toMatch(/FAMILY_SLEEVES_APPLIED_VERSION = 'v3'/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.160/)
    expect(read('../storage/portfolioStore.ts')).toMatch(/savePortfolioPreservingFamilySleeve/)
    expect(read('../context/PortfolioContext.tsx')).toMatch(/savePortfolioPreservingFamilySleeve/)
    expect(read('../context/PortfolioContext.tsx')).toMatch(/priceNamedFamilyBooksFromLastSynced/)
    expect(FAMILY_SLEEVES_APPLIED_VERSION).toBe('v3')
  })
})

describe('Andrew v3 refill after leftover v2 stamp', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('refills Andrew when the book is empty but still stamped v2', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const andrew = store.listPortfolios().find((p) => p.name === 'Andrew')!
    const emptyV2 = createEmptyPortfolio()
    emptyV2.extras = { [FAMILY_SLEEVES_APPLIED_EXTRA]: 'v2' }
    store.savePortfolioImmediate(emptyV2, andrew.id)
    expect(store.loadPortfolio(andrew.id).equities).toHaveLength(0)
    expect(familyBookMissingGiftedRows(store.loadPortfolio(andrew.id), 'Andrew')).toBe(true)

    expect(store.applyFamilyHoldingsToNamedBooks()).toContain('Andrew')
    const filled = store.loadPortfolio(andrew.id)
    expect(filled.equities.map((e) => [e.symbol, e.shares, e.accountType ?? 'general'])).toEqual([
      ['TSLA', 295, 'sipp'],
      ['MSTR', 197, 'sipp'],
      ['TSLA', 135, 'general'],
      ['MSTR', 112, 'general'],
    ])
    expect(qty(filled, 'ADA')).toBe(14285)
    expect(qty(filled, 'BTC')).toBeUndefined()
    expect(hasFamilySleevesApplied(filled)).toBe(true)
    expect(familyBookMissingGiftedRows(filled, 'Andrew')).toBe(false)
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
  })

  it('REPLACE of empty v2 Andrew still lands gifted shares', async () => {
    localStorage.clear()
    savePortfolioImmediate(createEmptyPortfolio(), 'default')
    await applyRemoteAsBook(andrewReplacePreview())
    const andrew = listPortfolios().find((p) => p.name === 'Andrew')!
    const filled = loadPortfolio(andrew.id)
    expect(filled.equities.map((e) => [e.symbol, e.shares, e.accountType ?? 'general'])).toEqual([
      ['TSLA', 295, 'sipp'],
      ['MSTR', 197, 'sipp'],
      ['TSLA', 135, 'general'],
      ['MSTR', 112, 'general'],
    ])
    expect(qty(filled, 'ADA')).toBe(14285)
    const mum = listPortfolios().find((p) => p.name === 'Mum')!
    expect(loadPortfolio(mum.id).equities.find((e) => e.symbol === 'TSLA')?.shares).toBe(109)
  })

  it('prices already-stamped Andrew from last-synced Markets marks', async () => {
    const store = await import('../storage/portfolioStore')
    const marketsStore = await import('../storage/marketsStore')
    const markets = await import('../domain/markets')
    store.bootstrapFamilyPortfolios()
    marketsStore.loadMarketsState()
    const tsla = marketsStore.listMarketTickers('equity').find((t) => t.symbol === 'TSLA')
    const ada =
      marketsStore.listMarketTickers('crypto').find((t) => t.symbol === 'ADA') ??
      marketsStore.addMarketTicker({ kind: 'crypto', symbol: 'ADA', name: 'Cardano' })
    expect(tsla && ada).toBeTruthy()
    const now = new Date().toISOString()
    marketsStore.saveMarketQuotesCache(
      new Map([
        [
          tsla!.id,
          {
            symbol: 'TSLA',
            kind: 'equity',
            last: 200,
            changeAbs: 1,
            changePct: 0.5,
            sparkline: [199, 200],
            unit: 'GBP',
            decimals: 2,
            source: 'finnhub',
            updatedAt: now,
          } satisfies markets.MarketQuote,
        ],
        [
          ada!.id,
          {
            symbol: 'ADA',
            kind: 'crypto',
            last: 0.5,
            changeAbs: 0.01,
            changePct: 2,
            sparkline: [0.49, 0.5],
            unit: 'GBP',
            decimals: 4,
            source: 'coingecko',
            updatedAt: now,
          } satisfies markets.MarketQuote,
        ],
      ]),
    )

    const andrew = store.listPortfolios().find((p) => p.name === 'Andrew')!
    const book = store.loadPortfolio(andrew.id)
    store.savePortfolioImmediate(
      {
        ...book,
        equities: book.equities.map((e) => ({ ...e, livePrice: 0 })),
        crypto: book.crypto.map((c) => ({ ...c, price: 0 })),
        extras: { ...book.extras, [FAMILY_SLEEVES_APPLIED_EXTRA]: FAMILY_SLEEVES_APPLIED_VERSION },
      },
      andrew.id,
    )
    expect(store.loadPortfolio(andrew.id).equities.every((e) => e.livePrice === 0)).toBe(true)
    expect(priceNamedFamilyBooksFromLastSynced()).toContain('Andrew')
    const priced = store.loadPortfolio(andrew.id)
    expect(priced.equities.filter((e) => e.symbol === 'TSLA').every((e) => e.livePrice === 200)).toBe(true)
    expect(priced.crypto.find((c) => c.symbol === 'ADA')?.price).toBe(0.5)
  })

  it('does not let a stale empty snapshot overwrite Andrew’s gifted rows', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const andrew = store.listPortfolios().find((p) => p.name === 'Andrew')!
    expect(store.loadPortfolio(andrew.id).equities).toHaveLength(4)
    savePortfolioPreservingFamilySleeve(createEmptyPortfolio(), andrew.id)
    expect(store.loadPortfolio(andrew.id).equities).toHaveLength(4)
    expect(qty(store.loadPortfolio(andrew.id), 'ADA')).toBe(14285)
  })

  it('does not refill Andrew after Reset on this build', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const andrew = store.listPortfolios().find((p) => p.name === 'Andrew')!
    resetPortfolio(andrew.id)
    expect(store.loadPortfolio(andrew.id).equities).toHaveLength(0)
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
    expect(store.loadPortfolio(andrew.id).equities).toHaveLength(0)
    expect(hasFamilySleevesApplied(store.loadPortfolio(andrew.id))).toBe(true)
  })
})
