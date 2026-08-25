import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { shouldShowBottomNav } from '../hooks/useShowBottomNav'

describe('phone 390 layout punches (v1.2.117)', () => {
  it('caps floating banners so 1rem + max-w-sm cannot be 400px on a 390 frame', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/max-width:\s*min\(24rem,\s*calc\(100vw - 2rem\)\)/)
    const install = readFileSync(resolve(__dirname, '../components/InstallPrompt.tsx'), 'utf8')
    expect(install).toMatch(/install-prompt/)
    expect(install).not.toMatch(/max-w-sm/)
    expect(install).not.toMatch(/sm:right-auto/)
    const toast = readFileSync(resolve(__dirname, '../components/ToastProvider.tsx'), 'utf8')
    expect(toast).toMatch(/floating-banner--toast/)
    expect(toast).not.toMatch(/right-4/)
    expect(toast).not.toMatch(/w-\[calc\(100%-2rem\)\]/)
  })

  it('docks phone toasts under the header so they do not cover Markets rows', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/max-width:\s*639px\)[\s\S]*floating-banner--toast[\s\S]*bottom:\s*auto/)
    expect(css).toMatch(/--app-header-offset/)
  })

  it('keeps tablet landscape sidebar only when the viewport is tall', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /orientation: landscape\) and \(min-width: 768px\) and \(max-width: 1023px\) and \(min-height: 501px\)/,
    )
    expect(css).toMatch(/\.install-prompt\s*\{[\s\S]*display:\s*none/)
    const hook = readFileSync(resolve(__dirname, '../hooks/useShowBottomNav.ts'), 'utf8')
    expect(hook).toMatch(/min-height: 501px/)
  })

  it('short phone landscape still uses bottom nav (no leftover sidebar gutter)', () => {
    const match = (q: string) => ({
      matches:
        q.includes('min-width: 1024')
          ? false
          : q.includes('min-height: 501')
            ? false
            : q.includes('orientation: landscape') && q.includes('min-width: 768')
              ? true
              : q.includes('min-width: 768')
                ? true
                : q.includes('hover: hover')
                  ? false
                  : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })
    vi.stubGlobal('matchMedia', vi.fn(match))
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, configurable: true })
    expect(shouldShowBottomNav()).toBe(true)
    vi.unstubAllGlobals()
  })
})
