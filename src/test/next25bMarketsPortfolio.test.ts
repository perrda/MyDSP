import { describe, expect, it, beforeEach, afterEach } from 'vitest'
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

describe('next25b markets / portfolio (6–10)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('6: marketSessionStatus returns Open/Closed for US equities and UK FTSE', async () => {
    const { marketSessionStatus, sessionVenueForSymbol } = await import('../domain/marketSession')
    expect(sessionVenueForSymbol('TSLA', 'equity')).toBe('US')
    expect(sessionVenueForSymbol('^FTSE', 'index')).toBe('UK')
    expect(sessionVenueForSymbol('BTC', 'crypto')).toBeNull()

    // Wednesday 15:00 ET → open; Saturday → closed
    const wedEt = new Date('2026-07-15T19:00:00.000Z') // 15:00 EDT
    const satEt = new Date('2026-07-18T19:00:00.000Z')
    expect(marketSessionStatus('TSLA', 'equity', wedEt)?.label).toBe('Open')
    expect(marketSessionStatus('TSLA', 'equity', satEt)?.label).toBe('Closed')

    const wedLondon = new Date('2026-07-15T12:00:00.000Z') // 13:00 BST
    expect(marketSessionStatus('^FTSE', 'index', wedLondon)?.label).toBe('Open')
    expect(marketSessionStatus('^FTSE', 'index', satEt)?.label).toBe('Closed')

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/marketSessionStatus/)
    expect(markets).toMatch(/session\.label/)
  })

  it('7: holdings drift detects >threshold % vs Markets cache', async () => {
    const drift = await import('../domain/holdingsDrift')
    expect(drift.DEFAULT_HOLDINGS_DRIFT_PCT).toBe(5)
    expect(drift.loadHoldingsDriftThresholdPct()).toBe(5)
    drift.saveHoldingsDriftThresholdPct(3)
    expect(drift.loadHoldingsDriftThresholdPct()).toBe(3)

    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    const t = store.addMarketTicker({ kind: 'equity', symbol: 'DRFT', name: 'Drift Co' })
    store.saveMarketQuotesCache(
      new Map([
        [
          t.id,
          {
            symbol: 'DRFT',
            kind: 'equity',
            last: 110,
            changeAbs: 0,
            changePct: 0,
            sparkline: [],
            unit: 'GBP',
            decimals: 2,
            source: 'test',
            updatedAt: new Date().toISOString(),
          },
        ],
      ]),
    )

    const hits = drift.equityDriftHits(
      [{ id: 1, symbol: 'DRFT', name: 'Drift Co', shares: 1, avgCost: 100, livePrice: 100 }],
      5,
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].driftPct).toBeCloseTo(10, 5)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/equityDriftHits/)
    expect(equities).toMatch(/Price drift vs Markets/)
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/cryptoDriftHits/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Holdings drift alert/)
    expect(settings).toMatch(/saveHoldingsDriftThresholdPct/)
  })

  it('8: MarketTicker tag persists and MarketsPage has filter chips', async () => {
    const domain = await import('../domain/markets')
    expect(domain.MARKET_TICKER_TAGS).toEqual(['Core', 'Speculative', 'Income', 'Other'])

    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    const t = store.addMarketTicker({
      kind: 'equity',
      symbol: 'TAG1',
      name: 'Tagged',
      tag: 'Core',
    })
    expect(t.tag).toBe('Core')
    store.updateMarketTicker(t.id, { tag: 'Income' })
    expect(store.listMarketTickers('equity').find((x) => x.id === t.id)?.tag).toBe('Income')
    store.updateMarketTicker(t.id, { tag: '' })
    expect(store.listMarketTickers('equity').find((x) => x.id === t.id)?.tag).toBeUndefined()

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/tagFilter/)
    expect(markets).toMatch(/MARKET_TICKER_TAGS/)
  })

  it('9: yieldPct on MarketTicker shows in Markets modal / rows wiring', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    const t = store.addMarketTicker({
      kind: 'equity',
      symbol: 'YLD',
      name: 'Yield Co',
      yieldPct: 2.4,
    })
    expect(t.yieldPct).toBe(2.4)
    store.updateMarketTicker(t.id, { yieldPct: null })
    expect(store.listMarketTickers('equity').find((x) => x.id === t.id)?.yieldPct).toBeUndefined()

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/yieldPct/)
    expect(markets).toMatch(/Dividend yield/)
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/Dividend yield/)
    expect(detail).toMatch(/yieldPct/)
  })

  it('10: compare week snapshot stores previous and computes delta', async () => {
    const snap = await import('../domain/compareWeekSnapshot')
    const key = snap.isoWeekKey(new Date('2026-07-15T12:00:00Z'))
    expect(key).toMatch(/^2026-W\d{2}$/)

    const s1 = snap.syncCompareWeekSnapshots(
      { default: 100_000 },
      new Date('2026-07-15T12:00:00Z'),
    )
    expect(s1.current.default).toBe(100_000)
    expect(Object.keys(s1.previous)).toHaveLength(0)
    expect(snap.weekOverWeekDelta('default', 105_000, s1)).toBeNull()

    // Roll to next ISO week → previous gets last current
    const nextWeek = new Date('2026-07-22T12:00:00Z')
    const s2 = snap.syncCompareWeekSnapshots({ default: 110_000 }, nextWeek)
    expect(s2.previous.default).toBe(100_000)
    expect(s2.current.default).toBe(110_000)
    expect(snap.weekOverWeekDelta('default', 112_000, s2)).toBe(12_000)

    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/weekOverWeekDelta/)
    expect(compare).toMatch(/Week Δ/)
    expect(compare).toMatch(/syncCompareWeekSnapshots/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.78')
  })
})
