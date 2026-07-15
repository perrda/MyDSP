import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { titleCaseHeader } from '../components/ui/PageHeader'

describe('UI polish Top 10 chrome', () => {
  it('surfaces full toolbar actions from tablet widths (768px)', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /@media \(min-width:\s*768px\)\s*\{[\s\S]*?\.toolbar-actions-desktop\s*\{[\s\S]*?display:\s*flex/,
    )
  })

  it('keeps PageHeader titles phone-only to avoid double titles with the shell', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/PageHeader.tsx'), 'utf8')
    expect(src).toMatch(/sm:hidden/)
    expect(src).toMatch(/sm:flex-row/)
    expect(titleCaseHeader('compare portfolios')).toBe('Compare Portfolios')
  })

  it('animates modal sheets and lifts banners above the bottom nav', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/modal-sheet-up/)
    expect(css).toMatch(/html\.has-bottom-nav \.floating-banner/)
  })
})
