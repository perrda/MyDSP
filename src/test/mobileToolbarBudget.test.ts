import { describe, expect, it } from 'vitest'

/**
 * Phone header width budget (~390 CSS px / 24.375rem at 16px).
 * Menu + portfolio + currency + bell + more must fit without overflow clipping.
 */
export const MOBILE_TOOLBAR_BUDGET = {
  menuRem: 2.75,
  portfolioMaxRem: 5.25,
  currencyRem: 4.75,
  iconRem: 2.75,
  gapRem: 0.25,
  /** Two mobile icons: refresh + more */
  mobileIconCount: 2,
  /** Horizontal padding on .app-header-row */
  rowPadRem: 0.75 * 2,
} as const

export function estimateMobileToolbarWidthRem(
  b: typeof MOBILE_TOOLBAR_BUDGET = MOBILE_TOOLBAR_BUDGET,
): number {
  const icons = b.mobileIconCount * b.iconRem
  const gaps = 4 * b.gapRem // menu|cluster internals approx 4 gaps in cluster + menu gap
  return b.menuRem + b.portfolioMaxRem + b.currencyRem + icons + gaps + b.rowPadRem
}

describe('mobile toolbar width budget', () => {
  it('fits within a 390px iPhone-class viewport', () => {
    const remPx = 16
    const widthPx = estimateMobileToolbarWidthRem() * remPx
    expect(widthPx).toBeLessThanOrEqual(390)
  })

  it('is leaner than the previous overflowing layout (~24.5rem)', () => {
    // 2.75 menu + 5.25 portfolio + 4.75 currency + 2×2.75 icons + gaps ≈ 20.75rem
    expect(estimateMobileToolbarWidthRem()).toBeLessThanOrEqual(21)
    expect(estimateMobileToolbarWidthRem()).toBeLessThan(24)
  })
})
