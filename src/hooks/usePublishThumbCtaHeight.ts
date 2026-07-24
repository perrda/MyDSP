import { useEffect } from 'react'

/**
 * Publishes the visible `.thumb-cta-bar` height to `--thumb-cta-height` on `:root`.
 * Spacers and floating banners clear the live bar (including multi-row wrap) instead of
 * a hardcoded 4.25rem guess. Clears to `0px` when no bar is displayed.
 */
export function usePublishThumbCtaHeight(deps: unknown[] = []): void {
  useEffect(() => {
    const root = document.documentElement
    let ro: ResizeObserver | null = null

    const publish = (el: Element | null) => {
      if (!el) {
        root.style.setProperty('--thumb-cta-height', '0px')
        return
      }
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') {
        root.style.setProperty('--thumb-cta-height', '0px')
        return
      }
      const h = Math.max(0, Math.ceil(el.getBoundingClientRect().height))
      root.style.setProperty('--thumb-cta-height', `${h}px`)
    }

    const attach = () => {
      const el = document.querySelector('.thumb-cta-bar')
      ro?.disconnect()
      ro = null
      if (el) {
        publish(el)
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => publish(el))
          ro.observe(el)
        }
      } else {
        publish(null)
      }
    }

    attach()
    const target = document.getElementById('main-content') ?? document.body
    const mo = new MutationObserver(attach)
    mo.observe(target, { childList: true, subtree: true })
    window.addEventListener('resize', attach)
    window.addEventListener('orientationchange', attach)

    return () => {
      mo.disconnect()
      ro?.disconnect()
      window.removeEventListener('resize', attach)
      window.removeEventListener('orientationchange', attach)
      root.style.removeProperty('--thumb-cta-height')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes route/layout deps
  }, deps)
}
