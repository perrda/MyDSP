import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  FAMILY_SLEEVES_APPLIED_EXTRA,
  FAMILY_SLEEVES_APPLIED_VERSION,
  applyNamedFamilyHoldings,
  familyHoldingSleeveFor,
  hasFamilySleevesApplied,
} from '../domain/familyHoldingSleeves'
import { createEmptyPortfolio } from '../domain/defaults'

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

function shares(data: { equities: { symbol: string; shares: number }[] }, symbol: string) {
  return data.equities.find((e) => e.symbol === symbol)?.shares
}

function qty(data: { crypto: { symbol: string; qty: number }[] }, symbol: string) {
  return data.crypto.find((c) => c.symbol === symbol)?.qty
}

describe('MyDSP 1.2.143 family TSLA / MSTR / ADA sleeves', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.155')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.155')
    expect(RELEASE_NOTES.some((e) => e.version === '1.2.143')).toBe(true)
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.155',
      '1.2.154',
      '1.2.153',
      '1.2.152',
      '1.2.151',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.143\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Thomas \+ Rebecca/)
    expect(section).toMatch(/100 TSLA/)
    expect(section).toMatch(/97 MSTR/)
    expect(section).toMatch(/109 TSLA/)
    expect(section).toMatch(/108 MSTR/)
    expect(section).toMatch(/182 TSLA/)
    expect(section).toMatch(/90 MSTR/)
    expect(section).toMatch(/3,000 ADA/)
    expect(section).toMatch(/Reset stays empty/)
    expect(section).toMatch(/David and Andrew/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.141/)
    expect(section).toMatch(/1\.2\.139/)
    expect(section).toMatch(/index-CxpikgZP\.js/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Family TSLA \/ MSTR \/ ADA sleeves \(v1\.2\.143\)/)
    const shipped = changelog.match(/## \[1\.2\.141\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(shipped).toMatch(/Chart axes/)
    expect(shipped).not.toMatch(/3,000 ADA/)
  })

  it('maps the five named books and skips David', () => {
    expect(familyHoldingSleeveFor('THOMAS')?.equities.map((e) => [e.symbol, e.shares])).toEqual([
      ['TSLA', 100],
      ['MSTR', 97],
    ])
    expect(familyHoldingSleeveFor('  Rebecca ')?.equities.map((e) => [e.symbol, e.shares])).toEqual([
      ['TSLA', 100],
      ['MSTR', 97],
    ])
    expect(familyHoldingSleeveFor('Mum')?.equities.map((e) => [e.symbol, e.shares])).toEqual([
      ['TSLA', 109],
      ['MSTR', 108],
    ])
    const james = familyHoldingSleeveFor('James  King')
    expect(james?.equities.map((e) => [e.symbol, e.shares])).toEqual([
      ['TSLA', 182],
      ['MSTR', 90],
    ])
    expect(james?.crypto.map((c) => [c.symbol, c.qty])).toEqual([['ADA', 3000]])
    const andrew = familyHoldingSleeveFor('Andrew')
    expect(andrew?.equities.map((e) => [e.symbol, e.shares, e.accountType ?? 'general'])).toEqual([
      ['TSLA', 295, 'sipp'],
      ['MSTR', 197, 'sipp'],
      ['TSLA', 135, 'general'],
      ['MSTR', 112, 'general'],
    ])
    expect(andrew?.crypto.map((c) => [c.symbol, c.qty])).toEqual([['ADA', 14285]])
    expect(andrew?.crypto.some((c) => c.symbol === 'BTC')).toBe(false)
    expect(familyHoldingSleeveFor('David')).toBeNull()
  })

  it('upserts by symbol and is a no-op when quantities already match', () => {
    const empty = createEmptyPortfolio()
    const first = applyNamedFamilyHoldings(empty, 'Thomas')
    expect(first.changed).toBe(true)
    expect(shares(first.data, 'TSLA')).toBe(100)
    expect(shares(first.data, 'MSTR')).toBe(97)
    const again = applyNamedFamilyHoldings(first.data, 'Thomas')
    expect(again.changed).toBe(false)
    expect(again.data).toBe(first.data)

    const bumped = applyNamedFamilyHoldings(
      {
        ...empty,
        equities: [
          {
            id: 4,
            symbol: 'TSLA',
            name: 'Tesla',
            shares: 1,
            avgCost: 12,
            livePrice: 200,
            includeInPortfolio: true,
          },
        ],
      },
      'thomas',
    )
    expect(bumped.changed).toBe(true)
    expect(shares(bumped.data, 'TSLA')).toBe(100)
    expect(bumped.data.equities.find((e) => e.symbol === 'TSLA')?.avgCost).toBe(12)
    expect(shares(bumped.data, 'MSTR')).toBe(97)
  })
})

describe('family sleeve bootstrap / reset', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('writes the five books on bootstrap and skips David', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const byName = Object.fromEntries(store.listPortfolios().map((p) => [p.name, p.id]))

    const thomas = store.loadPortfolio(byName.Thomas)
    expect(shares(thomas, 'TSLA')).toBe(100)
    expect(shares(thomas, 'MSTR')).toBe(97)
    expect(hasFamilySleevesApplied(thomas)).toBe(true)

    const rebecca = store.loadPortfolio(byName.Rebecca)
    expect(shares(rebecca, 'TSLA')).toBe(100)
    expect(shares(rebecca, 'MSTR')).toBe(97)

    const mum = store.loadPortfolio(byName.Mum)
    expect(shares(mum, 'TSLA')).toBe(109)
    expect(shares(mum, 'MSTR')).toBe(108)

    const james = store.loadPortfolio(byName['James King'])
    expect(shares(james, 'TSLA')).toBe(182)
    expect(shares(james, 'MSTR')).toBe(90)
    expect(qty(james, 'ADA')).toBe(3000)

    const andrew = store.loadPortfolio(byName.Andrew)
    expect(andrew.equities.map((e) => [e.symbol, e.shares, e.accountType ?? 'general'])).toEqual([
      ['TSLA', 295, 'sipp'],
      ['MSTR', 197, 'sipp'],
      ['TSLA', 135, 'general'],
      ['MSTR', 112, 'general'],
    ])
    expect(qty(andrew, 'ADA')).toBe(14285)
    expect(qty(andrew, 'BTC')).toBeUndefined()
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
  })

  it('applies once to an existing empty named book', async () => {
    const store = await import('../storage/portfolioStore')
    store.ensurePortfolioRegistry()
    const meta = store.createPortfolio('Mum', { empty: true })
    expect(shares(store.loadPortfolio(meta.id), 'TSLA')).toBe(109)
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
  })

  it('refills once when a named book still has the v1 flag but no gifted shares', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const mum = store.listPortfolios().find((p) => p.name === 'Mum')!
    const empty = createEmptyPortfolio()
    empty.extras = { [FAMILY_SLEEVES_APPLIED_EXTRA]: 'v1' }
    store.savePortfolioImmediate(empty, mum.id)
    expect(store.loadPortfolio(mum.id).equities).toHaveLength(0)
    expect(store.applyFamilyHoldingsToNamedBooks()).toContain('Mum')
    expect(shares(store.loadPortfolio(mum.id), 'TSLA')).toBe(109)
    expect(shares(store.loadPortfolio(mum.id), 'MSTR')).toBe(108)
    expect(hasFamilySleevesApplied(store.loadPortfolio(mum.id))).toBe(true)
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
  })

  it('does not refill after Reset', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const mum = store.listPortfolios().find((p) => p.name === 'Mum')!
    expect(shares(store.loadPortfolio(mum.id), 'TSLA')).toBe(109)
    store.resetPortfolio(mum.id)
    const after = store.loadPortfolio(mum.id)
    expect(after.equities).toHaveLength(0)
    expect(after.crypto).toHaveLength(0)
    expect(after.extras[FAMILY_SLEEVES_APPLIED_EXTRA]).toBe(FAMILY_SLEEVES_APPLIED_VERSION)
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
    expect(store.loadPortfolio(mum.id).equities).toHaveLength(0)
  })

  it('skips David on create / apply', async () => {
    const store = await import('../storage/portfolioStore')
    store.ensurePortfolioRegistry()
    const david = store.loadPortfolio('default')
    expect(applyNamedFamilyHoldings(david, 'David').changed).toBe(false)
    expect(store.applyFamilyHoldingsToNamedBooks()).toEqual([])
  })
})
