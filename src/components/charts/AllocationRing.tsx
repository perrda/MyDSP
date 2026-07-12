import { useId, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
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
    <div className={`surface p-5 sm:p-6 chart-panel ${className}`}>
      {(eyebrow || title) && (
        <div className="mb-4">
          {eyebrow && <p className="label-uppercase mb-1">{eyebrow}</p>}
          {title && <h3 className="text-base font-bold tracking-tight">{title}</h3>}
          {total > 0 && (
            <p className={`text-sm text-text-muted mt-1 tabular-nums ${privacyClass(privacy)}`}>
              {formatGBP(total)} total
            </p>
          )}
          {linkForSlice && (
            <p className="text-[11px] text-text-subtle mt-1">Tap a category to open the ledger</p>
          )}
        </div>
      )}
      {slices.length === 0 ? (
        <p className="text-sm text-text-subtle text-center py-10">{emptyText}</p>
      ) : (
        <div className={`${heightClass} w-full ${privacyClass(privacy)}`}>
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
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {slices.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {slices.map((s, i) => (
            <li key={s.name}>
              {linkForSlice ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-sm text-left hover:text-accent"
                  onClick={() => go(s.name)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 shrink-0"
                      style={{ background: colors[i % colors.length] }}
                      aria-hidden
                    />
                    <span className="truncate uppercase tracking-wider text-[10px] font-bold text-text-subtle">
                      {s.name}
                    </span>
                  </span>
                  <span className={`tabular-nums shrink-0 ${privacyClass(privacy)}`}>
                    {((s.value / total) * 100).toFixed(0)}% · {formatGBP(s.value)}
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 shrink-0"
                      style={{ background: colors[i % colors.length] }}
                      aria-hidden
                    />
                    <span className="truncate uppercase tracking-wider text-[10px] font-bold text-text-subtle">
                      {s.name}
                    </span>
                  </span>
                  <span className={`tabular-nums shrink-0 ${privacyClass(privacy)}`}>
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
