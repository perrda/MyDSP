import { useCallback } from 'react'

/** Skip to main content link */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}

/** Announce to screen readers */
export function useScreenReaderAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('sr-announcer')
    if (announcer) {
      announcer.setAttribute('aria-live', priority)
      announcer.textContent = message
      setTimeout(() => {
        announcer.textContent = ''
      }, 1000)
    }
  }, [])

  return { announce }
}

/** Screen reader announcer component */
export function ScreenReaderAnnouncer() {
  return (
    <div
      id="sr-announcer"
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    />
  )
}
