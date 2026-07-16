/**
 * MyDSP quote proxy Worker — same-origin CORS bypass for Yahoo/Finnhub/etc.
 * Deploy separately from the SPA so Workers Builds for mydspv1 stays assets-only.
 *
 * Deploy: npm run deploy:quote
 * Client uses VITE_QUOTE_PROXY_URL or defaults to https://mydsp-quote.dave-perry.workers.dev
 */

const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finnhub.io',
  'api.exchangerate-api.com',
  'api.frankfurter.app',
  'api.frankfurter.dev',
  'api.coingecko.com',
  'api.coincap.io',
  'api.coinbase.com',
  // News RSS (News page) — Google News + Yahoo Finance headlines
  'news.google.com',
  'feeds.finance.yahoo.com',
  // YouTube Atom feeds (channel uploads)
  'www.youtube.com',
  'youtube.com',
])

const FEED_HOSTS = new Set([
  'news.google.com',
  'feeds.finance.yahoo.com',
  'www.youtube.com',
  'youtube.com',
])

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60',
  }
}

function jsonError(status, message, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

async function handleQuoteProxy(request) {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }
  if (request.method !== 'GET') {
    return jsonError(405, 'GET only', origin)
  }

  const url = new URL(request.url)
  const target = url.searchParams.get('url')
  if (!target) return jsonError(400, 'Missing url query param', origin)

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return jsonError(400, 'Invalid url', origin)
  }
  if (parsed.protocol !== 'https:') {
    return jsonError(400, 'Only https targets allowed', origin)
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return jsonError(403, `Host not allowed: ${parsed.hostname}`, origin)
  }

  const isFeed = FEED_HOSTS.has(parsed.hostname)
  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: isFeed
          ? 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
          : 'application/json,text/plain,*/*',
        'User-Agent': 'MyDSP-quote/1.2 (+https://mydspv1.dave-perry.workers.dev)',
      },
      redirect: 'follow',
    })
    const body = await upstream.arrayBuffer()
    const headers = new Headers(corsHeaders(origin))
    const ct = upstream.headers.get('Content-Type')
    if (isFeed) {
      headers.set('Content-Type', ct && ct.includes('xml') ? ct : 'application/xml; charset=utf-8')
      headers.set('Cache-Control', 'public, max-age=180')
    } else {
      headers.set('Content-Type', ct || 'application/json')
    }
    return new Response(body, { status: upstream.status, headers })
  } catch (e) {
    return jsonError(502, e instanceof Error ? e.message : 'Upstream fetch failed', origin)
  }
}

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/' || path === '/quote' || path === '/api/quote' || path === '/feed' || path === '/api/feed') {
      if ((path === '/' || path === '/feed') && !new URL(request.url).searchParams.has('url')) {
        return new Response(
          JSON.stringify({
            ok: true,
            service: 'mydsp-quote',
            usage: '/quote?url=' + encodeURIComponent('https://query1.finance.yahoo.com/...'),
            feeds: '/quote?url=' + encodeURIComponent('https://news.google.com/rss/search?q=...'),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(null) } },
        )
      }
      return handleQuoteProxy(request)
    }
    return new Response('Not found', { status: 404, headers: corsHeaders(null) })
  },
}
