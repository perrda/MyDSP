import { useId, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { formatGBP, privacyClass } from '../../utils/format'

export interface SliceDatum {
  name: string
  value: number
}

const DEFAULT_COLORS = [
  'var(--accent)',
  '#86efac',
  '#c4b5fd',
  '#67e8f9',
  '#fcd34d',
  '#f9a8d4',
  '#93c5fd',
  '#a3a3a3',
]

interface Props {
  data: SliceDatum[]
  privacy?: boolean
  title?: string
  eyebrow?: string
  /** Donut when true (default), solid pie when false. */
  donut?: boolean
  colors?: string[]
  heightClass?: string
  className?: string
  emptyText?: string
  /** When set, clicking a slice/legend navigates via this builder. */
  linkForSlice?: (name: string) => string | null
}

export function AllocationRing({
  data,
  privacy = false,
  title,
  eyebrow,
  donut = true,
  colors = DEFAULT_COLORS,
  heightClass = 'h-52 sm:h-56',
  className = '',
  emptyText = 'Nothing to chart yet.',
  linkForSlice,
}: Props) {
  const navigate = useNavigate()
  const gradId = useId().replace(/:/g, '')
  const reduceMotion = usePrefersReducedMotion()
  const slices = useMemo(
    () => data.filter((d) => Number.isFinite(d.value) && d.value > 0),
    [data],
  )
  const total = slices.reduce((s, d) => s + d.value, 0)

  const go = (name: string) => {
    const to = linkForSlice?.(name)
    if (to) navigate(to)
  }

  return (
    <div className={`surface p-0 chart-panel ${className}`}>
      {(eyebrow || title) && (
        <div className="p-4 md:p-6 border-b border-border">
          {eyebrow && <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">{eyebrow}</p>}
          {title && <h3 className="text-base font-bold tracking-tight">{title}</h3>}
          {total > 0 && (
            <p className={`text-xs md:text-sm text-text-muted mt-1 tabular-nums font-semibold ${privacyClass(privacy)}`}>
              {formatGBP(total)} total
            </p>
          )}
          {linkForSlice && (
            <p className="text-[11px] text-text-muted mt-1">Tap a category to open the ledger</p>
          )}
        </div>
      )}
      {slices.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-10 px-4">{emptyText}</p>
      ) : (
        <div className={`${heightClass} w-full p-4 md:p-6 ${privacyClass(privacy)}`}>
          <p className="sr-only">
            {title ?? 'Allocation'}:{' '}
            {slices.map((s) => `${s.name} ${((s.value / total) * 100).toFixed(0)}%`).join(', ')}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={donut ? '58%' : 0}
                outerRadius="82%"
                paddingAngle={slices.length > 1 ? 1.5 : 0}
                stroke="var(--bg)"
                strokeWidth={2}
                cursor={linkForSlice ? 'pointer' : undefined}
                onClick={(_, index) => {
                  const s = slices[index]
                  if (s) go(s.name)
                }}
                isAnimationActive={!reduceMotion}
                animationDuration={reduceMotion ? 0 : 800}
                animationEasing="ease-in-out"
              >
                {slices.map((_, i) => (
                  <Cell key={`${gradId}-${i}`} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [formatGBP(Number(v)), String(name)]}
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
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {slices.length > 0 && (
        <ul className="chart-legend-list space-y-2 p-4 md:p-6 pt-0 md:pt-0 max-[360px]:hidden">
          {slices.map((s, i) => (
            <li key={s.name}>
              {linkForSlice ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left hover:text-accent transition-colors min-h-[44px] md:min-h-0 py-2 md:py-0"
                  onClick={() => go(s.name)}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 md:w-2.5 md:h-2.5 shrink-0"
                      style={{ background: colors[i % colors.length] }}
                      aria-hidden
                    />
                    <span className="chart-legend-list__label truncate text-sm md:text-xs">{s.name}</span>
                  </span>
                  <span
                    className={`chart-legend-list__value shrink-0 text-sm md:text-xs ${privacyClass(privacy)}`}
                  >
                    {((s.value / total) * 100).toFixed(0)}% · {formatGBP(s.value)}
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 py-2 md:py-0">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 md:w-2.5 md:h-2.5 shrink-0"
                      style={{ background: colors[i % colors.length] }}
                      aria-hidden
                    />
                    <span className="chart-legend-list__label truncate text-sm md:text-xs">{s.name}</span>
                  </span>
                  <span
                    className={`chart-legend-list__value shrink-0 text-sm md:text-xs ${privacyClass(privacy)}`}
                  >
                    {((s.value / total) * 100).toFixed(0)}% · {formatGBP(s.value)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
