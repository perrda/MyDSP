import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { titleCaseHeader } from '../components/ui/PageHeader'

describe('UI polish Top 10 chrome', () => {
  it('surfaces More-menu toolbar controls on all viewports (manual Refresh only there)', () => {
    const toolbar = readFileSync(
      resolve(__dirname, '../components/layout/ToolbarControls.tsx'),
      'utf8',
    )
    expect(toolbar).toMatch(/Refresh · Privacy · Theme · Glass · Search/)
    expect(toolbar).toMatch(/More workspace controls/)
    expect(toolbar).not.toMatch(/toolbar-actions-desktop/)
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
