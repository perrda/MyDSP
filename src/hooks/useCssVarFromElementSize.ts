import { useEffect, type RefObject } from 'react'

/**
 * Publishes an element's height to a CSS custom property on :root.
 * Used so sticky section headers sit exactly under sticky toolbars
 * (avoids list rows peeking into the gap above a hardcoded `top` offset).
 */
export function useCssVarFromElementSize(
  ref: RefObject<HTMLElement | null>,
  cssVar: `--${string}`,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const publish = () => {
      const h = Math.max(0, Math.ceil(el.getBoundingClientRect().height))
      root.style.setProperty(cssVar, `${h}px`)
    }
    publish()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    ro?.observe(el)
    window.addEventListener('resize', publish)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', publish)
      root.style.removeProperty(cssVar)
    }
  }, [ref, cssVar])
}
