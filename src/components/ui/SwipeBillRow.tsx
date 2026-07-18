/** Touch swipe actions for Today bill rows (Mark paid / Skip). Desktop keeps inline buttons. */

import { useRef, useState, type ReactNode } from 'react'

interface SwipeBillRowProps {
  children: ReactNode
  onMarkPaid: () => void
  onSkip: () => void
  className?: string
}

const THRESHOLD = 72

export function SwipeBillRow({
  children,
  onMarkPaid,
  onSkip,
  className = '',
}: SwipeBillRowProps) {
  const startX = useRef(0)
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState<'left' | 'right' | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? 0
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const x = e.touches[0]?.clientX ?? 0
    const delta = x - startX.current
    if (Math.abs(delta) < 8) return
    setDx(Math.max(-110, Math.min(110, delta)))
  }

  const onTouchEnd = () => {
    if (dx <= -THRESHOLD) setOpen('left')
    else if (dx >= THRESHOLD) setOpen('right')
    else setOpen(null)
    setDx(0)
  }

  const shift = open === 'left' ? -96 : open === 'right' ? 96 : dx

  return (
    <div className={`swipe-bill-row relative overflow-hidden ${className}`}>
      <div className="absolute inset-y-0 left-0 flex w-24 items-stretch" aria-hidden={open !== 'right'}>
        <button
          type="button"
          tabIndex={open === 'right' ? 0 : -1}
          disabled={open !== 'right'}
          className="flex-1 bg-accent text-white text-xs font-bold uppercase tracking-wide disabled:opacity-100"
          onClick={() => {
            onMarkPaid()
            setOpen(null)
          }}
        >
          Mark paid
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-24 items-stretch" aria-hidden={open !== 'left'}>
        <button
          type="button"
          tabIndex={open === 'left' ? 0 : -1}
          disabled={open !== 'left'}
          className="flex-1 bg-surface-hover text-text text-xs font-bold uppercase tracking-wide border-l border-border disabled:opacity-100"
          onClick={() => {
            onSkip()
            setOpen(null)
          }}
        >
          Skip
        </button>
      </div>
      <div
        className="relative bg-bg-elevated transition-transform duration-150"
        style={{ transform: `translateX(${shift}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
