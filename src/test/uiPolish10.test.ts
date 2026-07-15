import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { titleCaseHeader } from '../components/ui/PageHeader'

describe('UI polish Top 10 chrome', () => {
  it('defines tablet + desktop toolbar tiers with active-tier display', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.toolbar-actions-tablet/)
    expect(css).toMatch(/\.toolbar-actions-desktop/)
    expect(css).toMatch(/\.toolbar-actions-desktop\.is-active-tier/)
    const src = readFileSync(resolve(__dirname, '../components/layout/ToolbarControls.tsx'), 'utf8')
    expect(src).toMatch(/min-width: 768px/)
    expect(src).toMatch(/min-width: 1024px/)
  })

  it('keeps PageHeader titles phone-only to avoid double titles with the shell', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/PageHeader.tsx'), 'utf8')
    expect(src).toMatch(/md:hidden/)
    expect(src).toMatch(/md:flex-row/)
    expect(titleCaseHeader('compare portfolios')).toBe('Compare Portfolios')
  })

  it('animates modal sheets and lifts banners above the bottom nav', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/modal-sheet-up/)
    expect(css).toMatch(/html\.has-bottom-nav \.floating-banner/)
  })
})
