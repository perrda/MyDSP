import { useCallback } from 'react'

/** Skip links — main content plus key in-page targets. */
export function SkipToContent() {
  return (
    <nav aria-label="Skip links" className="skip-links">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <a
        href="#sync-conflicts-panel"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:shadow-lg focus:mt-14"
      >
        Skip to sync conflicts
      </a>
      <a
        href="#markets-cached-mode-banner"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:shadow-lg focus:mt-28"
      >
        Skip to Markets cached banner
      </a>
    </nav>
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
