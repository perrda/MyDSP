import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('markets watchlist chrome cleanup (v1.2.75)', () => {
  it('drops noisy watchlist status chrome; keeps sync spinner CTA', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).not.toMatch(/Live watchlist · auto/)
    expect(page).not.toMatch(/Updating quotes/)
    expect(page).not.toMatch(/markets-provider-health/)
    expect(page).toMatch(/animate-spin/)
    expect(page).toMatch(/Refreshing data/)
    expect(page).toMatch(/eyebrow="Prices"/)
  })

  it('hides tag + Yield % chips behind loadShowMarketsTagYieldChips pref', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/loadShowMarketsTagYieldChips/)
    expect(page).toMatch(/subscribeShowMarketsTagYieldChips/)
    expect(page).toMatch(/showMarketsTagYieldChips/)
    expect(page).toMatch(/activeTagFilter/)
    expect(page).toMatch(/MARKET_TICKER_TAGS/)
  })

  it('keeps Crypto/Equities/… jump chips in the sticky toolbar', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(page).toMatch(/markets-sticky-toolbar/)
    expect(page).toMatch(/SECTION_JUMP_LABEL/)
    expect(css).toMatch(/\.markets-sticky-toolbar/)
    expect(css).toMatch(/scroll-margin-top: calc\(var\(--app-header-offset/)
  })

  it('shell title no longer uses Watchlist eyebrow', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/'\/markets': \{ eyebrow: 'Prices', title: 'Markets' \}/)
    expect(shell).not.toMatch(/'\/markets': \{ eyebrow: 'Watchlist'/)
  })
})
