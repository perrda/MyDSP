import type { NwTrendPoint } from '../../domain/netWorthSparkline'
import { LabeledTrendChart } from './LabeledTrendChart'

interface Props {
  points: NwTrendPoint[]
  trend?: 'up' | 'down' | 'neutral'
  privacy?: boolean
  height?: number
}

export function TodayTrendChart({ points, trend, privacy = false, height = 176 }: Props) {
  return (
    <LabeledTrendChart
      points={points}
      trend={trend}
      privacy={privacy}
      height={height}
      name="Assets"
      testId="today-trend-chart"
    />
  )
}
