import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('next25f markets / portfolio items 6-10', () => {
  it('6: equity and crypto holdings can sort by portfolio weight percent', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/weightSort/)
    expect(equities).toMatch(/weightSortedHoldings/)
    expect(equities).toMatch(/Sort holdings by portfolio weight percent/)
    expect(equities).toMatch(/Weight %/)
    expect(equities).toMatch(/includedPortfolioValue/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/weightSort/)
    expect(crypto).toMatch(/weightSortedHoldings/)
    expect(crypto).toMatch(/Sort holdings by portfolio weight percent/)
    expect(crypto).toMatch(/Weight %/)
    expect(crypto).toMatch(/includedPortfolioValue/)
  })

  it('7: HoldingDetailPage can share or copy a one-line holding summary', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/shareHoldingSummaryLine/)
    expect(detail).toMatch(/navigator\.share/)
    expect(detail).toMatch(/navigator\.clipboard\?\.writeText/)
    expect(detail).toMatch(/holdingSummaryLine/)
    expect(detail).toMatch(/holding-summary-share/)
    expect(detail).toMatch(/Share summary/)
    expect(detail).toMatch(/privacy mode is on; amounts hidden/)
  })

  it('8: holdings pages show a sticky included-value totals bar while scrolling', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/holdings-included-value-bar/)
    expect(equities).toMatch(/holdings-sticky-totals/)
    expect(equities).toMatch(/Included equity value/)
    expect(equities).toMatch(/holdingsIncludedSummary/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/holdings-included-value-bar/)
    expect(crypto).toMatch(/holdings-sticky-totals/)
    expect(crypto).toMatch(/Included crypto value/)
    expect(crypto).toMatch(/holdingsIncludedSummary/)
  })

  it('9: Markets Owned chip title includes portfolio weight percent', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/ownedHoldingWeightByKey/)
    expect(markets).toMatch(/includedPortfolioHoldingValue/)
    expect(markets).toMatch(/Owned · \$\{\(ownedWeight \* 100\)\.toFixed\(1\)\}% of included portfolio/)
    expect(markets).toMatch(/portfolio weight/)
    expect(markets).toMatch(/markets-owned-chip/)
  })

  it('10: phone swipe rows explicitly include/exclude holdings from net worth', () => {
    const swipe = readFileSync(resolve(__dirname, '../components/ui/SwipeHoldingRow.tsx'), 'utf8')
    expect(swipe).toMatch(/onToggleNw/)
    expect(swipe).toMatch(/nwActionLabel/)
    expect(swipe).toMatch(/Exclude from net worth/)
    expect(swipe).toMatch(/Include from net worth|Include in net worth/)
    expect(swipe).toMatch(/Exclude NW/)
    expect(swipe).toMatch(/Include NW/)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(equities).toMatch(/<SwipeHoldingRow/)
    expect(equities).toMatch(/onToggleNw=\{\(\) => toggle\(e\.id\)\}/)
    expect(crypto).toMatch(/<SwipeHoldingRow/)
    expect(crypto).toMatch(/onToggleNw=\{\(\) => toggle\(c\.id\)\}/)
  })
})
