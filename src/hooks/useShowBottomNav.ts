import { useEffect, useState } from 'react'

/**
 * Bottom tab bar is for phone + tablet touch layouts.
 * Hide on desktop web when the sidebar is permanent (≥1024px), or when the
 * device is mouse-only (no touch points) — so narrow desktop windows don't
 * keep a redundant tab bar.
 */
function shouldShowBottomNav(): boolean {
  if (typeof window === 'undefined') return true
  const wideDesktop = window.matchMedia('(min-width: 1024px)').matches
  if (wideDesktop) return false
  const mouseOnly =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    navigator.maxTouchPoints === 0
  return !mouseOnly
}

/** True when the mobile/tablet bottom tab bar should be shown. */
export function useShowBottomNav(): boolean {
  const [show, setShow] = useState(shouldShowBottomNav)

  useEffect(() => {
    const wideMq = window.matchMedia('(min-width: 1024px)')
    const pointerMq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setShow(shouldShowBottomNav())
    update()
    wideMq.addEventListener('change', update)
    pointerMq.addEventListener('change', update)
    return () => {
      wideMq.removeEventListener('change', update)
      pointerMq.removeEventListener('change', update)
    }
  }, [])

  return show
}
