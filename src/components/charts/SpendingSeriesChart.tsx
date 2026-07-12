import { useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type ChartRange, formatChartTick, formatChartTooltipLabel } from '../../domain/history'
import { buildDailySpendSeries } from '../../domain/spendingChart'
import type { SpendingEntry } from '../../domain/types'
import { formatGBP, privacyClass } from '../../utils/format'
import { ChartRangeToolbar } from './ChartRangeToolbar'

const COLORS = ['var(--accent)', '#86efac', '#c4b5fd', '#67e8f9', '#fcd34d', '#9ca3af']

interface Props {
  spending: SpendingEntry[]
  privacy: boolean
}

export function SpendingSeriesChart({ spending, privacy }: Props) {
  const gradId = useId().replace(/:/g, '')
  const [range, setRange] = useState<ChartRange>('1M')
  const { points, categories, totalInRange } = useMemo(
    () => buildDailySpendSeries(spending, range),
    [spending, range],
  )

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        tick: formatChartTick(p.date, range),
      })),
    [points, range],
  )

  return (
    <div className="surface p-4 sm:p-6 lg:p-8 chart-panel mb-6">
      <div className="flex flex-col gap-4 mb-5">
        <div>
          <p className="label-uppercase mb-2">Burn</p>
          <h3 className="text-base sm:text-lg font-bold tracking-tight">Spending timeline</h3>
          <p className={`text-sm mt-2 tabular-nums text-text-muted ${privacyClass(privacy)}`}>
            {formatGBP(totalInRange)} in range · {range}
          </p>
        </div>
        <ChartRangeToolbar value={range} onChange={setRange} />
      </div>

      {chartData.length < 1 ? (
        <p className="text-sm text-text-subtle text-center py-12">
          Add expenses to see burn over time.
        </p>
      ) : (
        <div className={`h-56 sm:h-64 lg:h-72 w-full ${privacyClass(privacy)}`}>
          <p className="sr-only">
            Spending for {range}: total {formatGBP(totalInRange)} across {chartData.length} days.
            Top categories: {categories.join(', ')}.
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="tick"
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                minTickGap={32}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => formatGBP(v, { compact: true })}
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(v) => formatGBP(Number(v))}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { date?: string } | undefined
                  return formatChartTooltipLabel(row?.date ?? '')
                }}
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 0,
                  fontSize: 12,
                  color: 'var(--text)',
                }}
                labelStyle={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ color: 'var(--text)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="square"
                iconSize={10}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Cumulative"
                stroke="var(--accent)"
                fill={`url(#${gradId})`}
                strokeWidth={2}
              />
              {categories.map((cat, i) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  name={cat}
                  stackId="cats"
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.35}
                  strokeWidth={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
