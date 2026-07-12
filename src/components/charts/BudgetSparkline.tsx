import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { categoryMonthlySeries } from '../../domain/budgetChart'
import type { SpendingEntry } from '../../domain/types'
import { privacyClass } from '../../utils/format'

interface Props {
  spending: SpendingEntry[]
  category: string
  limit: number
  privacy: boolean
  className?: string
}

export function BudgetSparkline({ spending, category, limit, privacy, className = '' }: Props) {
  const data = useMemo(
    () => categoryMonthlySeries(spending, category, limit, 6),
    [spending, category, limit],
  )
  if (data.every((d) => d.spent === 0) && limit <= 0) return null

  return (
    <div className={`h-10 w-full min-w-[5rem] ${privacyClass(privacy)} ${className}`} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          accessibilityLayer={false}
        >
          <Line
            type="monotone"
            dataKey="spent"
            stroke="var(--accent)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {limit > 0 && (
            <Line
              type="monotone"
              dataKey="limit"
              stroke="var(--border-strong)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
