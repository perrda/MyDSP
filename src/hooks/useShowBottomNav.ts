import { useEffect, useState } from 'react'

export type LayoutMode = 'phone' | 'tablet' | 'desktop'

/**
 * Layout mode for chrome:
 * - desktop (≥1024px): permanent sidebar, no bottom nav
 * - landscape tablet (orientation landscape + ≥768px): sticky sidebar, no bottom nav
 * - tablet (768–1023px portrait, or touch + mid width): bottom nav with roomier tabs
 * - phone (<768px): compact bottom nav
 */
function detectLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'phone'
  const wideDesktop = window.matchMedia('(min-width: 1024px)').matches
  if (wideDesktop) return 'desktop'
  // Landscape iPad / tablet: prefer sticky sidebar over bottom-nav
  const landscapeTablet = window.matchMedia(
    '(orientation: landscape) and (min-width: 768px)',
  ).matches
  if (landscapeTablet) return 'desktop'
  // Mouse-only browsers keep desktop chrome (sidebar) even when the window is narrow
  const mouseOnly =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    navigator.maxTouchPoints === 0
  if (mouseOnly) return 'desktop'
  const tabletWidth = window.matchMedia('(min-width: 768px)').matches
  if (tabletWidth || navigator.maxTouchPoints > 0) {
    return tabletWidth ? 'tablet' : 'phone'
  }
  return 'phone'
}

/** Bottom tab bar for phone + tablet touch layouts (hidden on desktop sidebar). */
function shouldShowBottomNav(): boolean {
  return detectLayoutMode() !== 'desktop'
}

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(detectLayoutMode)
  useEffect(() => {
    const wideMq = window.matchMedia('(min-width: 1024px)')
    const midMq = window.matchMedia('(min-width: 768px)')
    const landscapeMq = window.matchMedia('(orientation: landscape)')
    const landscapeTabletMq = window.matchMedia(
      '(orientation: landscape) and (min-width: 768px)',
    )
    const pointerMq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setMode(detectLayoutMode())
    update()
    wideMq.addEventListener('change', update)
    midMq.addEventListener('change', update)
    landscapeMq.addEventListener('change', update)
    landscapeTabletMq.addEventListener('change', update)
    pointerMq.addEventListener('change', update)
    return () => {
      wideMq.removeEventListener('change', update)
      midMq.removeEventListener('change', update)
      landscapeMq.removeEventListener('change', update)
      landscapeTabletMq.removeEventListener('change', update)
      pointerMq.removeEventListener('change', update)
    }
  }, [])
  return mode
}

/** True when the mobile/tablet bottom tab bar should be shown. */
export function useShowBottomNav(): boolean {
  const mode = useLayoutMode()
  return mode !== 'desktop'
}

export { shouldShowBottomNav }
