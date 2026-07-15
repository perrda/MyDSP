/** Toolbar toggle for Glass Mode (frosted surfaces). */

import { useGlass } from '../context/GlassContext'

export function GlassToggle({ className = '' }: { className?: string }) {
  const { glass, toggle } = useGlass()
  const title = glass ? 'Turn Glass Mode off' : 'Turn Glass Mode on'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={title}
      aria-pressed={glass}
      title={title}
      className={`toolbar-icon ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden="true" fill="none">
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.6"
          opacity={glass ? 0.35 : 1}
        />
        <path
          d="M7 14.5c2.2-4.5 7.8-4.5 10 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={glass ? 1 : 0.45}
        />
        <circle cx="9.2" cy="9" r="1.15" fill="currentColor" opacity={glass ? 1 : 0.55} />
        <circle cx="14.8" cy="9" r="1.15" fill="currentColor" opacity={glass ? 1 : 0.55} />
      </svg>
    </button>
  )
}
