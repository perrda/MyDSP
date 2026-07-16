import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25e mobile / tablet items 11-15', () => {
  it('11: iPad crypto/equities use a >=900px master-detail holdings layout', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(equities).toMatch(/equities-master-detail/)
    expect(equities).toMatch(/holdings-master-detail-panel/)
    expect(equities).toMatch(/selectedHolding/)
    expect(crypto).toMatch(/crypto-master-detail/)
    expect(crypto).toMatch(/holdings-master-detail-panel/)
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*\.holdings-master-detail/)
  })

  it('12: Today uses persisted accordion sections for Next, Bills, and Goals on phone/portrait tablet', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const uiPanels = readFileSync(resolve(__dirname, '../storage/uiPanelsStore.ts'), 'utf8')

    expect(dashboard).toMatch(/TodayAccordionSection/)
    expect(dashboard).toMatch(/TODAY_ACCORDION_QUERY/)
    expect(dashboard).toMatch(/subscribeUiPanels/)
    expect(dashboard).toMatch(/id="today-next-action"/)
    expect(dashboard).toMatch(/id="today-bills"/)
    expect(dashboard).toMatch(/id="today-goals"/)
    expect(uiPanels).toMatch(/getUiPanelOpenState/)
  })

  it('13: TradeModal opens with the shared phone bottom-sheet Modal pattern', () => {
    const tradeModal = readFileSync(resolve(__dirname, '../components/ui/TradeModal.tsx'), 'utf8')
    const modal = readFileSync(resolve(__dirname, '../components/ui/Modal.tsx'), 'utf8')

    expect(tradeModal).toMatch(/size="sheet"/)
    expect(modal).toMatch(/modal-sheet/)
    expect(modal).toMatch(/items-end sm:items-center/)
    expect(modal).toMatch(/rounded-t-2xl sm:rounded-none/)
  })

  it('14: Markets sticky toolbar keeps section jump chips available while scrolling', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(markets).toMatch(/sectionOrder/)
    expect(markets).toMatch(/markets-sticky-toolbar/)
    expect(markets).toMatch(/markets-section-jump-chips/)
    expect(markets).toMatch(/id=\{`markets-section-\$\{section\}`\}/)
    expect(markets).toMatch(/Crosses/)
    expect(css).toMatch(/\.markets-sticky-toolbar/)
    expect(css).toMatch(/top: var\(--app-header-offset/)
  })

  it('15: Jobs has a >=900 landscape list|Kanban split plus sticky column jump chips', () => {
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(jobs).toMatch(/jobs-list-kanban-split/)
    expect(jobs).toMatch(/jobs-list-kanban-split__list/)
    expect(jobs).toMatch(/jobs-kanban-jump-chips/)
    expect(jobs).toMatch(/jumpToKanbanColumn/)
    expect(css).toMatch(/@media \(min-width: 900px\) and \(orientation: landscape\)[\s\S]*\.jobs-list-kanban-split/)
  })
})
