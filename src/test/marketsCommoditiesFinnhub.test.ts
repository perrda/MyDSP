import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyPortfolio } from '../domain/defaults'
import {
  commodityDisplayName,
  normalizeCommoditySymbol,
} from '../domain/commodities'
import {
  completeFinnhubSetupTodo,
  ensureFinnhubSetupTodo,
  FINNHUB_TODO_TAG,
  FINNHUB_TODO_TITLE,
  findOpenFinnhubTodo,
  hasFinnhubKey,
} from '../domain/finnhubReminder'
import {
  createEmptyMarketsState,
  formatMarketLast,
  mergeDefaultTickers,
  normalizeMarketSymbol,
  type MarketQuote,
} from '../domain/markets'
import { marketSessionStatus } from '../domain/marketSession'
import { buildNextActionStack } from '../domain/nextActionStack'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

describe('My Commodities + Finnhub reminder (v1.2.69)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('normalizes commodity aliases to Yahoo futures/spot symbols', () => {
    expect(normalizeCommoditySymbol('GOLD')).toBe('GC=F')
    expect(normalizeCommoditySymbol('silver')).toBe('SI=F')
    expect(normalizeCommoditySymbol('COPPER')).toBe('HG=F')
    expect(normalizeCommoditySymbol('gc=f')).toBe('GC=F')
    expect(normalizeCommoditySymbol('XAUUSD')).toBe('XAUUSD=X')
    expect(normalizeMarketSymbol('GOLD')).toBe('GC=F')
    expect(commodityDisplayName('GC=F')).toBe('Gold')
  })

  it('seeds Gold / Silver / Copper on empty Markets and merges into legacy watchlists', () => {
    const empty = createEmptyMarketsState()
    const commodities = empty.tickers.filter((t) => t.kind === 'commodity')
    expect(commodities.map((t) => t.symbol)).toEqual(
      expect.arrayContaining(['GC=F', 'SI=F', 'HG=F']),
    )
    expect(empty.collapsed.commodities).toBe(false)

    const legacy = mergeDefaultTickers({
      version: 1,
      tickers: [
        {
          id: 'mkt_crypto_btc',
          kind: 'crypto',
          symbol: 'BTC',
          name: 'Bitcoin',
          createdAt: '2026-01-01',
          sortOrder: 0,
        },
      ],
      collapsed: { crypto: false, equities: false } as never,
    })
    expect(legacy.state.tickers.some((t) => t.kind === 'commodity' && t.symbol === 'GC=F')).toBe(
      true,
    )
    expect(legacy.added).toEqual(expect.arrayContaining(['GC=F', 'SI=F', 'HG=F']))
    expect(legacy.state.collapsed.commodities).toBe(false)
  })

  it('formats commodity quotes in GBP like equities', () => {
    const q: MarketQuote = {
      symbol: 'GC=F',
      kind: 'commodity',
      last: 2100,
      changeAbs: 12,
      changePct: 0.57,
      sparkline: [2000, 2050, 2100],
      unit: 'GBP',
      decimals: 2,
      source: 'yahoo',
      updatedAt: new Date().toISOString(),
    }
    expect(formatMarketLast(q)).toMatch(/£|GBP|2,?100/)
  })

  it('shows Open/Closed session chips for COMEX commodities (US hours)', () => {
    const wedEt = new Date('2026-07-15T15:00:00Z') // Wed ~11:00 ET
    const satEt = new Date('2026-07-18T15:00:00Z')
    expect(marketSessionStatus('GC=F', 'commodity', wedEt)?.venue).toBe('US')
    expect(marketSessionStatus('GC=F', 'commodity', wedEt)?.label).toBe('Open')
    expect(marketSessionStatus('SI=F', 'commodity', satEt)?.label).toBe('Closed')
  })

  it('adds a high-priority due-today Finnhub To Do when no key is set', () => {
    const data = createEmptyPortfolio()
    expect(hasFinnhubKey(data)).toBe(false)
    const next = ensureFinnhubSetupTodo(data, new Date('2026-07-16T12:00:00Z'))
    expect(next).not.toBeNull()
    const todo = findOpenFinnhubTodo(next!)
    expect(todo?.title).toBe(FINNHUB_TODO_TITLE)
    expect(todo?.priority).toBe('high')
    expect(todo?.dueDate).toBe('2026-07-16')
    expect(todo?.tags).toEqual(expect.arrayContaining([FINNHUB_TODO_TAG, 'setup', 'markets']))
    expect(ensureFinnhubSetupTodo(next!)).toBeNull()
  })

  it('skips Finnhub To Do when a key exists and completes it on save', () => {
    const withKey = {
      ...createEmptyPortfolio(),
      settings: { ...createEmptyPortfolio().settings, finnhubKey: 'abc123' },
    }
    expect(hasFinnhubKey(withKey)).toBe(true)
    expect(ensureFinnhubSetupTodo(withKey)).toBeNull()

    const open = ensureFinnhubSetupTodo(createEmptyPortfolio(), new Date('2026-07-16T12:00:00Z'))!
    const done = completeFinnhubSetupTodo(open)
    expect(findOpenFinnhubTodo(done)).toBeUndefined()
    expect(done.todoItems?.find((t) => t.tags?.includes(FINNHUB_TODO_TAG))?.status).toBe('done')
  })

  it('prefers high-priority todos in the Today next-action stack', () => {
    const now = new Date()
    const dueToday = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
    const data = ensureFinnhubSetupTodo(createEmptyPortfolio(), now)!
    const finnhub = { ...data.todoItems![0]!, dueDate: dueToday }
    const low = {
      ...finnhub,
      id: 'low1',
      title: 'Low priority chore',
      priority: 'low' as const,
      dueDate: dueToday,
      status: 'todo' as const,
      tags: [] as string[],
    }
    const stack = buildNextActionStack({
      todoItems: [low, finnhub],
      now,
    })
    expect(stack[0]?.kind).toBe('todo')
    if (stack[0]?.kind === 'todo') {
      expect(stack[0].todo.title).toBe(FINNHUB_TODO_TITLE)
      expect(stack[0].label).toBe('Due today')
    }
  })

  it('Markets page exposes My Commodities section meta', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/My Commodities/)
    expect(page).toMatch(/kind: 'commodity'/)
    expect(page).toMatch(/GC=F/)
  })

  it('commodity quotes use Yahoo chart path (not Finnhub stock quote)', async () => {
    const prices = await import('../services/prices')
    expect(prices.fetchCommodityMarketQuote).toBeTypeOf('function')
    const src = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(src).toMatch(/fetchCommodityMarketQuote/)
    expect(src).toMatch(/fetchYahooChartQuote/)
    const quotes = readFileSync(resolve(__dirname, '../services/marketsQuotes.ts'), 'utf8')
    expect(quotes).toMatch(/fetchCommodityMarketQuote/)
    expect(quotes).toMatch(/kind === 'commodity'/)
  })

  it('package version is tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.92')
  })
})

describe('markets store commodities CRUD', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('adds commodity tickers and rejects bad symbols', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    // Defaults already include GC=F — add platinum
    const pl = store.addMarketTicker({
      kind: 'commodity',
      symbol: 'PLATINUM',
      name: '',
    })
    expect(pl.symbol).toBe('PL=F')
    expect(pl.name).toMatch(/Platinum/i)

    expect(() =>
      store.addMarketTicker({ kind: 'commodity', symbol: 'GC=F', name: 'dup' }),
    ).toThrow(/already/i)

    expect(() =>
      store.addMarketTicker({ kind: 'commodity', symbol: '!!!', name: 'bad' }),
    ).toThrow(/commodity/i)
  })

  it('seeds commodities on first load', async () => {
    const store = await import('../storage/marketsStore')
    const state = store.loadMarketsState()
    expect(store.listMarketTickers('commodity').map((t) => t.symbol)).toEqual(
      expect.arrayContaining(['GC=F', 'SI=F', 'HG=F']),
    )
    expect(state.collapsed.commodities).toBe(false)
  })
})
