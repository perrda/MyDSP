import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25d markets / portfolio items 6-10', () => {
  it('6: Markets has sticky in-list search by symbol/name', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/markets-in-list-search/)
    expect(markets).toMatch(/Search watchlist by symbol or name/)
    expect(markets).toMatch(/matchesMarketsSearch/)
    expect(markets).toMatch(/filteredTickerCount/)
    expect(markets).toMatch(/No \$\{meta\.emptyLabel\} matches/)
  })

  it('7: watchlist dividend yield displays and can sort by yield', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/sortByYieldDesc/)
    expect(markets).toMatch(/yieldSort/)
    expect(markets).toMatch(/Sort equity watchlist by dividend yield/)
    expect(markets).toMatch(/>\s*Yield %\s*</)
    expect(markets).toMatch(/Yield \{t\.yieldPct\.toFixed/)
  })

  it('8: holdings drift amber UI can use Markets last quote in one tap', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/Use Markets prices/)
    expect(equities).toMatch(/Use Markets price/)
    expect(equities).toMatch(/applyMarketsPriceForEquity/)
    expect(equities).toMatch(/driftHit\.marketPrice/)
    expect(equities).toMatch(/appendHoldingPrices/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/Use Markets prices/)
    expect(crypto).toMatch(/Use Markets price/)
    expect(crypto).toMatch(/applyMarketsPriceForCrypto/)
    expect(crypto).toMatch(/driftHit\.marketPrice/)
    expect(crypto).toMatch(/appendHoldingPrices/)
  })

  it('9: corporate-action note has optional effective date and due toast', async () => {
    const types = readFileSync(resolve(__dirname, '../domain/types.ts'), 'utf8')
    expect(types).toMatch(/corporateActionDate\?: string/)

    const norm = await import('../domain/normalize')
    const portfolio = norm.normalizePortfolio({
      version: 1,
      equities: [
        {
          id: 1,
          symbol: 'ACME',
          name: 'Acme',
          shares: 10,
          avgCost: 1,
          livePrice: 1,
          corporateActionNote: ' Split ',
          corporateActionDate: '2026-07-16',
        },
      ],
    })
    expect(portfolio.equities[0]?.corporateActionDate).toBe('2026-07-16')

    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/Effective date \(optional\)/)
    expect(detail).toMatch(/corpActionDateDraft/)
    expect(detail).toMatch(/corporateActionDate/)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/isCorporateActionDue/)
    expect(equities).toMatch(/Corporate action due/)
    expect(equities).toMatch(/Effective \{formatDate\(e\.corporateActionDate\)\}/)
  })

  it('10: FX triangle failure shows suggested cross and Use suggested', async () => {
    const fx = await import('../domain/fxTriangle')
    const bad = fx.checkFxTriangles([
      { symbol: 'GBP/USD', last: 1.27 },
      { symbol: 'GBP/EUR', last: 1.17 },
      { symbol: 'EUR/USD', last: 1.5 },
    ])
    expect(bad.length).toBeGreaterThanOrEqual(1)
    expect(fx.formatFxTriangleSuggestedRate(bad[0]!)).toMatch(/EUR\/USD/)

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/Suggested cross/)
    expect(markets).toMatch(/Use suggested/)
    expect(markets).toMatch(/formatFxTriangleSuggestedRate/)
    expect(markets).toMatch(/fx-triangle-suggested/)
  })
})
