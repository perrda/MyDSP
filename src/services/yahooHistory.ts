/** Browser Yahoo Finance daily history (via CORS proxies). */

export interface YahooDailyPoint {
  date: string
  price: number
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchViaProxies<T>(url: string): Promise<T | null> {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ]
  for (const proxy of proxies) {
    const data = await fetchJson<T>(proxy)
    if (data) return data
  }
  // Direct attempt (works if CORS allows)
  return fetchJson<T>(url)
}

function compact(pairs: [string, number][]): YahooDailyPoint[] {
  const map = new Map<string, number>()
  for (const [d, p] of pairs) {
    if (!d || !(p > 0)) continue
    map.set(d, Math.round(p * 1e6) / 1e6)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, price]) => ({ date, price }))
}

export function yahooTickerFor(
  kind: 'crypto' | 'equity',
  symbol: string,
): string {
  const s = symbol.trim().toUpperCase()
  if (kind === 'crypto') {
    if (s === 'BTC') return 'BTC-USD'
    if (s === 'ETH') return 'ETH-USD'
    if (s === 'SOL') return 'SOL-USD'
    return `${s}-USD`
  }
  return s
}

export async function fetchYahooDailySeries(
  yahooSymbol: string,
  fromIso: string,
): Promise<YahooDailyPoint[]> {
  const period1 = Math.floor(new Date(`${fromIso}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${period1}&period2=${period2}&interval=1d`
  const data = await fetchViaProxies<{
    chart?: {
      result?: Array<{
        timestamp?: number[]
        indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      }>
    }
  }>(url)
  const result = data?.chart?.result?.[0]
  if (!result) return []
  const ts = result.timestamp || []
  const closes = result.indicators?.quote?.[0]?.close || []
  const pairs: [string, number][] = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (!(typeof c === 'number' && c > 0)) continue
    pairs.push([new Date(ts[i] * 1000).toISOString().slice(0, 10), c])
  }
  return compact(pairs)
}

/** Convert USD series to GBP using GBPUSD=X. */
export async function convertUsdSeriesToGbp(
  usdSeries: YahooDailyPoint[],
  fromIso: string,
): Promise<YahooDailyPoint[]> {
  const fx = await fetchYahooDailySeries('GBPUSD=X', fromIso)
  const fxMap = new Map(fx.map((p) => [p.date, p.price]))
  const gbpOn = (date: string): number => {
    if (fxMap.has(date)) return fxMap.get(date)!
    const d = new Date(`${date}T00:00:00Z`)
    for (let i = 0; i < 10; i++) {
      d.setUTCDate(d.getUTCDate() - 1)
      const key = d.toISOString().slice(0, 10)
      if (fxMap.has(key)) return fxMap.get(key)!
    }
    return 1.27
  }
  return compact(usdSeries.map((p) => [p.date, p.price / gbpOn(p.date)] as [string, number]))
}

export async function fetchSymbolHistory(
  kind: 'crypto' | 'equity',
  symbol: string,
  fromIso: string,
): Promise<{ points: YahooDailyPoint[]; currency: string; yahooSymbol: string }> {
  const yahooSymbol = yahooTickerFor(kind, symbol)
  const raw = await fetchYahooDailySeries(yahooSymbol, fromIso)
  if (kind === 'crypto') {
    const gbp = await convertUsdSeriesToGbp(raw, fromIso)
    return { points: gbp, currency: 'GBP', yahooSymbol }
  }
  return { points: raw, currency: 'USD', yahooSymbol }
}
