/** Load bundled static daily price series (TSLA / MSTR / BTC). */

import type { HoldingPricePoint } from './holdingHistory'
import { holdingHistoryKey, readHoldingHistory } from './holdingHistory'
import type { PortfolioData } from './types'

export interface StaticPriceFile {
  symbol: string
  currency: string
  from?: string
  series: [string, number][]
}

const cache = new Map<string, HoldingPricePoint[]>()

const STATIC_FILES: Record<string, string> = {
  'equity:TSLA': 'data/prices/tsla-usd.json',
  'equity:MSTR': 'data/prices/mstr-usd.json',
  'crypto:BTC': 'data/prices/btc-gbp.json',
}

function assetUrl(rel: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${rel}`.replace(/([^:]\/)\/+/g, '$1')
}

export function staticPricePath(kind: 'crypto' | 'equity', symbol: string): string | null {
  const rel = STATIC_FILES[holdingHistoryKey(kind, symbol)]
  return rel ? assetUrl(rel) : null
}

export async function loadStaticPriceSeries(
  kind: 'crypto' | 'equity',
  symbol: string,
): Promise<HoldingPricePoint[]> {
  const key = holdingHistoryKey(kind, symbol)
  if (cache.has(key)) return cache.get(key)!
  const path = STATIC_FILES[key]
  if (!path) return []
  try {
    const res = await fetch(assetUrl(path))
    if (!res.ok) return []
    const json = (await res.json()) as StaticPriceFile
    let points: HoldingPricePoint[] = (json.series ?? []).map(([date, price]) => ({
      date,
      price,
      source: 'manual' as const,
    }))
    // Optional pre-liquid BTC OTC overlay (earlier dates win if not in Yahoo series)
    if (kind === 'crypto' && symbol.toUpperCase() === 'BTC') {
      try {
        const otc = await fetch(assetUrl('data/prices/btc-gbp-otc.json'))
        if (otc.ok) {
          const otcJson = (await otc.json()) as StaticPriceFile
          const map = new Map(points.map((p) => [p.date, p]))
          for (const [date, price] of otcJson.series ?? []) {
            if (!map.has(date) && price > 0) {
              map.set(date, { date, price, source: 'manual' })
            }
          }
          points = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
        }
      } catch {
        /* optional file */
      }
    }
    cache.set(key, points)
    return points
  } catch {
    return []
  }
}

/** Merge static baseline with live extras (live wins on same date). */
export function mergePriceSeries(
  staticSeries: HoldingPricePoint[],
  liveSeries: HoldingPricePoint[],
): HoldingPricePoint[] {
  const map = new Map<string, HoldingPricePoint>()
  for (const p of staticSeries) map.set(p.date, p)
  for (const p of liveSeries) {
    const day = p.date.slice(0, 10)
    const prev = map.get(day)
    if (!prev || (p.at && (!prev.at || p.at >= prev.at)) || p.source === 'auto') {
      map.set(day, { ...p, date: day })
    }
  }
  return [...map.values()].sort((a, b) => {
    const ka = a.at ?? a.date
    const kb = b.at ?? b.date
    return ka.localeCompare(kb)
  })
}

export async function resolveHoldingSeries(
  data: PortfolioData,
  kind: 'crypto' | 'equity',
  symbol: string,
): Promise<HoldingPricePoint[]> {
  const staticSeries = await loadStaticPriceSeries(kind, symbol)
  const live = readHoldingHistory(data)[holdingHistoryKey(kind, symbol)] ?? []
  return mergePriceSeries(staticSeries, live)
}

export function knownStaticSymbols(): { kind: 'crypto' | 'equity'; symbol: string }[] {
  return [
    { kind: 'equity', symbol: 'TSLA' },
    { kind: 'equity', symbol: 'MSTR' },
    { kind: 'crypto', symbol: 'BTC' },
  ]
}

/** Nearest prior (or exact) close for a calendar date. */
export function priceOnDate(
  series: HoldingPricePoint[],
  date: string,
): { price: number; date: string } | null {
  if (!series.length) return null
  const day = date.slice(0, 10)
  let best: HoldingPricePoint | null = null
  for (const p of series) {
    if (p.date > day) break
    best = p
  }
  if (!best) return null
  return { price: best.price, date: best.date }
}

export async function lookupPriceOnDate(
  kind: 'crypto' | 'equity',
  symbol: string,
  date: string,
  data?: PortfolioData,
): Promise<{ price: number; date: string; source: string } | null> {
  const series = data
    ? await resolveHoldingSeries(data, kind, symbol)
    : await loadStaticPriceSeries(kind, symbol)
  const hit = priceOnDate(series, date)
  if (!hit) return null
  return { ...hit, source: staticPricePath(kind, symbol) ? 'market' : 'history' }
}

/** Register an additional static file path (e.g. after client backfill download). */
export function registerStaticPriceFile(
  kind: 'crypto' | 'equity',
  symbol: string,
  path: string,
): void {
  STATIC_FILES[holdingHistoryKey(kind, symbol)] = path
  cache.delete(holdingHistoryKey(kind, symbol))
}
