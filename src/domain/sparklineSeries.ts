/** Normalize Markets sparkline series to ~7 readable daily points. */

/** Keep positive finite closes only. */
export function cleanSparklineCloses(closes: Array<number | null | undefined>): number[] {
  return closes.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
}

/** Prefer the last N closes (trading days / calendar days). */
export function takeLastSparklinePoints(closes: number[], n = 7): number[] {
  const clean = cleanSparklineCloses(closes)
  if (clean.length <= n) return clean
  return clean.slice(-n)
}

/**
 * CoinGecko market_chart returns hourly points for days=7.
 * Bucket by UTC date (last price of each day) so the sparkline is ~7 daily points.
 */
export function downsampleGeckoPricesToDaily(
  prices: Array<[number, number]> | undefined,
  days = 7,
): number[] {
  if (!prices?.length) return []
  const byDay = new Map<string, number>()
  for (const row of prices) {
    const ts = row?.[0]
    const price = row?.[1]
    if (typeof ts !== 'number' || !(typeof price === 'number' && price > 0)) continue
    const day = new Date(ts).toISOString().slice(0, 10)
    byDay.set(day, price)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, p]) => p)
    .slice(-days)
}

/** Stroke trend from first→last sparkline point (not the 24h badge %). */
export function sparklineTrendFromSeries(spark: number[]): 'up' | 'down' | 'neutral' {
  if (spark.length < 2) return 'neutral'
  const first = spark[0]
  const last = spark[spark.length - 1]
  if (!(first > 0) || !(last > 0)) return 'neutral'
  const delta = last - first
  const thresh = Math.max(Math.abs(first) * 0.0005, Number.EPSILON)
  if (delta > thresh) return 'up'
  if (delta < -thresh) return 'down'
  return 'neutral'
}

/** Y-axis domain padded so small weekly moves remain visible (never root at 0). */
export function sparklineYDomain(values: number[]): [number, number] {
  const clean = cleanSparklineCloses(values)
  if (clean.length === 0) return [0, 1]
  let min = Math.min(...clean)
  let max = Math.max(...clean)
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1
    return [min - pad, max + pad]
  }
  const pad = (max - min) * 0.12
  return [min - pad, max + pad]
}
