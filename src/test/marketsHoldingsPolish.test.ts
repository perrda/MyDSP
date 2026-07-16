import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('markets / holdings polish batch', () => {
  it('adds sticky Markets headers, sparkline detail, presets, and amber stale', () => {
    const src = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(src).toMatch(/markets-section-sticky/)
    expect(src).toMatch(/quoteDetail/)
    expect(src).toMatch(/longPressTimer/)
    expect(src).toMatch(/\+ \{preset\.symbol\}/)
    expect(src).toMatch(/text-amber-600/)
    expect(src).toMatch(/4 \* 60 \* 60 \* 1000/)
  })

  it('wraps holdings with swipe Buy/Exclude and fill undo', () => {
    for (const file of ['EquitiesPage.tsx', 'CryptoPage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/SwipeHoldingRow/)
      expect(src).toMatch(/label:\s*'Undo'/)
    }
  })

  it('shows a large-type price strip on holding detail', () => {
    const src = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(src).toMatch(/holding-price-strip/)
  })

  it('uses tablet side-by-side Compare rings and hides tiny legends', () => {
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/md:grid-cols-2/)
    const ring = readFileSync(resolve(__dirname, '../components/charts/AllocationRing.tsx'), 'utf8')
    expect(ring).toMatch(/max-\[360px\]:hidden/)
  })
})
