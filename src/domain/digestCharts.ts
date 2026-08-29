/** Inline SVG charts for digest HTML / modal — real points only, BTC orange accents. */

import {
  BTC_ORANGE,
  DIGEST_NEGATIVE,
  DIGEST_SLICE_CRYPTO,
  DIGEST_SLICE_EQUITY,
  type DigestSeriesPoint,
} from './digestPeriod'

export type DigestSlice = {
  name: string
  value: number
  color?: string
}

export function allocationSlices(
  equity: number,
  crypto: number,
): Array<{ name: string; value: number; color: string; share: number | null }> {
  const rows = [
    { name: 'Equities', value: equity, color: DIGEST_SLICE_EQUITY },
    { name: 'Crypto', value: crypto, color: DIGEST_SLICE_CRYPTO },
  ].filter((r) => Number.isFinite(r.value) && r.value > 0)
  const total = rows.reduce((s, r) => s + r.value, 0)
  return rows.map((r) => ({
    ...r,
    share: total > 0 ? r.value / total : null,
  }))
}

function shareLabel(share: number | null, privacy?: boolean): string {
  if (privacy) return '••••'
  if (share == null || !Number.isFinite(share)) return '—'
  return `${Math.round(share * 100)}%`
}

export function formatAllocationShare(share: number | null, privacy?: boolean): string {
  return shareLabel(share, privacy)
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function donutSegment(
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  start: number,
  sweep: number,
): string {
  const end = start + sweep
  const large = sweep > 180 ? 1 : 0
  const [x1, y1] = polar(cx, cy, rOut, start)
  const [x2, y2] = polar(cx, cy, rOut, end)
  const [x3, y3] = polar(cx, cy, rIn, end)
  const [x4, y4] = polar(cx, cy, rIn, start)
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function allocationDonutSvg(
  slices: Array<{ name: string; value: number; color: string }>,
  opts?: { size?: number },
): string {
  const size = opts?.size ?? 148
  const total = slices.reduce((s, r) => s + (r.value > 0 ? r.value : 0), 0)
  const cx = size / 2
  const cy = size / 2
  const rOut = size * 0.42
  const rIn = size * 0.26
  if (!(total > 0) || slices.length === 0) {
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Allocation unpriced">
      <circle cx="${cx}" cy="${cy}" r="${rOut}" fill="none" stroke="#d4d4d4" stroke-width="10"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#737373">—</text>
    </svg>`
  }
  let angle = 0
  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = slices.length === 1 ? 359.99 : (s.value / total) * 360
      const d = donutSegment(cx, cy, rOut, rIn, angle, sweep)
      angle += sweep
      return `<path d="${d}" fill="${s.color}" />`
    })
    .join('')
  const label = slices.map((s) => s.name).join(', ')
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="${size}" role="img" aria-label="Allocation ${label}">
    ${paths}
  </svg>`
}

export function nwSparklineSvg(
  series: DigestSeriesPoint[],
  opts?: { width?: number; height?: number; up?: boolean | null },
): string {
  const width = opts?.width ?? 320
  const height = opts?.height ?? 88
  if (series.length < 2) {
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Net worth unpriced">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="12" fill="#737373">—</text>
    </svg>`
  }
  const values = series.map((p) => p.netWorth)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1
    min -= pad
    max += pad
  } else {
    const pad = (max - min) * 0.12
    min -= pad
    max += pad
  }
  const innerW = width - 8
  const innerH = height - 10
  const pts = series.map((p, i) => {
    const x = 4 + (i / (series.length - 1)) * innerW
    const y = 5 + (1 - (p.netWorth - min) / (max - min)) * innerH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = pts.join(' ')
  const area = `4,${height - 2} ${line} ${width - 4},${height - 2}`
  const first = series[0]!.netWorth
  const last = series[series.length - 1]!.netWorth
  const up = opts?.up ?? last >= first
  const stroke = up === false ? DIGEST_NEGATIVE : BTC_ORANGE
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Net worth history">
    <polyline points="${area}" fill="${stroke}" fill-opacity="0.12" stroke="none"/>
    <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`
}

export { BTC_ORANGE, DIGEST_NEGATIVE, DIGEST_SLICE_CRYPTO, DIGEST_SLICE_EQUITY }
