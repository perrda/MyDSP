import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultNavLayout,
  DEFAULT_FAVOURITE_PATHS,
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
    expect(localStorage.getItem('mydsp_nav_layout')).toBeNull()
    expect(localStorage.getItem('mydsp_nav_order')).toBeNull()
  })
})
