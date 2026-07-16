/** Normalize Markets sparkline series to a readable ~24h window. */

/** Keep positive finite closes only. */
export function cleanSparklineCloses(closes: Array<number | null | undefined>): number[] {
  return closes.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
}

/** Prefer the last N closes. */
export function takeLastSparklinePoints(closes: number[], n = 48): number[] {
  const clean = cleanSparklineCloses(closes)
  if (clean.length <= n) return clean
  return clean.slice(-n)
}

/**
 * Evenly sample an intraday series down to `maxPoints` so charts stay readable.
 */
export function downsampleIntradayPoints(
  points: Array<{ t: number; price: number }>,
  maxPoints = 48,
): number[] {
  const clean = points.filter(
    (p) =>
      typeof p.t === 'number' &&
      Number.isFinite(p.t) &&
      typeof p.price === 'number' &&
      Number.isFinite(p.price) &&
      p.price > 0,
  )
  if (clean.length === 0) return []
  if (clean.length <= maxPoints) return clean.map((p) => p.price)
  const out: number[] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * (clean.length - 1))
    out.push(clean[idx]!.price)
  }
  return out
}

/**
 * CoinGecko `market_chart` for days=1 returns dense intraday points.
 * Keep the last ~24h and downsample for the sparkline.
 */
export function downsampleGeckoPricesIntraday(
  prices: Array<[number, number]> | undefined,
  maxPoints = 48,
  windowMs = 24 * 60 * 60 * 1000,
): number[] {
  if (!prices?.length) return []
  const latest = prices.reduce((m, row) => Math.max(m, row?.[0] ?? 0), 0)
  const cutoff = latest > 0 ? latest - windowMs : 0
  const points = prices
    .filter((row) => typeof row?.[0] === 'number' && row[0] >= cutoff)
    .map((row) => ({ t: row[0], price: row[1] }))
  return downsampleIntradayPoints(points, maxPoints)
}

/**
 * @deprecated Prefer downsampleGeckoPricesIntraday for 24h Markets charts.
 * Bucket by UTC date (last price of each day).
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

/** % change across a sparkline / 24h series (first → last). */
export function changePctFromSeries(spark: number[]): number {
  if (spark.length < 2) return 0
  const first = spark[0]
  const last = spark[spark.length - 1]
  if (!(first > 0) || !(last > 0)) return 0
  return ((last - first) / first) * 100
}

/** Stroke trend from first→last sparkline point (aligned with 24h badge when series is 24h). */
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

/** Y-axis domain padded so small moves remain visible (never root at 0). */
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
