import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShowBottomNav } from './useShowBottomNav'

type Listener = () => void

function mockMatchMedia(initial: Record<string, boolean>) {
  const listeners = new Map<string, Set<Listener>>()
  const state = { ...initial }

  window.matchMedia = vi.fn((query: string) => {
    const matches = () => {
      if (query.includes('min-width: 1024px')) return state.wide
      if (query.includes('hover: hover') && query.includes('pointer: fine')) {
        return state.finePointer
      }
      return false
    }
    return {
      get matches() {
        return matches()
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: Listener) => {
        if (!listeners.has(query)) listeners.set(query, new Set())
        listeners.get(query)!.add(cb)
      },
      removeEventListener: (_: string, cb: Listener) => {
        listeners.get(query)?.delete(cb)
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    } as MediaQueryList
  })

  return {
    set(next: Partial<typeof state>) {
      Object.assign(state, next)
      for (const set of listeners.values()) {
        for (const cb of set) cb()
      }
    },
  }
}

describe('useShowBottomNav', () => {
  const originalMatchMedia = window.matchMedia
  const originalTouch = navigator.maxTouchPoints

  beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 0,
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => originalTouch,
    })
  })

  it('hides on wide desktop layouts (≥1024px)', () => {
    mockMatchMedia({ wide: true, finePointer: true })
    const { result } = renderHook(() => useShowBottomNav())
    expect(result.current).toBe(false)
  })

  it('hides on mouse-only desktop even when the window is narrow', () => {
    mockMatchMedia({ wide: false, finePointer: true })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 0,
    })
    const { result } = renderHook(() => useShowBottomNav())
    expect(result.current).toBe(false)
  })

  it('shows on touch tablets below the desktop breakpoint', () => {
    mockMatchMedia({ wide: false, finePointer: true })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 5,
    })
    const { result } = renderHook(() => useShowBottomNav())
    expect(result.current).toBe(true)
  })

  it('shows on phones (coarse pointer)', () => {
    mockMatchMedia({ wide: false, finePointer: false })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 5,
    })
    const { result } = renderHook(() => useShowBottomNav())
    expect(result.current).toBe(true)
  })

  it('updates when the viewport crosses the desktop breakpoint', () => {
    const mq = mockMatchMedia({ wide: false, finePointer: false })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 5,
    })
    const { result } = renderHook(() => useShowBottomNav())
    expect(result.current).toBe(true)

    act(() => {
      mq.set({ wide: true })
    })
    expect(result.current).toBe(false)
  })
})
