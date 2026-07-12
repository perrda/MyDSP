/**
 * Minimal MyDSP sync store — Cloudflare Worker + KV binding `STORE`.
 * Optional env SYNC_KEY: require ?key= or header X-MyDSP-Key.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (env.SYNC_KEY) {
      const key = url.searchParams.get('key') || request.headers.get('X-MyDSP-Key')
      if (key !== env.SYNC_KEY) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-MyDSP-Key',
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'GET') {
      const raw = await env.STORE.get('envelope')
      if (!raw) return new Response('Not found', { status: 404, headers: cors })
      return new Response(raw, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await request.text()
      if (!body || body.length > 25_000_000) {
        return new Response('Bad request', { status: 400, headers: cors })
      }
      await env.STORE.put('envelope', body)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method not allowed', { status: 405, headers: cors })
  },
}
