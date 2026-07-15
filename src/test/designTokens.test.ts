import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('design tokens — rounded edges + badge', () => {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

  it('documents REVERT ROUNDED EDGES and soft radius defaults', () => {
    expect(css).toMatch(/REVERT ROUNDED EDGES/)
    expect(css).toMatch(/--radius-box:\s*0\.5rem/)
    expect(css).toMatch(/--radius-control:\s*0\.375rem/)
    expect(css).toMatch(/--radius-pill:\s*9999px/)
  })

  it('styles the notification badge as a red circle with optional number', () => {
    expect(css).toMatch(/\.toolbar-icon-badge\s*\{/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)\s*!important/)
    expect(css).toMatch(/\.toolbar-icon-badge\.is-dot/)
    expect(css).toMatch(/background:\s*#ff3b30/)
  })

  it('defines Glass Mode frosted surfaces', () => {
    expect(css).toMatch(/html\.glass/)
    expect(css).toMatch(/backdrop-filter:\s*blur\(28px\)\s*saturate\(180%\)/)
    expect(css).toMatch(/html\.glass \.sync-chip/)
    expect(css).toMatch(/\.modal-sticky-header/)
    expect(css).toMatch(/\.floating-banner/)
    expect(css).toMatch(/\.bottom-nav-link--active/)
    expect(css).toMatch(/\.table-wrap/)
  })
})
