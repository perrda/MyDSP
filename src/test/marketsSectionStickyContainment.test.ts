import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Markets section sticky row containment (v1.2.92)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.100')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.100')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.100',
      '1.2.99',
      '1.2.98',
      '1.2.97',
      '1.2.96',
    ])
  })

  it('Markets sections do not use overflow-hidden with sticky headers', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-section/)
    expect(page).toMatch(/markets-section-sticky/)
    expect(page).toMatch(/marketsToolbarRef/)
    expect(page).toMatch(/useCssVarFromElementSize\(marketsToolbarRef/)
    // Section shell must not clip sticky headers / row chrome
    expect(page).not.toMatch(/markets-section[^\n]*overflow-hidden/)
    expect(page).not.toMatch(/bg-bg-elevated overflow-hidden/)
  })

  it('CSS uses measured toolbar height + opaque sticky header', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/--markets-toolbar-height/)
    expect(css).toMatch(/\.markets-section\s*\{/)
    expect(css).toMatch(/overflow:\s*visible/)
    expect(css).toMatch(/\.markets-section-sticky[\s\S]*?background-color:\s*var\(--bg-elevated\)/)
    expect(css).toMatch(/\.markets-section-sticky[\s\S]*?backdrop-filter:\s*none/)
    expect(css).toMatch(/--holdings-search-height/)
    expect(css).toMatch(/\.holdings-sticky-totals[\s\S]*?--holdings-search-height/)
  })

  it('Equities + Crypto measure holdings search for sticky totals', () => {
    for (const file of ['EquitiesPage.tsx', 'CryptoPage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/holdingsSearchRef/)
      expect(src).toMatch(/useCssVarFromElementSize\(holdingsSearchRef/)
      expect(src).toMatch(/holdings-sticky-totals/)
    }
  })

  it('cursor rule documents sticky section policy', () => {
    const rule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/sticky-section-headers.mdc'),
      'utf8',
    )
    expect(rule).toMatch(/alwaysApply: true/)
    expect(rule).toMatch(/overflow: hidden/)
    expect(rule).toMatch(/ResizeObserver/)
  })
})
