import { useTheme } from '../context/ThemeContext'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, preference, toggle } = useTheme()
  const isDark = theme === 'dark'
  const title =
    preference === 'auto'
      ? isDark
        ? 'Auto night · tap for Light'
        : 'Auto day · tap for Dark'
      : isDark
        ? 'Switch to light mode'
        : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={title}
      aria-pressed={!isDark}
      title={title}
      className={`toolbar-icon ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden="true">
        <defs>
          <mask id="mydsp-moon-mask">
            <rect x="0" y="0" width="24" height="24" fill="#fff" />
            <circle
              cx={isDark ? 16 : 30}
              cy={isDark ? 8 : -6}
              r="9"
              fill="#000"
              style={{
                transition:
                  'cx 0.5s cubic-bezier(0.4,0,0.2,1), cy 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </mask>
        </defs>
        <circle
          cx="12"
          cy="12"
          r={isDark ? 7 : 5}
          fill="currentColor"
          mask="url(#mydsp-moon-mask)"
          style={{ transition: 'r 0.45s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <g
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
          style={{
            transformOrigin: '12px 12px',
            transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
            transform: isDark ? 'scale(0.4) rotate(-40deg)' : 'scale(1) rotate(0deg)',
            opacity: isDark ? 0 : 1,
          }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="1.5"
              x2="12"
              y2="3.8"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </g>
      </svg>
    </button>
  )
}
