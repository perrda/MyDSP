import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25f mobile / tablet items 11-15', () => {
  it('11: Dashboard and Compare keep WeeklyDigestModal; digest CTA is in Sidebar', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')

    expect(dashboard).toMatch(/WeeklyDigestModal/)
    expect(dashboard).not.toMatch(/Digest Preview\/Share/)
    expect(dashboard).not.toMatch(/downloadWeeklyDigest/)
    expect(compare).toMatch(/WeeklyDigestModal/)
    expect(compare).not.toMatch(/Digest Preview\/Share/)
    expect(compare).not.toMatch(/downloadWeeklyDigest/)
    expect(sidebar).toMatch(/Weekly digest/)
  })

  it('12: Today two-pane Markets rail stays sticky without a digest Preview button', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(dashboard).toMatch(/twoPane/)
    expect(dashboard).not.toMatch(/today-two-pane-digest-preview/)
    expect(dashboard).not.toMatch(/Digest Preview/)
    expect(css).toMatch(/\.today-two-pane \.today-markets-pane/)
  })

  it('13: holdings master-detail supports keyboard up/down row selection on wide screens', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')

    for (const src of [equities, crypto]) {
      expect(src).toMatch(/onHoldingsMasterKeyDown/)
      expect(src).toMatch(/ArrowDown/)
      expect(src).toMatch(/ArrowUp/)
      expect(src).toMatch(/matchMedia\('\(min-width: 900px\)'\)/)
      expect(src).toMatch(/\(selected\)/)
    }
  })

  it('14: tablet landscape Spending has a sticky merchant-search bar', () => {
    const spending = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(spending).toMatch(/spending-merchant-search-bar/)
    expect(spending).toMatch(/Merchant \/ description \/ category/)
    expect(css).toMatch(/next25f 14/)
    expect(css).toMatch(/\.spending-merchant-search-bar[\s\S]*position: sticky/)
  })

  it('15: bottom-nav long-press Overview/Today dispatches weekly digest event', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(nav).toMatch(/mydsp-open-weekly-digest/)
    expect(nav).toMatch(/isDigestLongPressItem/)
    expect(nav).toMatch(/item\.to === '\/'/)
    expect(dashboard).toMatch(/addEventListener\('mydsp-open-weekly-digest'/)
  })
})
