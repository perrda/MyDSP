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

  it('rejects create/rename with This portfolio name already exists', async () => {
    const store = await import('../storage/portfolioStore')
    mem.clear()
    store.bootstrapFamilyPortfolios()
    expect(() => store.createPortfolio('Mum')).toThrow(store.PORTFOLIO_NAME_EXISTS_MSG)
    const andrew = store.listPortfolios().find((p) => p.name === 'Andrew')!
    expect(() => store.renamePortfolio(andrew.id, 'Thomas')).toThrow(store.PORTFOLIO_NAME_EXISTS_MSG)
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

  it('listPortfolios auto-heals triple family-name duplicates back to 6', async () => {
    const store = await import('../storage/portfolioStore')
    const triples = [
      { id: 'default', name: 'David', createdAt: '2026-01-01' },
      ...['Mum', 'Andrew', 'Thomas', 'Rebecca', 'James King'].flatMap((name, i) =>
        [0, 1, 2].map((n) => ({
          id: `p_${name.replace(/\s+/g, '_').toLowerCase()}_${n}`,
          name,
          createdAt: `2026-0${i + 1}-0${n + 1}`,
        })),
      ),
    ]
    mem.set('fcc_portfolios', JSON.stringify(triples))
    expect(triples.length).toBe(16)

    const list = store.listPortfolios()
    expect(list).toHaveLength(6)
    expect(new Set(list.map((p) => p.name.toLowerCase())).size).toBe(6)
    expect(list.map((p) => p.name)).toEqual(
      expect.arrayContaining(['David', 'Mum', 'Andrew', 'Thomas', 'Rebecca', 'James King']),
    )
  })

  it('hard-caps above MAX_PORTFOLIOS preferring canonical family names', async () => {
    const store = await import('../storage/portfolioStore')
    mem.set(
      'fcc_portfolios',
      JSON.stringify([
        { id: 'default', name: 'David', createdAt: '2026-01-01' },
        { id: 'p_mum', name: 'Mum', createdAt: '2026-01-01' },
        { id: 'p_andrew', name: 'Andrew', createdAt: '2026-01-01' },
        { id: 'p_thomas', name: 'Thomas', createdAt: '2026-01-01' },
        { id: 'p_rebecca', name: 'Rebecca', createdAt: '2026-01-01' },
        { id: 'p_james', name: 'James King', createdAt: '2026-01-01' },
        { id: 'p_uncle', name: 'Uncle John', createdAt: '2026-01-01' },
      ]),
    )
    const { removed, kept } = store.dedupePortfoliosByName()
    expect(kept).toBe(6)
    expect(removed).toContain('p_uncle')
    const names = store.listPortfolios().map((p) => p.name)
    expect(names).not.toContain('Uncle John')
    expect(names).toHaveLength(6)
  })
})
