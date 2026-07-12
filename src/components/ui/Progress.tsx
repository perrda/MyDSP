interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: 'accent' | 'green' | 'red' | 'blue'
}

const SIZES = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

const COLORS = {
  accent: 'bg-accent',
  green: 'bg-green-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = 'md',
  color = 'accent',
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-text-muted">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-semibold tabular-nums">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-border-strong rounded-full overflow-hidden ${SIZES[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`${COLORS[color]} ${SIZES[size]} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function CircularProgress({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  label,
  color = 'accent',
}: {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  label?: string
  color?: 'accent' | 'green' | 'red' | 'blue'
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  const COLOR_MAP = {
    accent: 'var(--accent)',
    green: '#4ade80',
    red: '#f87171',
    blue: '#60a5fa',
  }

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLOR_MAP[color]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="text-sm font-bold tabular-nums"
          fill="currentColor"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          {Math.round(percentage)}%
        </text>
      </svg>
      {label && <span className="text-xs text-text-muted">{label}</span>}
    </div>
  )
}
