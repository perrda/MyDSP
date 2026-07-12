import { useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  filterByRange,
  formatChartTick,
  rangeChange,
  type ChartRange,
} from '../../domain/history'
import type { HistoryPoint } from '../../domain/types'
import { formatGBP, formatPct, privacyClass } from '../../utils/format'
import { ChartRangeToolbar } from './ChartRangeToolbar'

export type SeriesKey = 'netWorth' | 'crypto' | 'equity' | 'liabilities' | 'assets'

interface SeriesDef {
  key: SeriesKey
  name: string
  color: string
  dashed?: boolean
}

const SERIES: SeriesDef[] = [
  { key: 'netWorth', name: 'Net worth', color: 'var(--accent)' },
  { key: 'crypto', name: 'Crypto', color: '#c4b5fd' },
  { key: 'equity', name: 'Equities', color: '#86efac' },
  { key: 'liabilities', name: 'Debt', color: '#9ca3af', dashed: true },
  { key: 'assets', name: 'Assets', color: '#67e8f9' },
]

interface Props {
  history: HistoryPoint[]
  privacy: boolean
  title?: string
  eyebrow?: string
  /** Primary series drawn as area fill. */
  primary?: SeriesKey
  /** Extra line series (always shown when listed). */
  lines?: SeriesKey[]
  /** Allow toggling breakdown layers. */
  allowLayers?: boolean
  defaultRange?: ChartRange
  /** When true, falling values (e.g. debt) show as positive accent. */
  invertDelta?: boolean
  onSnapshot?: () => void
  heightClass?: string
  className?: string
}

export function PortfolioSeriesChart({
  history,
  privacy,
  title = 'Timeline',
  eyebrow = 'History',
  primary = 'netWorth',
  lines = [],
  allowLayers = false,
  defaultRange = '12M',
  invertDelta = false,
  onSnapshot,
  heightClass = 'h-64 sm:h-72 lg:h-80',
  className = '',
}: Props) {
  const gradId = useId().replace(/:/g, '')
  const [range, setRange] = useState<ChartRange>(defaultRange)
  const [showLayers, setShowLayers] = useState(false)

  const filtered = useMemo(() => filterByRange(history, range), [history, range])
  const delta = useMemo(
    () => rangeChange(history, range, (p) => (p[primary] as number | undefined) ?? p.netWorth),
    [history, range, primary],
  )

  const activeLines = showLayers
    ? SERIES.filter((s) => s.key !== primary).map((s) => s.key)
    : lines

  const chartData = useMemo(
    () =>
      filtered.map((h) => ({
        tick: formatChartTick(h.date, range, h.at),
        fullDate: h.at ?? h.date,
        netWorth: h.netWorth,
        crypto: h.crypto ?? 0,
        equity: h.equity ?? 0,
        liabilities: h.liabilities ?? 0,
        assets: h.assets ?? (h.crypto ?? 0) + (h.equity ?? 0),
      })),
    [filtered, range],
  )

  const primaryDef = SERIES.find((s) => s.key === primary) ?? SERIES[0]

  return (
    <div className={`surface p-4 sm:p-6 lg:p-8 chart-panel ${className}`}>
      <div className="flex flex-col gap-4 mb-5 sm:mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-uppercase mb-2">{eyebrow}</p>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">{title}</h3>
            {delta && (
              <p
                className={`text-sm mt-2 tabular-nums ${
                  (invertDelta ? delta.change <= 0 : delta.change >= 0)
                    ? 'text-accent'
                    : 'text-text-muted'
                }`}
              >
                {formatGBP(delta.change, { signed: true })} · {formatPct(delta.pct)} · {range}
              </p>
            )}
          </div>
          {onSnapshot && (
            <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onSnapshot}>
              Snapshot
            </button>
          )}
        </div>

        <ChartRangeToolbar value={range} onChange={setRange}>
          {allowLayers && (
            <button
              type="button"
              className={`chart-range-btn ${showLayers ? 'is-active' : ''}`}
              aria-pressed={showLayers}
              onClick={() => setShowLayers((v) => !v)}
            >
              Layers
            </button>
          )}
        </ChartRangeToolbar>
      </div>

      {chartData.length < 2 ? (
        <p className="text-text-subtle font-light text-sm py-14 sm:py-16 text-center px-4">
          Need at least two snapshots in this range. Use Snapshot or keep using MyDSP daily.
        </p>
      ) : (
        <div className={`${heightClass} w-full ${privacyClass(privacy)}`}>
          <p className="sr-only">
            {title} for {range}
            {delta
              ? `: change ${formatGBP(delta.change, { signed: true })} (${formatPct(delta.pct)}) from ${formatGBP(Number(chartData[0][primary]))} to ${formatGBP(Number(chartData[chartData.length - 1][primary]))}`
              : `: ${chartData.length} points`}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primaryDef.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={primaryDef.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="tick"
                tick={{ fill: 'var(--text-subtle)', fontSize: 10 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={(v: number) => formatGBP(v, { compact: true })}
                tick={{ fill: 'var(--text-subtle)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(v) => formatGBP(Number(v))}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { fullDate?: string } | undefined
                  return row?.fullDate ?? ''
                }}
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 0,
                  fontSize: 12,
                }}
              />
              {(showLayers || activeLines.length > 0) && <Legend wrapperStyle={{ fontSize: 12 }} />}
              <Area
                type="monotone"
                dataKey={primary}
                name={primaryDef.name}
                stroke={primaryDef.color}
                fill={`url(#${gradId})`}
                strokeWidth={2}
              />
              {activeLines.map((key) => {
                const def = SERIES.find((s) => s.key === key)
                if (!def) return null
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={def.name}
                    stroke={def.color}
                    dot={false}
                    strokeWidth={1.5}
                    strokeDasharray={def.dashed ? '4 4' : undefined}
                  />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** Back-compat wrapper used by Dashboard. */
export function NetWorthChart({
  history,
  privacy,
  onSnapshot,
}: {
  history: HistoryPoint[]
  privacy: boolean
  onSnapshot?: () => void
}) {
  return (
    <PortfolioSeriesChart
      history={history}
      privacy={privacy}
      onSnapshot={onSnapshot}
      title="Net worth timeline"
      eyebrow="History"
      primary="netWorth"
      allowLayers
      defaultRange="12M"
    />
  )
}
