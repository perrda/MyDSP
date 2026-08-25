import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyCryptoCostFallback } from '../domain/calc'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import {
  includedPortfolioHoldingValue,
  portfolioConcentrationHits,
} from '../domain/portfolioConcentration'
import { normalizePortfolio } from '../domain/normalize'

describe('cheap rail fixes (v1.2.117)', () => {
  it('does not leave USDC at 0 after BTC/ETH have live prints', () => {
    const data = createEmptyPortfolio()
    data.crypto = [
      { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 80000, cost: 2000 },
      { id: 2, symbol: 'ETH', name: 'Ethereum', qty: 1.5, price: 2000, cost: 3500 },
      { id: 3, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 },
    ]
    const next = applyCryptoCostFallback(data)
    expect(next.crypto.find((c) => c.symbol === 'USDC')?.price).toBe(1)
    expect(next.crypto.find((c) => c.symbol === 'BTC')?.price).toBe(80000)
  })

  it('keeps VWRL off the crypto concentration banner and holds a stable crypto %', () => {
    const sample = normalizePortfolio(createSamplePortfolio())
    const unquoted = portfolioConcentrationHits(sample, 25, ['crypto'])
    expect(unquoted.map((h) => h.symbol)).not.toContain('VWRL')
    expect(unquoted.map((h) => h.kind)).toEqual(expect.arrayContaining(['crypto']))
    const eth = unquoted.find((h) => h.symbol === 'ETH')
    expect(eth?.weightPct).toBeCloseTo((3500 / 6500) * 100, 5)

    const hydrated = {
      ...sample,
      crypto: sample.crypto.map((c) =>
        c.symbol === 'BTC'
          ? { ...c, price: 80000 }
          : c.symbol === 'ETH'
            ? { ...c, price: 2000 }
            : c,
      ),
    }
    const after = portfolioConcentrationHits(hydrated, 25, ['crypto'])
    expect(after.map((h) => h.symbol)).not.toContain('VWRL')
    const fullHits = portfolioConcentrationHits(hydrated, 25)
    const vwrl = fullHits.find((h) => h.symbol === 'VWRL')
    expect(vwrl).toBeTruthy()
    expect(vwrl!.weightPct).not.toBeCloseTo(67.9, 0)
    expect(vwrl!.weightPct).not.toBeCloseTo(37.6, 0)
  })

  it('uses cost fallback in included portfolio value so USDC is not 0% weight', () => {
    const sample = normalizePortfolio(createSamplePortfolio())
    expect(includedPortfolioHoldingValue(sample, ['crypto'])).toBe(6500)
    expect(includedPortfolioHoldingValue(sample)).toBe(6500 + 50 * 95 + 30 * 75)
  })

  it('Today accordion sections expose the chip id (not only -panel)', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/<section\s+id=\{id\}/)
    expect(dash).toMatch(/id="today-media"/)
    expect(dash).toMatch(/id="today-next-action"/)
    expect(dash).toMatch(/id="today-daily-plan"/)
    expect(dash).toMatch(/id="today-bills"/)
    expect(dash).toMatch(/id="today-goals"/)
  })

  it('routes /household to Family instead of the Today catch-all', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')
    expect(app).toMatch(/path="household"\s+element=\{<FamilyPage/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/pathname === '\/household'/)
    expect(shell).toMatch(/'\/household': \{ eyebrow: 'Household'/)
  })

  it('keeps /markets?symbol= until a watchlist hit (does not strip on miss)', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    const focus = page.slice(page.indexOf('Deep-link: /markets?symbol='))
    const stripAt = focus.indexOf('setSearchParams({}, { replace: true })')
    const missAt = focus.indexOf('if (!hit) return')
    expect(missAt).toBeGreaterThan(-1)
    expect(stripAt).toBeGreaterThan(missAt)
  })

  it('does not show two To-dos sections at once; hash /#/settings routes to /settings', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/showDailyPlanCard = dailyPlanCardVisible && !nextCardVisible/)
    const launch = readFileSync(resolve(__dirname, '../components/LaunchRedirect.tsx'), 'utf8')
    expect(launch).toMatch(/hashRoute/)
    expect(launch).toMatch(/\^#\(\\\/\[-a-z0-9\/\]\*\)/)
    const tile = dash.slice(dash.indexOf('Crypto</p>'))
    expect(tile).toMatch(/formatGBP\(crypto\.value\)/)
    expect(tile).toMatch(/formatPct\(crypto\.pct\)/)
  })

  it('points Open CSV import at the holding importer, not bare /crypto/1', () => {
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/`\/crypto\/\$\{selectedHolding\.id\}\?import=1`/)
    expect(crypto).toMatch(/portfolioConcentrationHits\(data, concentrationThreshold, \['crypto'\]\)/)
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/params\.get\('import'\)/)
    expect(detail).toMatch(/setHistoryOpen\(true\)/)
  })
})
