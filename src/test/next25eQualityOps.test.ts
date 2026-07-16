import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { useWindowedList } from '../hooks/useWindowedList'
import { renderHook, act } from '@testing-library/react'

describe('next25e quality / ops (21–25)', () => {
  it('21: Settings is lazy-loaded (not eager in App entry)', () => {
    const src = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')
    expect(src).toMatch(/import\('\.\/pages\/SettingsPage'\)/)
    expect(src).toMatch(/lazy\(/)
    expect(src).not.toMatch(/import \{ SettingsPage as SettingsPageBase \}/)
  })

  it('22: axe CI covers Equities, Tax, Todos', () => {
    const src = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(src).toMatch(/Equities axe/)
    expect(src).toMatch(/Tax axe/)
    expect(src).toMatch(/Todos axe/)
    expect(src).toMatch(/\/equities/)
    expect(src).toMatch(/\/tax/)
    expect(src).toMatch(/\/todos/)
  })

  it('23: Playwright offline-queue smoke + SYNC_SMOKE docs', () => {
    const smoke = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(smoke).toMatch(/offline queue enqueue/)
    expect(smoke).toMatch(/mydsp_offline_queue/)
    expect(smoke).toMatch(/Retry now/)
    const doc = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(doc).toMatch(/Long-press sync chip/)
    expect(doc).toMatch(/Retry now/)
  })

  it('24: windowed holdings lists via useWindowedList', () => {
    const { result } = renderHook(() => useWindowedList(Array.from({ length: 80 }, (_, i) => i), 40, 30))
    expect(result.current.visible).toHaveLength(40)
    expect(result.current.hasMore).toBe(true)
    act(() => {
      result.current.showAll()
    })
    expect(result.current.visible).toHaveLength(80)
    expect(result.current.hasMore).toBe(false)

    const eq = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const cr = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(eq).toMatch(/useWindowedList/)
    expect(cr).toMatch(/useWindowedList/)
    expect(eq).toMatch(/holdings-window-sentinel/)
    expect(cr).toMatch(/holdings-window-sentinel/)
  })

  it('25: UI conventions document next25e patterns', () => {
    const docs = readFileSync(resolve(__dirname, '../../docs/UI_CONVENTIONS.md'), 'utf8')
    expect(docs).toMatch(/Sync chip long-press/)
    expect(docs).toMatch(/master–detail|master-detail/i)
    expect(docs).toMatch(/useWindowedList/)
    expect(docs).toMatch(/TradeModal phone sheet/)
    expect(docs).toMatch(/concentration/i)
  })
})
