import { useId, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatChartYTick } from '../../domain/chartAxis'
import type { NwTrendPoint } from '../../domain/netWorthSparkline'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { formatGBP, privacyClass } from '../../utils/format'

interface Props {
  points: NwTrendPoint[]
  trend?: 'up' | 'down' | 'neutral'
  privacy?: boolean
  height?: number
}

export function TodayTrendChart({ points, trend, privacy = false, height = 176 }: Props) {
  const reactId = useId().replace(/:/g, '')
  const gradId = `today-trend-${reactId}`
  const reduceMotion = usePrefersReducedMotion()
  const trendColor = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : 'var(--accent)'

  const chartData = useMemo(
    () => points.filter((p) => Number.isFinite(p.value)).map((p) => ({ ...p })),
    [points],
  )

  if (chartData.length < 2) {
    return <div style={{ height }} className="w-full" aria-hidden />
  }

  const tickKeys = chartData.map((p) => p.key)
  const maxTicks = chartData.length <= 24 ? chartData.length : 8
  const shownTicks = (() => {
    if (tickKeys.length <= maxTicks) return tickKeys
    const out = [tickKeys[0]!]
    const step = (tickKeys.length - 1) / (maxTicks - 1)
    for (let i = 1; i < maxTicks - 1; i++) out.push(tickKeys[Math.round(i * step)]!)
    out.push(tickKeys[tickKeys.length - 1]!)
    return [...new Set(out)]
  })()

  return (
    <div
      className={`today-trend-chart w-full min-w-0 ${privacyClass(privacy)}`}
      style={{ height }}
      data-testid="today-trend-chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeOpacity={0.45} />
          <XAxis
            dataKey="key"
            ticks={shownTicks}
            tickFormatter={(key: string) => chartData.find((r) => r.key === key)?.label ?? ''}
            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            minTickGap={10}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => formatChartYTick(v)}
            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v) => formatGBP(Number(v))}
            labelFormatter={(key) => chartData.find((r) => r.key === key)?.label ?? ''}
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 0,
              fontSize: 12,
              color: 'var(--text)',
            }}
            labelStyle={{ color: 'var(--text-muted)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--text)' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Assets"
            stroke={trendColor}
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={!reduceMotion}
            animationDuration={reduceMotion ? 0 : 500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
