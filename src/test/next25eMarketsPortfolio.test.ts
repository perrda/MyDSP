import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

describe('next25e markets / portfolio items 6-10', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('6: equity and crypto rows show portfolio weight of included value', async () => {
    const concentration = await import('../domain/portfolioConcentration')
    const norm = await import('../domain/normalize')
    const data = norm.normalizePortfolio({
      version: 1,
      crypto: [
        { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 1, price: 60, cost: 20 },
        {
          id: 2,
          symbol: 'ETH',
          name: 'Ethereum',
          qty: 10,
          price: 10,
          cost: 50,
          includeInPortfolio: false,
        },
      ],
      equities: [
        { id: 1, symbol: 'TSLA', name: 'Tesla', shares: 2, avgCost: 10, livePrice: 20 },
      ],
    })
    expect(concentration.includedPortfolioHoldingValue(data)).toBe(100)
    expect(concentration.portfolioConcentrationHits(data, 50).map((h) => h.symbol)).toEqual(['BTC'])

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/Portfolio weight/)
    expect(equities).toMatch(/includedPortfolioHoldingValue/)
    expect(equities).toMatch(/portfolioWeightPct/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/Portfolio weight/)
    expect(crypto).toMatch(/includedPortfolioHoldingValue/)
    expect(crypto).toMatch(/portfolioWeightPct/)
  })

  it('7: EquitiesPage and CryptoPage have sticky symbol/name filters', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/holdings-in-list-search/)
    expect(equities).toMatch(/Search equity holdings by symbol or name/)
    expect(equities).toMatch(/matchesPortfolioSearch/)
    expect(equities).toMatch(/filteredHoldings/)
    expect(equities).toMatch(/mergeVisibleOrder/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/holdings-in-list-search/)
    expect(crypto).toMatch(/Search crypto holdings by symbol or name/)
    expect(crypto).toMatch(/matchesPortfolioSearch/)
    expect(crypto).toMatch(/filteredHoldings/)
    expect(crypto).toMatch(/mergeVisibleOrder/)
  })

  it('8: Markets watchlist rows link Owned chips to holding detail routes', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/ownedHoldingRouteByKey/)
    expect(markets).toMatch(/markets-owned-chip/)
    expect(markets).toMatch(/Owned/)
    expect(markets).toMatch(/`\/crypto\/\$\{c\.id\}`/)
    expect(markets).toMatch(/`\/equities\/\$\{e\.id\}`/)
  })

  it('9: HoldingDetailPage shows day change and mini sparkline from Markets quote cache', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/loadMarketQuotesCache/)
    expect(detail).toMatch(/holding-markets-quote-cache/)
    expect(detail).toMatch(/Markets day/)
    expect(detail).toMatch(/holding-markets-sparkline/)
    expect(detail).toMatch(/sparklineTrendFromSeries/)
  })

  it('10: concentration banner threshold defaults to 25% and is settings-adjustable', async () => {
    const concentration = await import('../domain/portfolioConcentration')
    expect(concentration.DEFAULT_PORTFOLIO_CONCENTRATION_PCT).toBe(25)
    expect(concentration.loadPortfolioConcentrationThresholdPct()).toBe(25)
    concentration.savePortfolioConcentrationThresholdPct(40)
    expect(concentration.loadPortfolioConcentrationThresholdPct()).toBe(40)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/portfolio-concentration-banner/)
    expect(equities).toMatch(/portfolioConcentrationHits/)
    expect(equities).toMatch(/Concentration:/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/portfolio-concentration-banner/)
    expect(crypto).toMatch(/portfolioConcentrationHits/)
    expect(crypto).toMatch(/Concentration:/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Portfolio concentration alert/)
    expect(settings).toMatch(/savePortfolioConcentrationThresholdPct/)
    expect(settings).toMatch(/Portfolio concentration threshold percent/)
  })
})
