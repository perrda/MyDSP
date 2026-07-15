import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultNavLayout,
  DEFAULT_FAVOURITE_PATHS,
  exportNavLayoutForBackup,
  importNavLayoutFromBackup,
  loadNavLayout,
  normalizeNavLayout,
  resetNavOrder,
  saveNavLayout,
} from '../storage/navOrder'

const ALL = [
  '/',
  '/markets',
  '/news',
  '/youtube',
  '/crypto',
  '/equities',
  '/spending',
  '/goals',
  '/todos',
  '/settings',
]

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

describe('nav layout favourites', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
    vi.restoreAllMocks()
  })

  it('defaults with seeded favourites and settings excluded', () => {
    const layout = createDefaultNavLayout(ALL)
    expect(layout.favourites).toEqual(
      DEFAULT_FAVOURITE_PATHS.filter((p) => ALL.includes(p) && p !== '/settings'),
    )
    expect(layout.others).not.toContain('/settings')
    expect(layout.favourites).not.toContain('/settings')
    expect(layout.othersCollapsed).toBe(true)
    for (const p of layout.favourites) {
      expect(layout.others).not.toContain(p)
    }
  })

  it('persists favourites / others and migrates legacy flat order', () => {
    localStorage.setItem(
      'mydsp_nav_order',
      JSON.stringify(['/goals', '/spending', '/crypto', '/markets', '/news']),
    )
    const layout = loadNavLayout(ALL)
    expect(layout.favourites[0]).toBe('/goals')
    expect(layout.favourites).toContain('/spending')
    expect(layout.others).toContain('/todos')
    expect(localStorage.getItem('mydsp_nav_layout')).toBeTruthy()
  })

  it('moves paths between favourites and others via normalize', () => {
    const next = normalizeNavLayout(ALL, {
      version: 1,
      favourites: ['/crypto', '/gone'],
      others: ['/markets'],
      othersCollapsed: false,
    })
    expect(next.favourites).toEqual(['/crypto'])
    expect(next.others[0]).toBe('/markets')
    expect(next.others).toContain('/')
    expect(next.othersCollapsed).toBe(false)
  })

  it('reset clears layout keys', () => {
    saveNavLayout({
      version: 1,
      favourites: ['/crypto'],
      others: ['/markets'],
      othersCollapsed: false,
    })
    resetNavOrder()
    expect(localStorage.getItem('mydsp_nav_order')).toBeNull()
    const layout = loadNavLayout(ALL)
    expect(layout.favourites).toEqual(
      DEFAULT_FAVOURITE_PATHS.filter((p) => ALL.includes(p)),
    )
    expect(layout.others).toContain('/todos')
  })

  it('round-trips favourites order through backup export/import', () => {
    saveNavLayout(
      {
        version: 1,
        favourites: ['/todos', '/markets', '/crypto'],
        others: ['/goals', '/spending', '/'],
        othersCollapsed: false,
      },
      { fromSync: true },
    )
    const exported = exportNavLayoutForBackup()
    expect(exported?.favourites).toEqual(['/todos', '/markets', '/crypto'])
    expect(exported?.others[0]).toBe('/goals')

    localStorage.removeItem('mydsp_nav_layout')
    localStorage.removeItem('mydsp_nav_order')
    expect(exportNavLayoutForBackup()).toBeNull()

    importNavLayoutFromBackup(exported)
    const loaded = loadNavLayout(ALL)
    expect(loaded.favourites).toEqual(['/todos', '/markets', '/crypto'])
    expect(loaded.others[0]).toBe('/goals')
    expect(loaded.othersCollapsed).toBe(false)
  })

  it('import preserves order and drops /settings + duplicates', () => {
    importNavLayoutFromBackup({
      version: 1,
      favourites: ['/crypto', '/crypto', '/settings', '/todos'],
      others: ['/markets', '/crypto', '/settings'],
      othersCollapsed: true,
    })
    const loaded = loadNavLayout(ALL)
    expect(loaded.favourites).toEqual(['/crypto', '/todos'])
    expect(loaded.others).toContain('/markets')
    expect(loaded.favourites).not.toContain('/settings')
    expect(loaded.others).not.toContain('/settings')
    expect(loaded.others).not.toContain('/crypto')
  })
})
