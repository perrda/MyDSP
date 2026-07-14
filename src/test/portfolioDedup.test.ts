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

describe('portfolio name uniqueness', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('dedupes duplicate display names and keeps one entry each', async () => {
    const store = await import('../storage/portfolioStore')
    mem.set(
      'fcc_portfolios',
      JSON.stringify([
        { id: 'default', name: 'David', createdAt: '2026-01-01' },
        { id: 'p_mum_a', name: 'Mum', createdAt: '2026-01-01' },
        { id: 'p_mum_b', name: 'Mum', createdAt: '2026-02-01' },
        { id: 'p_andrew_a', name: 'Andrew', createdAt: '2026-01-01' },
        { id: 'p_andrew_b', name: 'andrew', createdAt: '2026-03-01' },
        { id: 'p_thomas', name: 'Thomas', createdAt: '2026-01-01' },
      ]),
    )
    mem.set('dfc_data_v3_p_mum_a', JSON.stringify({ crypto: [{ id: 1 }], equities: [] }))
    mem.set('dfc_data_v3_p_mum_b', JSON.stringify({ crypto: [], equities: [] }))

    const result = store.dedupePortfoliosByName()
    expect(result.removed.length).toBe(2)
    const list = store.listPortfolios()
    const names = list.map((p) => p.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    expect(list.filter((p) => p.name.toLowerCase() === 'mum')).toHaveLength(1)
    expect(list.find((p) => p.name.toLowerCase() === 'mum')!.id).toBe('p_mum_a')
  })

  it('rejects create/rename with a duplicate name', async () => {
    const store = await import('../storage/portfolioStore')
    mem.clear()
    store.bootstrapFamilyPortfolios()
    expect(() => store.createPortfolio('Mum')).toThrow(/already exists/i)
    const andrew = store.listPortfolios().find((p) => p.name === 'Andrew')!
    expect(() => store.renamePortfolio(andrew.id, 'Thomas')).toThrow(/already exists/i)
  })

  it('bootstrap removes name duplicates then keeps six unique family portfolios', async () => {
    const store = await import('../storage/portfolioStore')
    mem.set(
      'fcc_portfolios',
      JSON.stringify([
        { id: 'default', name: 'David', createdAt: '2026-01-01' },
        { id: 'p1', name: 'Mum', createdAt: '2026-01-01' },
        { id: 'p2', name: 'Mum', createdAt: '2026-01-02' },
        { id: 'p3', name: 'Andrew', createdAt: '2026-01-01' },
        { id: 'p4', name: 'Andrew', createdAt: '2026-01-02' },
        { id: 'p5', name: 'Thomas', createdAt: '2026-01-01' },
        { id: 'p6', name: 'Thomas', createdAt: '2026-01-02' },
        { id: 'p7', name: 'Rebecca', createdAt: '2026-01-01' },
        { id: 'p8', name: 'Rebecca', createdAt: '2026-01-02' },
        { id: 'p9', name: 'James King', createdAt: '2026-01-01' },
        { id: 'p10', name: 'James King', createdAt: '2026-01-02' },
      ]),
    )
    const boot = store.bootstrapFamilyPortfolios()
    expect(boot.removedDupes.length).toBeGreaterThan(0)
    const list = store.listPortfolios()
    expect(list).toHaveLength(6)
    expect(new Set(list.map((p) => p.name.toLowerCase())).size).toBe(6)
  })
})
