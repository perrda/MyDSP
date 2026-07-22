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

describe('next25c markets / valuations (6–10)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('6: Markets density toggles Comfortable/Compact and normalizes legacy Heat', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    store.setMarketsDensity('compact')
    expect(store.getMarketsDensity()).toBe('compact')
    store.setMarketsDensity('comfortable')
    expect(store.getMarketsDensity()).toBe('comfortable')

    const key = 'mydsp_markets_v1'
    const legacyState = JSON.parse(mem.get(key)!)
    mem.set(key, JSON.stringify({ ...legacyState, density: 'heat' }))
    expect(store.getMarketsDensity()).toBe('comfortable')
    expect(JSON.parse(mem.get(key)!).density).toBe('comfortable')

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).not.toMatch(/markets-heat-grid/)
    expect(markets).not.toMatch(/marketsHeat|density === 'heat'|'Heat'/)
    expect(markets).toMatch(/density === 'comfortable' \? 'compact' : 'comfortable'/)
    expect(markets).toMatch(/Switch to compact density/)
    expect(markets).toMatch(/<ReorderList/)
    expect(markets).toMatch(/<Sparkline/)
  })

  it('7: per-section refresh filters tickers by kind', async () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/refreshSection/)
    expect(markets).toMatch(/RefreshCw/)
    expect(markets).toMatch(/refresh\(kind\)/)
    expect(markets).toMatch(/listMarketTickers\(kind\)/)
    expect(markets).toMatch(/aria-label=\{`Refresh \$\{meta\.title\}`\}/)
  })

  it('8: corporateActionNote on EquityHolding — detail edit + list badge', async () => {
    const types = readFileSync(resolve(__dirname, '../domain/types.ts'), 'utf8')
    expect(types).toMatch(/corporateActionNote\?: string/)

    const norm = await import('../domain/normalize')
    const empty = norm.normalizePortfolio({
      version: 1,
      equities: [
        {
          id: 1,
          symbol: 'ACME',
          name: 'Acme',
          shares: 10,
          avgCost: 1,
          livePrice: 1,
          corporateActionNote: '  2-for-1 split  ',
        },
      ],
    })
    expect(empty.equities[0]?.corporateActionNote).toBe('2-for-1 split')

    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/corporateActionNote/)
    expect(detail).toMatch(/Corporate action note/)
    expect(detail).toMatch(/id="corporate-action"/)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/corporateActionNote/)
    expect(equities).toMatch(/>\s*Corp\s*</)
  })

  it('9: Add from holding adds missing portfolio symbols via addMarketTicker', async () => {
    const addMod = await import('../domain/addHoldingsToWatchlist')
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()

    // Watchlist already has TSLA from defaults — HOLDX should be added
    const missing = addMod.holdingsMissingFromWatchlist(
      [
        { symbol: 'TSLA', name: 'Tesla' },
        { symbol: 'HOLDX', name: 'Hold X' },
      ],
      'equity',
    )
    expect(missing.map((m) => m.symbol)).toEqual(['HOLDX'])

    const result = addMod.addHoldingsMissingFromWatchlist(
      [
        { symbol: 'TSLA', name: 'Tesla' },
        { symbol: 'HOLDX', name: 'Hold X' },
      ],
      'equity',
    )
    expect(result.added).toEqual(['HOLDX'])
    expect(store.listMarketTickers('equity').some((t) => t.symbol === 'HOLDX')).toBe(true)

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/Add from holding/)
    expect(markets).toMatch(/addHoldingsMissingFromWatchlist/)
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/Add from holding/)
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/Add from holding/)
  })

  it('10: FX triangle warns when GBP/USD × EUR path disagrees', async () => {
    const fx = await import('../domain/fxTriangle')
    expect(fx.DEFAULT_FX_TRIANGLE_THRESHOLD_PCT).toBe(0.5)

    // Consistent: GBP/USD ≈ GBP/EUR × EUR/USD
    const ok = fx.checkFxTriangles([
      { symbol: 'GBP/USD', last: 1.27 },
      { symbol: 'GBP/EUR', last: 1.17 },
      { symbol: 'EUR/USD', last: 1.27 / 1.17 },
    ])
    expect(ok).toHaveLength(0)

    const bad = fx.checkFxTriangles([
      { symbol: 'GBP/USD', last: 1.27 },
      { symbol: 'GBP/EUR', last: 1.17 },
      { symbol: 'EUR/USD', last: 1.5 }, // way off
    ])
    expect(bad.length).toBeGreaterThanOrEqual(1)
    expect(bad[0]!.discrepancyPct).toBeGreaterThan(0.5)
    expect(fx.formatFxTriangleWarning(bad[0]!)).toMatch(/≠/)

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/checkFxTriangles/)
    expect(markets).toMatch(/markets-fx-triangle-banner/)
    expect(markets).toMatch(/FX triangle check/)
  })

  it('package version is 1.2.47', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.90')
  })
})
