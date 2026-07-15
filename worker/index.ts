/**
 * MyDSP app Worker — same-origin API routes (quote/CORS proxy).
 * Static SPA assets are served by Workers Assets; this Worker only runs for /api/*.
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
])

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=30',
  }
}

function jsonError(status: number, message: string, origin: string | null): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

async function handleQuoteProxy(request: Request): Promise<Response> {
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

  let parsed: URL
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

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'MyDSP/1.2 (+https://mydspv1.dave-perry.workers.dev)',
      },
      redirect: 'follow',
    })
    const body = await upstream.arrayBuffer()
    const headers = new Headers(corsHeaders(origin))
    const ct = upstream.headers.get('Content-Type')
    if (ct) headers.set('Content-Type', ct)
    else headers.set('Content-Type', 'application/json')
    return new Response(body, { status: upstream.status, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upstream fetch failed'
    return jsonError(502, msg, origin)
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === '/api/quote' || path === '/api/proxy') {
      return handleQuoteProxy(request)
    }
    return new Response('Not found', { status: 404 })
  },
}
