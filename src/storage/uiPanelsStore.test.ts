import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  _resetUiPanelsForTests,
  isUiPanelOpen,
  setUiPanelOpen,
} from '../storage/uiPanelsStore'

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

describe('uiPanelsStore', () => {
  beforeEach(() => {
    mockLocalStorage()
    _resetUiPanelsForTests()
  })

  afterEach(() => {
    _resetUiPanelsForTests()
  })

  it('defaults panels to collapsed', () => {
    expect(isUiPanelOpen('todos-filters')).toBe(false)
  })

  it('persists open state', () => {
    setUiPanelOpen('todos-filters', true)
    expect(isUiPanelOpen('todos-filters')).toBe(true)
    setUiPanelOpen('todos-filters', false)
    expect(isUiPanelOpen('todos-filters')).toBe(false)
  })
})
