import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('favourites equities and crypto holding polish', () => {
  it('exposes equities metadata in Add/Edit and phone thumb actions', () => {
    const page = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')

    expect(page).toMatch(/accountType/)
    expect(page).toMatch(/Include in net worth/)
    expect(page).toMatch(/Field label="Platform"/)
    expect(page).toMatch(/Field label="URL"/)
    expect(page).toMatch(/Field label="RAG"/)
    expect(page).toMatch(/Add equity/)
    expect(page).toMatch(/Last synced/)
  })

  it('exposes crypto metadata, chain, and sell swipe affordance', () => {
    const page = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    const swipe = readFileSync(resolve(__dirname, '../components/ui/SwipeHoldingRow.tsx'), 'utf8')

    expect(page).toMatch(/Field label="Platform \/ venue"/)
    expect(page).toMatch(/Field label="Chain"/)
    expect(page).toMatch(/Include in net worth/)
    expect(page).toMatch(/ragStatus/)
    expect(page).toMatch(/onSell/)
    expect(page).toMatch(/Add crypto/)
    expect(swipe).toMatch(/onSell\?:/)
    expect(swipe).toMatch(/Sell/)
  })

  it('normalizes and shows shared holding detail metadata', () => {
    const types = readFileSync(resolve(__dirname, '../domain/types.ts'), 'utf8')
    const normalize = readFileSync(resolve(__dirname, '../domain/normalize.ts'), 'utf8')
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')

    expect(types).toMatch(/chain\?: string/)
    expect(types).toMatch(/accountType\?: EquityAccountType/)
    expect(normalize).toMatch(/r\.platform \?\? r\.venue/)
    expect(normalize).toMatch(/normalizeEquityAccountType/)
    expect(detail).toMatch(/Holding metadata/)
    expect(detail).toMatch(/Include in net worth/)
    expect(detail).toMatch(/Chain:/)
  })

  it('uses stacked trade cards below md while keeping desktop tables', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    const modal = readFileSync(resolve(__dirname, '../components/ui/TradeHistoryModal.tsx'), 'utf8')

    expect(detail).toMatch(/hidden md:block overflow-x-auto/)
    expect(detail).toMatch(/md:hidden space-y-3/)
    expect(modal).toMatch(/hidden md:block overflow-x-auto/)
    expect(modal).toMatch(/md:hidden space-y-3/)
    expect(modal).toMatch(/Row \{index \+ 1\}/)
  })
})
