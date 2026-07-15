import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * On section / route changes, jump to the top of the page.
 * Hash deep-links (e.g. `/settings#sync`) are left alone so the target section can scroll into view.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
