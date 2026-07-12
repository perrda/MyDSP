import { useCallback, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { CHART_RANGES, type ChartRange } from '../../domain/history'

interface Props {
  value: ChartRange
  onChange: (range: ChartRange) => void
  className?: string
  children?: ReactNode
}

/** Scrollable timescale control — works on phone, tablet, and desktop. */
export function ChartRangeToolbar({ value, onChange, className = '', children }: Props) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = useMemo(() => Math.max(0, CHART_RANGES.indexOf(value)), [value])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
        return
      }
      e.preventDefault()
      let next = activeIndex
      if (e.key === 'ArrowRight') next = Math.min(CHART_RANGES.length - 1, activeIndex + 1)
      if (e.key === 'ArrowLeft') next = Math.max(0, activeIndex - 1)
      if (e.key === 'Home') next = 0
      if (e.key === 'End') next = CHART_RANGES.length - 1
      onChange(CHART_RANGES[next])
      btnRefs.current[next]?.focus()
    },
    [activeIndex, onChange],
  )

  return (
    <div className={`chart-range-toolbar ${className}`}>
      <div
        className="chart-range-scroll"
        role="toolbar"
        aria-label="Chart time range"
        onKeyDown={onKeyDown}
      >
        {CHART_RANGES.map((r, i) => (
          <button
            key={r}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            className={`chart-range-btn ${value === r ? 'is-active' : ''}`}
            aria-pressed={value === r}
            tabIndex={value === r ? 0 : -1}
            onClick={() => onChange(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {children ? <div className="chart-range-actions">{children}</div> : null}
    </div>
  )
}
