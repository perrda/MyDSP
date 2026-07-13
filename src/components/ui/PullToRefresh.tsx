// Pull-to-refresh component for mobile
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  disabled?: boolean
  threshold?: number
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  disabled = false,
  threshold = 80 
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [canPull, setCanPull] = useState(false)
  
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disabled || !containerRef.current) return

    const container = containerRef.current
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull if scrolled to top
      if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY
        startY.current = touchStartY
        setCanPull(true)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull || isRefreshing) return

      const touchY = e.touches[0].clientY
      const distance = touchY - startY.current

      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault()
        const dampened = Math.min(distance * 0.5, threshold * 1.5)
        setPullDistance(dampened)
      }
    }

    const handleTouchEnd = async () => {
      if (!canPull) return
      
      setCanPull(false)

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)
        setPullDistance(threshold)
        
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [canPull, pullDistance, threshold, disabled, isRefreshing, onRefresh])

  const progress = Math.min((pullDistance / threshold) * 100, 100)
  const shouldTrigger = pullDistance >= threshold

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto">
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none transition-transform"
        style={{ 
          transform: `translateY(${Math.max(pullDistance - 40, 0)}px)`,
          opacity: pullDistance > 0 ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative w-8 h-8">
            <RefreshCw 
              size={20}
              className={`absolute inset-0 m-auto transition-all ${
                isRefreshing ? 'animate-spin text-accent' : 
                shouldTrigger ? 'text-accent rotate-180' : 
                'text-text-muted'
              }`}
              style={{
                transform: isRefreshing ? '' : `rotate(${progress * 1.8}deg)`,
              }}
            />
          </div>
          <p className="text-xs font-medium text-text-muted">
            {isRefreshing ? 'Refreshing...' : shouldTrigger ? 'Release to refresh' : 'Pull to refresh'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div 
        style={{ 
          transform: `translateY(${pullDistance > 0 ? pullDistance : 0}px)`,
          transition: canPull ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
