import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('bottom-nav editor entry and accessibility', () => {
  it('does not open a bottom-tab editor — five-door IA is fixed', () => {
    const toolbar = readFileSync(
      resolve(__dirname, '../components/layout/ToolbarControls.tsx'),
      'utf8',
    )
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')

    expect(toolbar).not.toMatch(/Edit bottom tabs/)
    expect(toolbar).not.toMatch(/mydsp-open-bottom-nav-editor/)
    expect(nav).not.toMatch(/favSheetOpen/)
    expect(nav).toMatch(/isDigestLongPressItem/)
    expect(nav).toMatch(/resolveBottomNavItems/)
  })

  it('long-press Today still opens the weekly digest', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/dispatchWeeklyDigestOpen/)
    expect(nav).toMatch(/lastOverviewTap/)
  })
})
