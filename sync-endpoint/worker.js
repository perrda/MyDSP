/**
 * Minimal MyDSP sync store — Cloudflare Worker + KV binding `STORE`.
 *
 * Browser requests from an allowlisted Origin succeed without a client access
 * key. Curl / non-browser still must send the Worker access key
 * (`?key=` or `X-MyDSP-Key`). The access-key env must be set on the Worker;
 * deploy is out of band (Developer on Mini). Do not wrangler from this PR.
 *
 * GET ?meta=1 returns { exportedAt, deviceId, checksum } without the full blob.
 */

const LIVE_APP_ORIGIN = 'https://mydspv1.dave-perry.workers.dev'
const PREVIEW_HOST_SUFFIX = '-mydspv1.dave-perry.workers.dev'

/**
 * Exact allowlist (David origin-lock):
 * 1. https://mydspv1.dave-perry.workers.dev
 * 2. http://localhost:* and http://127.0.0.1:* (any port, http only)
 * 3. https://<anything>-mydspv1.dave-perry.workers.dev (Designer preview scores)
 */
export function isOriginAllowed(origin) {
  if (!origin || typeof origin !== 'string') return false
  try {
    const url = new URL(origin)
    if (url.username || url.password) return false

    if (url.protocol === 'https:' && url.hostname === 'mydspv1.dave-perry.workers.dev') {
      return url.origin === LIVE_APP_ORIGIN
    }

    if (url.protocol === 'https:' && url.hostname.endsWith(PREVIEW_HOST_SUFFIX)) {
      const prefix = url.hostname.slice(0, -PREVIEW_HOST_SUFFIX.length)
      return prefix.length > 0 && !prefix.includes('.') && url.port === ''
    }

    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      return true
    }

    return false
  } catch {
    return false
  }
}

function corsHeaders(origin) {
  const allowed = Boolean(origin && isOriginAllowed(origin))
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-MyDSP-Key',
    Vary: 'Origin',
  }
}

function browserOriginSkipsClientKey(request) {
  return isOriginAllowed(request.headers.get('Origin'))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (!env.SYNC_KEY) {
      return new Response('Server misconfigured', { status: 500, headers: cors })
    }

    if (!browserOriginSkipsClientKey(request)) {
      const key = url.searchParams.get('key') || request.headers.get('X-MyDSP-Key')
      if (!key || key !== env.SYNC_KEY) {
        return new Response('Unauthorized', { status: 401, headers: cors })
      }
    }

    if (request.method === 'GET') {
      const raw = await env.STORE.get('envelope')
      if (!raw) return new Response('Not found', { status: 404, headers: cors })

      if (url.searchParams.get('meta') === '1') {
        try {
          const envelope = JSON.parse(raw)
          return new Response(
            JSON.stringify({
              exportedAt: envelope.exportedAt ?? null,
              deviceId: envelope.deviceId ?? null,
              checksum: envelope.checksum ?? null,
            }),
            {
              status: 200,
              headers: { ...cors, 'Content-Type': 'application/json' },
            },
          )
        } catch {
          return new Response('Bad store', { status: 500, headers: cors })
        }
      }

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
