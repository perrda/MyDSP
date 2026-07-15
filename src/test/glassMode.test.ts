import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyGlassDom,
  GLASS_STORAGE_KEY,
  loadGlassMode,
  saveGlassMode,
} from '../utils/glassMode'

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

describe('glassMode', () => {
  beforeEach(() => {
    mockLocalStorage()
    document.documentElement.classList.remove('glass')
  })

  afterEach(() => {
    document.documentElement.classList.remove('glass')
  })

  it('defaults off', () => {
    expect(loadGlassMode()).toBe(false)
  })

  it('persists and applies the html.glass class', () => {
    saveGlassMode(true)
    expect(localStorage.getItem(GLASS_STORAGE_KEY)).toBe('1')
    expect(loadGlassMode()).toBe(true)
    applyGlassDom(true)
    expect(document.documentElement.classList.contains('glass')).toBe(true)
    applyGlassDom(false)
    expect(document.documentElement.classList.contains('glass')).toBe(false)
    saveGlassMode(false)
    expect(loadGlassMode()).toBe(false)
  })
})
