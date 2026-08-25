import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { shouldShowBottomNav } from '../hooks/useShowBottomNav'

describe('phone 390 layout punches (v1.2.117)', () => {
  it('caps floating banners so 1rem + max-w-sm cannot be 400px on a 390 frame', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/width:\s*min\(\s*24rem,/)
    expect(css).toMatch(/max-width:\s*calc\(100vw - 1\.5rem\)/)
    expect(css).toMatch(/html\s*\{[\s\S]*overflow-x:\s*clip/)
    const install = readFileSync(resolve(__dirname, '../components/InstallPrompt.tsx'), 'utf8')
    expect(install).toMatch(/install-prompt/)
    expect(install).not.toMatch(/max-w-sm/)
    expect(install).not.toMatch(/sm:right-auto/)
    const toast = readFileSync(resolve(__dirname, '../components/ToastProvider.tsx'), 'utf8')
    expect(toast).toMatch(/floating-banner--toast/)
    expect(toast).not.toMatch(/right-4/)
    expect(toast).not.toMatch(/w-\[calc\(100%-2rem\)\]/)
    const failover = readFileSync(resolve(__dirname, '../components/QuoteFailoverBanner.tsx'), 'utf8')
    expect(failover).toMatch(/floating-banner/)
    expect(failover).not.toMatch(/max-w-sm/)
    expect(failover).not.toMatch(/left-\[max/)
  })

  it('keeps phone toasts compact under the header so they do not cover Markets rows', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /orientation: landscape\) and \(max-height: 500px\)[\s\S]*floating-banner--toast[\s\S]*top:\s*calc\(var\(--app-header-offset/,
    )
    expect(css).toMatch(/floating-banner--toast[\s\S]*max-height:\s*3\.35rem/)
    expect(css).toMatch(/\.toast-extra/)
    const toast = readFileSync(resolve(__dirname, '../components/ToastProvider.tsx'), 'utf8')
    expect(toast).toMatch(/toast-extra/)
  })

  it('keeps tablet landscape sidebar only when the viewport is tall', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(
      /orientation: landscape\) and \(min-width: 768px\) and \(max-width: 1023px\) and \(min-height: 501px\)/,
    )
    expect(css).toMatch(/\.install-prompt\s*\{[\s\S]*display:\s*none/)
    expect(css).toMatch(/\.app-sidebar:not\(\.app-sidebar--open\)/)
    expect(css).toMatch(
      /orientation: landscape\) and \(max-height: 500px\)[\s\S]*\.page-header\s*\{[\s\S]*display:\s*none/,
    )
    const hook = readFileSync(resolve(__dirname, '../hooks/useShowBottomNav.ts'), 'utf8')
    expect(hook).toMatch(/min-height: 501px/)
    expect(hook).toMatch(/max-height: 500px/)
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/app-sidebar--open/)
  })

  it('short phone landscape still uses bottom nav (no leftover sidebar gutter)', () => {
    const match = (q: string) => ({
      matches:
        q.includes('min-width: 1024')
          ? false
          : q.includes('max-height: 500')
            ? true
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

  it('844×390 mouse-only desktop window still uses bottom nav (no leftover sidebar)', () => {
    const match = (q: string) => ({
      matches:
        q.includes('min-width: 1024')
          ? false
          : q.includes('max-height: 500')
            ? true
            : q.includes('min-height: 501')
              ? false
              : q.includes('orientation: landscape') && q.includes('min-width: 768')
                ? true
                : q.includes('min-width: 768')
                  ? true
                  : q.includes('hover: hover')
                    ? true
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
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
    expect(shouldShowBottomNav()).toBe(true)
    vi.unstubAllGlobals()
  })
})
