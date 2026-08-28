import { useId, useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatChartMonthYear, formatChartYTick } from '../../domain/chartAxis'
import type { CashflowMonth } from '../../domain/cashflow'
import { formatGBP, privacyClass } from '../../utils/format'

const IN_COLOR = '#86efac'
const OUT_COLOR = '#9ca3af'
const LEFTOVER_COLOR = 'var(--accent)'

interface Props {
  months: CashflowMonth[]
  privacy: boolean
}

export function CashflowChart({ months, privacy }: Props) {
  const gradId = useId().replace(/:/g, '')
  const rows = useMemo(
    () =>
      months.map((m) => ({
        ...m,
        date: `${m.month}-01`,
        tick: formatChartMonthYear(`${m.month}-01`),
      })),
    [months],
  )

  return (
    <div className="surface p-4 sm:p-6 lg:p-8 chart-panel mb-6" data-testid="cashflow-chart">
      <div className="mb-5">
        <p className="label-uppercase mb-2">Monthly</p>
        <h3 className="text-base sm:text-lg font-bold tracking-tight">In, out, leftover</h3>
        <p className="text-sm mt-2 text-text-muted font-light">
          Ledger months only — no invented series.
        </p>
      </div>
      <div className={`h-56 sm:h-64 lg:h-72 w-full ${privacyClass(privacy)}`}>
        <p className="sr-only">
          Monthly cashflow for {rows.length} months. Money in, money out, and leftover from the
          spending ledger.
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`${gradId}-in`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={IN_COLOR} stopOpacity={0.9} />
                <stop offset="100%" stopColor={IN_COLOR} stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id={`${gradId}-out`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OUT_COLOR} stopOpacity={0.85} />
                <stop offset="100%" stopColor={OUT_COLOR} stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={(value: string) => formatChartMonthYear(`${value}-01`)}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => formatChartYTick(v)}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              formatter={(v, name) => [formatGBP(Number(v), { signed: name === 'Leftover' }), name]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as { tick?: string; month?: string } | undefined
                return row?.tick || row?.month || ''
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
            <Bar
              dataKey="moneyIn"
              name="Money in"
              fill={`url(#${gradId}-in)`}
              stroke={IN_COLOR}
              strokeWidth={1}
              maxBarSize={28}
            />
            <Bar
              dataKey="moneyOut"
              name="Money out"
              fill={`url(#${gradId}-out)`}
              stroke={OUT_COLOR}
              strokeWidth={1}
              maxBarSize={28}
            />
            <Line
              type="monotone"
              dataKey="leftover"
              name="Leftover"
              stroke={LEFTOVER_COLOR}
              strokeWidth={2.5}
              dot={{ r: 3, fill: LEFTOVER_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
