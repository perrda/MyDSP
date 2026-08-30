import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

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

describe('MyDSP 1.2.139 profile reset and delete', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.141')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.141')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.141',
      '1.2.139',
      '1.2.137',
      '1.2.135',
      '1.2.134',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.139\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Reset/)
    expect(section).toMatch(/Delete/)
    expect(section).toMatch(/Are you sure/)
    expect(section).toMatch(/David|default/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.137/)
    expect(section).toMatch(/index-CxpikgZP\.js/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Profile reset and delete \(v1\.2\.139\)/)
    const shipped = changelog.match(/## \[1\.2\.134\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(shipped).toMatch(/SIPP = Equities/)
    expect(shipped).not.toMatch(/Reset profile/)
  })

  it('Settings lists Reset on every profile and Delete only on non-default', () => {
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/portfolio-reset-\$\{p\.id\}/)
    expect(settings).toMatch(/portfolio-delete-\$\{p\.id\}/)
    expect(settings).toMatch(/portfolio-default-no-delete/)
    expect(settings).toMatch(/Are you sure\? Reset/)
    expect(settings).toMatch(/Are you sure\? Delete/)
    expect(settings).toMatch(/p\.id !== 'default'/)
    expect(settings).toMatch(/Cannot delete/)
  })
})

describe('resetPortfolio / deletePortfolio store', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('zeros a family profile and leaves David intact', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const mum = store.listPortfolios().find((p) => p.name === 'Mum')!
    store.savePortfolioImmediate(
      {
        ...store.loadPortfolio(mum.id),
        crypto: [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 2, price: 100, cost: 50 }],
        monthlyIncome: 4000,
      },
      mum.id,
    )
    store.savePortfolioImmediate(
      {
        ...store.loadPortfolio('default'),
        crypto: [{ id: 1, symbol: 'ETH', name: 'Ethereum', qty: 1, price: 10, cost: 10 }],
      },
      'default',
    )

    store.resetPortfolio(mum.id)
    const afterMum = store.loadPortfolio(mum.id)
    expect(afterMum.crypto).toHaveLength(0)
    expect(afterMum.equities).toHaveLength(0)
    expect(afterMum.monthlyIncome).toBe(0)
    expect(store.listPortfolios().some((p) => p.id === mum.id)).toBe(true)
    expect(store.loadPortfolio('default').crypto).toHaveLength(1)
  })

  it('can reset David without deleting the default profile', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    store.savePortfolioImmediate(
      {
        ...store.loadPortfolio('default'),
        crypto: [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 1, price: 1, cost: 1 }],
      },
      'default',
    )
    store.resetPortfolio('default')
    expect(store.loadPortfolio('default').crypto).toHaveLength(0)
    expect(store.listPortfolios().some((p) => p.id === 'default')).toBe(true)
  })

  it('deletes another profile and refuses to delete David', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const mum = store.listPortfolios().find((p) => p.name === 'Mum')!
    store.deletePortfolio(mum.id)
    expect(store.listPortfolios().some((p) => p.id === mum.id)).toBe(false)
    expect(store.listPortfolios().some((p) => p.id === 'default')).toBe(true)
    expect(() => store.deletePortfolio('default')).toThrow(store.PRIMARY_PORTFOLIO_DELETE_MSG)
    expect(store.listPortfolios().some((p) => p.id === 'default')).toBe(true)
  })

  it('switching away from a deleted active profile lands on David', async () => {
    const store = await import('../storage/portfolioStore')
    store.bootstrapFamilyPortfolios()
    const mum = store.listPortfolios().find((p) => p.name === 'Mum')!
    store.setActivePortfolioId(mum.id)
    store.deletePortfolio(mum.id)
    expect(store.getActivePortfolioId()).toBe('default')
  })
})
