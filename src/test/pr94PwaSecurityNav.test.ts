import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveBottomNavItems } from '../domain/bottomNav'
import {
  DEFAULT_BOTTOM_NAV_MIDDLE,
  loadBottomNavMiddleSlots,
  resetBottomNavMiddleSlots,
  saveBottomNavMiddleSlots,
} from '../storage/bottomNavSlots'

function mockStorage() {
  const mem = new Map<string, string>()
  const store = {
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
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
}

describe('PR94 leftovers + bottom nav + PWA', () => {
  beforeEach(() => {
    mockStorage()
  })

  afterEach(() => {
    resetBottomNavMiddleSlots()
  })

  it('exposes PWA shortcuts for Today, Markets, and Settings', () => {
    const manifest = readFileSync(resolve(__dirname, '../../public/manifest.webmanifest'), 'utf8')
    const json = JSON.parse(manifest) as { shortcuts?: { name: string; url: string }[] }
    const names = (json.shortcuts ?? []).map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['Today', 'Markets', 'Settings']))
  })

  it('updates theme-color meta from ThemeContext applyDomTheme', () => {
    const src = readFileSync(resolve(__dirname, '../context/ThemeContext.tsx'), 'utf8')
    expect(src).toMatch(/meta\[name="theme-color"\]/)
    expect(src).toMatch(/#ffffff/)
    expect(src).toMatch(/#000000/)
  })

  it('keeps sync chip out of the phone burger row', () => {
    const src = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(src).toMatch(/app-header-sync-strip/)
    expect(src).toMatch(/SyncStatusChip compact/)
    expect(src).toMatch(/hidden sm:block/)
    // Phone row should not mount SyncStatusChip between menu and toolbar
    expect(src).not.toMatch(/sm:hidden flex-1 min-w-0 flex items-center justify-end[\s\S]*SyncStatusChip/)
  })

  it('leads lock screen with Face ID when biometrics enabled', () => {
    const src = readFileSync(resolve(__dirname, '../components/LockScreen.tsx'), 'utf8')
    expect(src).toMatch(/Unlock with \$\{bioLabel\}/)
    expect(src).toMatch(/Use 4-digit PIN instead/)
    expect(src).toMatch(/PIN is the fallback/)
  })

  it('defaults middle bottom-nav slots to Markets · To Do · Equities', () => {
    expect(loadBottomNavMiddleSlots()).toEqual([...DEFAULT_BOTTOM_NAV_MIDDLE])
    const items = resolveBottomNavItems()
    expect(items.map((i) => i.to)).toEqual(['/', '/markets', '/todos', '/equities', '/settings'])
  })

  it('persists custom middle slots without moving Overview/Settings', () => {
    saveBottomNavMiddleSlots(['/crypto', '/goals', '/news'])
    expect(loadBottomNavMiddleSlots()).toEqual(['/crypto', '/goals', '/news'])
    const items = resolveBottomNavItems(loadBottomNavMiddleSlots())
    expect(items[0].to).toBe('/')
    expect(items.at(-1)?.to).toBe('/settings')
    expect(items.map((i) => i.to).slice(1, 4)).toEqual(['/crypto', '/goals', '/news'])
  })

  it('dedupes and fills invalid slot saves', () => {
    saveBottomNavMiddleSlots(['/markets', '/markets', '/settings', '/nope'] as string[])
    const slots = loadBottomNavMiddleSlots()
    expect(slots).toHaveLength(3)
    expect(new Set(slots).size).toBe(3)
    expect(slots).not.toContain('/settings')
    expect(slots[0]).toBe('/markets')
  })
})
