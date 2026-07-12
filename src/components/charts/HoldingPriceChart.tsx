import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  filterByRange,
  formatChartTick,
  formatChartTooltipLabel,
  type ChartRange,
} from '../../domain/history'
import type { HoldingPricePoint } from '../../domain/holdingHistory'
import { resolveHoldingSeries } from '../../domain/staticPrices'
import type { PortfolioData } from '../../domain/types'
import { formatGBP, formatGBPPrecise, privacyClass } from '../../utils/format'
import { ChartRangeToolbar } from './ChartRangeToolbar'

interface Props {
  data: PortfolioData
  kind: 'crypto' | 'equity'
  symbol: string
  /** Fallback when static+live empty */
  seed?: HoldingPricePoint[]
  privacy: boolean
  title: string
}

export function HoldingPriceChart({ data, kind, symbol, seed = [], privacy, title }: Props) {
  const [range, setRange] = useState<ChartRange>('12M')
  const [series, setSeries] = useState<HoldingPricePoint[]>(seed)

  useEffect(() => {
    let cancelled = false
    void resolveHoldingSeries(data, kind, symbol).then((pts) => {
      if (cancelled) return
      if (pts.length >= 2) {
        setSeries(pts)
        return
      }
      if (seed.length >= 2) {
        setSeries(seed)
        return
      }
      if (pts.length === 1 && seed.length) {
        setSeries([...pts, ...seed.slice(-1)])
        return
      }
      setSeries(pts.length ? pts : seed)
    })
    return () => {
      cancelled = true
    }
    // seed used as fallback only; avoid re-fetch loop from new array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, symbol])

  const filtered = useMemo(() => filterByRange(series, range), [series, range])
  const chartData = useMemo(
    () =>
      filtered.map((p) => ({
        tick: formatChartTick(p.date, range, p.at),
        fullDate: p.at ?? p.date,
        price: p.price,
      })),
    [filtered, range],
  )
  const delta =
    chartData.length >= 2
      ? chartData[chartData.length - 1].price - chartData[0].price
      : null

  return (
    <div className="surface p-4 sm:p-6 chart-panel">
      <div className="flex flex-col gap-4 mb-4">
        <div>
          <p className="label-uppercase mb-2">{symbol}</p>
          <h3 className="text-base font-bold tracking-tight">{title}</h3>
          <p className="text-xs text-text-subtle mt-1">
            {series.length.toLocaleString()} daily points
            {kind === 'crypto' && symbol === 'BTC' ? ' · GBP from 2014' : ''}
            {symbol === 'TSLA' ? ' · USD from Dec 2019' : ''}
            {symbol === 'MSTR' ? ' · USD from Jan 2023' : ''}
          </p>
          {delta != null && (
            <p className={`text-sm mt-2 tabular-nums ${delta >= 0 ? 'text-accent' : 'text-text-muted'}`}>
              {formatGBP(delta, { signed: true })} · {range}
            </p>
          )}
        </div>
        <ChartRangeToolbar value={range} onChange={setRange} />
      </div>
      {chartData.length < 2 ? (
        <p className="text-sm text-text-subtle text-center py-10">
          Price history builds from bundled market data and live refreshes.
        </p>
      ) : (
        <div className={`h-52 sm:h-64 lg:h-72 w-full ${privacyClass(privacy)}`}>
          <p className="sr-only">
            {symbol} price chart {range}: {chartData.length} points
            {delta != null ? `, change ${formatGBP(delta, { signed: true })}` : ''}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="holdingFill" x1="0" y1="0" x2="0" y2="1">
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
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(v) => formatGBPPrecise(Number(v))}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { fullDate?: string } | undefined
                  return formatChartTooltipLabel(row?.fullDate ?? '')
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
              <Area
                type="monotone"
                dataKey="price"
                name="Price"
                stroke="var(--accent)"
                fill="url(#holdingFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
