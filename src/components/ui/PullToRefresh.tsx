/** iOS/iPad-style pull-to-refresh — works with document scroll (AppShell). */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  /** Disable the gesture (e.g. desktop). Default: auto-disable when not touch. */
  disabled?: boolean
  threshold?: number
  /** Label while refreshing */
  refreshingLabel?: string
}

function isTouchUi(): boolean {
  if (typeof window === 'undefined') return false
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    /iPad|iPhone|iPod/i.test(navigator.userAgent)
  )
}

export function PullToRefresh({
  onRefresh,
  children,
  disabled,
  threshold = 72,
  refreshingLabel = 'Syncing…',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullDistanceRef = useRef(0)
  const trackingRef = useRef(false)
  const startYRef = useRef(0)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const effectivelyDisabled = disabled ?? !isTouchUi()

  const setDistance = useCallback((d: number) => {
    pullDistanceRef.current = d
    setPullDistance(d)
  }, [])

  useEffect(() => {
    if (effectivelyDisabled) return

    const atTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 2

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return
      if (!atTop()) {
        trackingRef.current = false
        return
      }
      trackingRef.current = true
      startYRef.current = e.touches[0]?.clientY ?? 0
      setDistance(0)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || refreshingRef.current) return
      if (!atTop()) {
        trackingRef.current = false
        setDistance(0)
        return
      }
      const y = e.touches[0]?.clientY ?? 0
      const delta = y - startYRef.current
      if (delta <= 0) {
        setDistance(0)
        return
      }
      // Prevent native overscroll bounce while pulling
      if (e.cancelable) e.preventDefault()
      const dampened = Math.min(delta * 0.45, threshold * 1.6)
      setDistance(dampened)
    }

    const onTouchEnd = () => {
      if (!trackingRef.current) return
      trackingRef.current = false
      const distance = pullDistanceRef.current
      if (distance >= threshold && !refreshingRef.current) {
        refreshingRef.current = true
        setIsRefreshing(true)
        setDistance(threshold)
        void (async () => {
          try {
            await onRefreshRef.current()
          } finally {
            refreshingRef.current = false
            setIsRefreshing(false)
            setDistance(0)
          }
        })()
      } else {
        setDistance(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [effectivelyDisabled, threshold, setDistance])

  if (effectivelyDisabled) {
    return <>{children}</>
  }

  const progress = Math.min((pullDistance / threshold) * 100, 100)
  const shouldTrigger = pullDistance >= threshold

  return (
    <div className="relative">
      <div
        className="pointer-events-none fixed left-0 right-0 z-40 flex justify-center"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 3.25rem)',
          opacity: pullDistance > 8 || isRefreshing ? 1 : 0,
          transform: `translateY(${Math.max(pullDistance * 0.35, isRefreshing ? 12 : 0)}px)`,
          transition: trackingRef.current ? 'none' : 'opacity 0.15s ease, transform 0.2s ease',
        }}
        aria-live="polite"
      >
        <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1.5 shadow-sm">
          <span className="ptr-ring" aria-hidden>
            <span className="ptr-ring-track" />
            <span
              className="ptr-ring-progress"
              style={{
                opacity: isRefreshing ? 1 : Math.max(progress / 100, 0.15),
                transform: `rotate(${isRefreshing ? 0 : progress * 3.6}deg)`,
                transition: isRefreshing ? undefined : 'opacity 0.1s ease',
                animation: isRefreshing ? 'spin 0.8s linear infinite' : undefined,
              }}
            />
            <RefreshCw
              size={12}
              strokeWidth={2.25}
              className={`absolute inset-0 m-auto ${
                isRefreshing || shouldTrigger ? 'text-accent' : 'text-text-muted'
              }`}
            />
          </span>
          <span className="text-[11px] font-medium text-text-muted">
            {isRefreshing
              ? refreshingLabel
              : shouldTrigger
                ? 'Release to sync'
                : 'Pull to sync'}
          </span>
        </div>
      </div>

      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.35}px)` : undefined,
          transition: trackingRef.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
