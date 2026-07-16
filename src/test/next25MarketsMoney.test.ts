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

describe('next25 markets / money clarity', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('MarketTicker supports optional notes and updateMarketTicker persists them', async () => {
    const domain = await import('../domain/markets')
    const store = await import('../storage/marketsStore')
    expect(domain.createEmptyMarketsState().tickers[0]).not.toHaveProperty('notes')

    store.loadMarketsState()
    const t = store.addMarketTicker({
      kind: 'equity',
      symbol: 'NVDA',
      name: 'NVIDIA',
      notes: 'AI exposure',
    })
    expect(t.notes).toBe('AI exposure')

    store.updateMarketTicker(t.id, { notes: 'Watch earnings' })
    expect(store.listMarketTickers('equity').find((x) => x.id === t.id)?.notes).toBe(
      'Watch earnings',
    )

    store.updateMarketTicker(t.id, { notes: '   ' })
    expect(store.listMarketTickers('equity').find((x) => x.id === t.id)?.notes).toBeUndefined()
  })

  it('wires As-of sticky, notes UI, FX explainer, cost·P&L, tax exports panel', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/markets-section-asof/)
    expect(markets).toMatch(/sectionAsOfLabel/)
    expect(markets).toMatch(/notes/)
    expect(markets).toMatch(/fxExplainerOpen/)
    expect(markets).toMatch(/GBP storage/)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/Cost \{formatGBP\(cost\)\} · P&L/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/Cost \{formatGBP\(c\.cost\)\} · P&L/)

    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/tax-exports-explainer/)
    expect(tax).toMatch(/What these exports mean/)
    expect(tax).toMatch(/pack\.disclaimer/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.48')
  })
})
