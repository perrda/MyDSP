import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('bottom-nav editor entry and accessibility', () => {
  it('dispatches from the toolbar and opens the existing editor', () => {
    const toolbar = readFileSync(
      resolve(__dirname, '../components/layout/ToolbarControls.tsx'),
      'utf8',
    )
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')

    expect(toolbar).toMatch(/aria-label="Edit bottom tabs"/)
    expect(toolbar).toMatch(/dispatchEvent\(new CustomEvent\('mydsp-open-bottom-nav-editor'\)\)/)
    expect(nav).toMatch(/addEventListener\('mydsp-open-bottom-nav-editor'/)
    expect(nav).toMatch(/removeEventListener\('mydsp-open-bottom-nav-editor'/)
    expect(nav).toMatch(/if \(!show && !favSheetOpen\) return null/)
  })

  it('provides keyboard move controls and motion-safe focus treatment', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

    expect(nav).toMatch(/aria-label=\{`Move \$\{item\.label\} up`\}/)
    expect(nav).toMatch(/aria-label=\{`Move \$\{item\.label\} down`\}/)
    expect(nav).toMatch(/moveIndex\(middleItems, index, index [-+] 1\)/)
    expect(css).toMatch(/\.bottom-nav-editor-sheet button:focus-visible/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bottom-nav-editor-sheet/,
    )
  })
})
