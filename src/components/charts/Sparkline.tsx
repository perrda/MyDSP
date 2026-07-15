import { useId, useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { sparklineYDomain } from '../../domain/sparklineSeries'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  showGradient?: boolean
  trend?: 'up' | 'down' | 'neutral'
}

export function Sparkline({
  data,
  color = 'var(--accent)',
  height = 32,
  showGradient = true,
  trend,
}: SparklineProps) {
  const reactId = useId().replace(/:/g, '')
  const gradId = `sparklineGradient-${reactId}`

  const { chartData, yDomain } = useMemo(() => {
    const values = data.filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
    return {
      chartData: values.map((value, index) => ({ index, value })),
      yDomain: sparklineYDomain(values),
    }
  }, [data])

  const trendColor = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : color

  if (chartData.length < 2) {
    return <div style={{ height }} className="w-full" aria-hidden />
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          {/* Scale to the series — default Recharts Y domain [0,'auto'] flattens weekly moves */}
          <YAxis domain={yDomain} hide width={0} />
          {showGradient && (
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={trendColor}
            strokeWidth={1.5}
            fill={showGradient ? `url(#${gradId})` : 'none'}
            baseValue={yDomain[0]}
            dot={false}
            isAnimationActive={false}
            animationDuration={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface MiniBarChartProps {
  data: number[]
  color?: string
  height?: number
  maxValue?: number
}

export function MiniBarChart({ data, color = 'var(--accent)', height = 32, maxValue }: MiniBarChartProps) {
  const max = maxValue ?? Math.max(...data, 1)

  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((value, index) => {
        const percentage = (value / max) * 100
        return (
          <div
            key={index}
            className="flex-1 transition-all duration-300 ease-out rounded-t-sm"
            style={{
              height: `${percentage}%`,
              backgroundColor: color,
              opacity: 0.7 + (percentage / 100) * 0.3,
            }}
            title={`${value}`}
          />
        )
      })}
    </div>
  )
}

interface TrendIndicatorProps {
  value: number
  previousValue?: number
  format?: (value: number) => string
  showPercentage?: boolean
}

export function TrendIndicator({
  value,
  previousValue,
  format = (v) => v.toFixed(2),
  showPercentage = true,
}: TrendIndicatorProps) {
  if (previousValue === undefined) {
    return <span className="text-sm text-text-muted">{format(value)}</span>
  }

  const change = value - previousValue
  const percentChange = previousValue !== 0 ? (change / Math.abs(previousValue)) * 100 : 0
  const isPositive = change > 0
  const isNeutral = change === 0

  const color = isNeutral ? 'text-text-muted' : isPositive ? 'text-green-500' : 'text-red-500'
  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓'

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{format(value)}</span>
      <span className={`text-xs font-semibold flex items-center gap-0.5 ${color}`}>
        <span className="text-base">{arrow}</span>
        {showPercentage && (
          <span className="tabular-nums">
            {isNeutral ? '0' : Math.abs(percentChange).toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  )
}

interface DeltaBadgeProps {
  value: number
  threshold?: number
  invertColors?: boolean
}

export function DeltaBadge({ value, threshold = 0, invertColors = false }: DeltaBadgeProps) {
  const isPositive = invertColors ? value <= threshold : value >= threshold
  const color = isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
  const sign = value > 0 ? '+' : ''

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded ${color}`}
    >
      {sign}
      {value.toFixed(1)}%
    </span>
  )
}
