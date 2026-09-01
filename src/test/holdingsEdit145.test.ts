import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function overflowItems(src: string): string {
  const block = src.match(/<OverflowMenu[\s\S]*?\/>/)?.[0] ?? ''
  return block
}

describe('MyDSP 1.2.145 holdings ⋯ Edit menu', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.149')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.149')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.149',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.145\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Edit and Delete/)
    expect(section).toMatch(/document\.body/)
    expect(section).toMatch(/qty, price/)
    expect(section).toMatch(/commentary/)
    expect(section).toMatch(/BTC/)
    expect(section).toMatch(/ADA/)
    expect(section).toMatch(/#F7931A/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(section).toMatch(/1\.2\.144/)
    expect(section).toMatch(/1\.2\.143/)
    expect(section).toMatch(/index-BS8ANJ_Z\.js/)
    expect(section).toMatch(/onSell/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Holdings ⋯ Edit \(v1\.2\.145\)/)
    const shipped = changelog.match(/## \[1\.2\.144\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(shipped).toMatch(/capital window labels/)
    expect(shipped).not.toMatch(/overflow: hidden/)
    const family = changelog.match(/## \[1\.2\.143\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(family).toMatch(/Thomas \+ Rebecca/)
    expect(family).not.toMatch(/overflow: hidden/)
  })

  it('Equities SwipeHoldingRow passes onSell like Crypto', () => {
    const swipeBlock = (src: string) => src.match(/<SwipeHoldingRow[\s\S]*?<\/SwipeHoldingRow>/)?.[0] ?? ''
    const equities = swipeBlock(read('../pages/EquitiesPage.tsx'))
    const crypto = swipeBlock(read('../pages/CryptoPage.tsx'))
    for (const block of [equities, crypto]) {
      expect(block).toMatch(/onBuy=\{\(\) => \{/)
      expect(block).toMatch(/setTradeSide\('buy'\)/)
      expect(block).toMatch(/onSell=\{\(\) => \{/)
      expect(block).toMatch(/setTradeSide\('sell'\)/)
      expect(block).toMatch(/onToggleNw/)
    }
  })

  it('OverflowMenu portals a fixed sheet so swipe overflow cannot clip it', () => {
    const menu = read('../components/ui/OverflowMenu.tsx')
    expect(menu).toMatch(/createPortal/)
    expect(menu).toMatch(/document\.body/)
    expect(menu).toMatch(/overflow-menu-sheet--anchored/)
    expect(menu).toMatch(/data-testid="overflow-menu-sheet"/)
    expect(menu).toMatch(/getBoundingClientRect/)
    expect(menu).not.toMatch(/sm:absolute/)
    const css = read('../index.css')
    expect(css).toMatch(/\.overflow-menu-sheet--anchored/)
    expect(css).toMatch(/position:\s*fixed/)
    expect(css).toMatch(/z-index:\s*80/)
    expect(css).toMatch(/background-color:\s*var\(--bg-elevated\)/)
  })

  it('equity and crypto list ⋯ offer Edit + Delete only', () => {
    const equities = overflowItems(read('../pages/EquitiesPage.tsx'))
    const crypto = overflowItems(read('../pages/CryptoPage.tsx'))
    for (const block of [equities, crypto]) {
      expect(block).toMatch(/id: 'edit'/)
      expect(block).toMatch(/label: 'Edit'/)
      expect(block).toMatch(/id: 'delete'/)
      expect(block).not.toMatch(/id: 'buy'/)
      expect(block).not.toMatch(/id: 'sell'/)
      expect(block).not.toMatch(/id: 'nw'/)
      expect(block).toMatch(/compact/)
    }
  })

  it('Edit sheet has Edit / Buy / Sell plus qty, price, date, commentary', () => {
    const bar = read('../components/ui/HoldingActionModeBar.tsx')
    expect(bar).toMatch(/data-testid=\{`holding-action-\$\{item\}`\}/)
    expect(bar).toMatch(/item === 'edit' \? 'Edit'/)
    expect(bar).toMatch(/'buy' \? 'Buy'/)
    expect(bar).toMatch(/'edit' \| 'buy' \| 'sell'/)
    const trade = read('../components/ui/TradeModal.tsx')
    expect(trade).toMatch(/toolbar\?: ReactNode/)
    expect(trade).toMatch(/setSide\(defaultSide\)/)
    for (const page of [read('../pages/EquitiesPage.tsx'), read('../pages/CryptoPage.tsx')]) {
      expect(page).toMatch(/HoldingActionModeBar/)
      expect(page).toMatch(/asOfDate/)
      expect(page).toMatch(/commentary/)
      expect(page).toMatch(/As-of date/)
      expect(page).toMatch(/nextCommentaryId/)
      expect(page).toMatch(/switchHoldingAction/)
      expect(page).toMatch(/openEdit/)
    }
  })
})
