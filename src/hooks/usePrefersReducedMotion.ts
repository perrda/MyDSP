import { useEffect, useState } from 'react'
import { loadA11yReducedMotion } from '../utils/a11yPrefs'

/** True when the user prefers reduced motion (system or Settings override). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    if (loadA11yReducedMotion()) return true
    if (!window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const read = () => {
      if (loadA11yReducedMotion()) {
        setReduced(true)
        return
      }
      if (!window.matchMedia) {
        setReduced(false)
        return
      }
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }
    read()
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onChange = () => read()
    mq?.addEventListener('change', onChange)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mydsp_a11y_reduced_motion') read()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('mydsp-a11y-change', onChange)
    return () => {
      mq?.removeEventListener('change', onChange)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('mydsp-a11y-change', onChange)
    }
  }, [])

  return reduced
}
