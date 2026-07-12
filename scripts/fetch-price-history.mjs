#!/usr/bin/env node
/**
 * Regenerate bundled daily price series for TSLA / MSTR / BTC.
 * TSLA/MSTR are stored as USD (app converts to GBP at runtime via GBPUSD).
 * BTC is stored as GBP (BTC-USD / GBPUSD=X).
 * Usage: node scripts/fetch-price-history.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('public/data/prices', { recursive: true })

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MyDSP/price-history' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

function compact(pairs) {
  const map = new Map()
  for (const [d, p] of pairs) {
    if (!d || !(p > 0)) continue
    map.set(d, Math.round(p * 1e6) / 1e6)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

async function yahooDaily(symbol, fromIso) {
  const period1 = Math.floor(new Date(`${fromIso}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`
  const data = await fetchJson(url)
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error(`No Yahoo data for ${symbol}`)
  const ts = result.timestamp || []
  const closes = result.indicators?.quote?.[0]?.close || []
  const pairs = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (!(c > 0)) continue
    pairs.push([new Date(ts[i] * 1000).toISOString().slice(0, 10), c])
  }
  return compact(pairs)
}

const tsla = await yahooDaily('TSLA', '2019-12-01')
const mstr = await yahooDaily('MSTR', '2023-01-01')
const btcUsd = await yahooDaily('BTC-USD', '2010-07-01')
const gbpUsd = await yahooDaily('GBPUSD=X', '2010-07-01')
const fx = new Map(gbpUsd)

function gbpUsdOn(date) {
  if (fx.has(date)) return fx.get(date)
  const d = new Date(`${date}T00:00:00Z`)
  for (let i = 0; i < 10; i++) {
    d.setUTCDate(d.getUTCDate() - 1)
    const key = d.toISOString().slice(0, 10)
    if (fx.has(key)) return fx.get(key)
  }
  return 1.27
}

const btcGbp = compact(btcUsd.map(([d, p]) => [d, p / gbpUsdOn(d)]))

writeFileSync(
  'public/data/prices/tsla-usd.json',
  JSON.stringify({ symbol: 'TSLA', currency: 'USD', from: '2019-12-01', series: tsla }),
)
writeFileSync(
  'public/data/prices/mstr-usd.json',
  JSON.stringify({ symbol: 'MSTR', currency: 'USD', from: '2023-01-01', series: mstr }),
)
writeFileSync(
  'public/data/prices/btc-gbp.json',
  JSON.stringify({
    symbol: 'BTC',
    currency: 'GBP',
    from: btcGbp[0]?.[0],
    source: 'Yahoo BTC-USD / GBPUSD=X',
    series: btcGbp,
  }),
)
writeFileSync(
  'public/data/prices/manifest.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      files: {
        'equity:TSLA': 'tsla-usd.json',
        'equity:MSTR': 'mstr-usd.json',
        'crypto:BTC': 'btc-gbp.json',
      },
      counts: { TSLA: tsla.length, MSTR: mstr.length, BTC: btcGbp.length },
    },
    null,
    2,
  ),
)

console.log('Wrote', { TSLA: tsla.length, MSTR: mstr.length, BTC: btcGbp.length })
