import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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

describe('markets watchlist store', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('seeds default tickers and supports CRUD', async () => {
    const store = await import('../storage/marketsStore')
    const state = store.loadMarketsState()
    expect(state.tickers.length).toBeGreaterThanOrEqual(4)
    expect(store.listMarketTickers('crypto').some((t) => t.symbol === 'BTC')).toBe(true)

    const added = store.addMarketTicker({
      kind: 'equity',
      symbol: 'AAPL',
      name: 'Apple Inc.',
    })
    expect(added.symbol).toBe('AAPL')
    expect(() =>
      store.addMarketTicker({ kind: 'equity', symbol: 'aapl', name: 'Apple' }),
    ).toThrow(/already/i)

    store.updateMarketTicker(added.id, { name: 'Apple' })
    expect(store.listMarketTickers('equity').find((t) => t.id === added.id)?.name).toBe('Apple')

    store.removeMarketTicker(added.id)
    expect(store.listMarketTickers('equity').some((t) => t.symbol === 'AAPL')).toBe(false)
  })

  it('exports and imports backup payload', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    store.addMarketTicker({ kind: 'crypto', symbol: 'SOL', name: 'Solana' })
    const exported = store.exportMarketsForBackup()
    mem.clear()
    store.importMarketsFromBackup(exported)
    expect(store.listMarketTickers('crypto').some((t) => t.symbol === 'SOL')).toBe(true)
  })
})
