/**
 * MyDSP sync store — Cloudflare Worker + KV binding `STORE`.
 *
 * Auth: optional env SYNC_KEY via ?key= or header X-MyDSP-Key.
 *   Production: always set SYNC_KEY (see SYNC_SETUP.md).
 *
 * CAS (optimistic concurrency):
 *   Client sends X-MyDSP-Base-ExportedAt (or ?baseExportedAt=) matching the
 *   last applied remote exportedAt. Mismatch → 409 with current meta.
 *   X-MyDSP-Force: 1 skips CAS (Settings force overwrite).
 *   Missing base header still accepts (legacy clients).
 *
 * Rules mirrored in src/services/sync/syncCas.ts
 *
 * GET ?meta=1 → { exportedAt, deviceId, checksum, encryptedBytes }
 */
const MAX_BODY = 25_000_000

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, X-MyDSP-Key, X-MyDSP-Base-ExportedAt, X-MyDSP-Force',
  }
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

/** Keep in sync with isValidSyncEnvelopeShape in src/services/sync/syncCas.ts */
function isValidSyncEnvelopeShape(data) {
  if (!data || typeof data !== 'object') return false
  if (data.app !== 'mydsp') return false
  if (data.v !== 1 && data.v !== 2 && data.v !== 3) return false
  if (typeof data.exportedAt !== 'string' || !data.exportedAt.trim()) return false
  if (typeof data.deviceId !== 'string' || !data.deviceId.trim()) return false
  if (!data.blobs || typeof data.blobs !== 'object' || Array.isArray(data.blobs)) return false
  if (!Array.isArray(data.portfolios)) return false
  return true
}

/** Keep in sync with resolveCasDecision in src/services/sync/syncCas.ts */
function resolveCasDecision(storedExportedAt, baseExportedAt, force) {
  if (force) return 'accept'
  if (!storedExportedAt) return 'accept'
  if (baseExportedAt == null || baseExportedAt === '') return 'accept'
  return baseExportedAt === storedExportedAt ? 'accept' : 'conflict'
}

function readBaseExportedAt(request, url) {
  return (
    request.headers.get('X-MyDSP-Base-ExportedAt') ||
    url.searchParams.get('baseExportedAt') ||
    ''
  )
}

function isForce(request, url) {
  const h = request.headers.get('X-MyDSP-Force')
  if (h === '1' || h === 'true') return true
  const q = url.searchParams.get('force')
  return q === '1' || q === 'true'
}

function envelopeMeta(envelope, encryptedBytes) {
  return {
    exportedAt: envelope?.exportedAt ?? null,
    deviceId: envelope?.deviceId ?? null,
    checksum: envelope?.checksum ?? null,
    encryptedBytes: typeof encryptedBytes === 'number' ? encryptedBytes : undefined,
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = corsHeaders()

    if (env.SYNC_KEY) {
      const key = url.searchParams.get('key') || request.headers.get('X-MyDSP-Key')
      if (key !== env.SYNC_KEY) {
        return new Response('Unauthorized', { status: 401, headers: cors })
      }
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'GET') {
      const raw = await env.STORE.get('envelope')
      if (!raw) return new Response('Not found', { status: 404, headers: cors })

      if (url.searchParams.get('meta') === '1') {
        try {
          const envelope = JSON.parse(raw)
          return json(200, envelopeMeta(envelope, raw.length))
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
      if (!body || body.length > MAX_BODY) {
        return json(400, { error: 'bad_request', message: 'Empty or oversized body' })
      }

      let envelope
      try {
        envelope = JSON.parse(body)
      } catch {
        return json(400, { error: 'invalid_json', message: 'Body must be JSON' })
      }

      if (!isValidSyncEnvelopeShape(envelope)) {
        return json(400, {
          error: 'invalid_envelope',
          message: 'Expected MyDSP envelope (app, v, exportedAt, deviceId, portfolios, blobs)',
        })
      }

      const existingRaw = await env.STORE.get('envelope')
      let storedExportedAt = null
      let storedMeta = null
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw)
          storedExportedAt =
            typeof existing.exportedAt === 'string' ? existing.exportedAt : null
          storedMeta = envelopeMeta(existing, existingRaw.length)
        } catch {
          // Corrupt store — allow overwrite to recover
          storedExportedAt = null
        }
      }

      const base = readBaseExportedAt(request, url)
      const force = isForce(request, url)
      if (resolveCasDecision(storedExportedAt, base, force) === 'conflict') {
        return json(
          409,
          {
            error: 'conflict',
            message: 'Remote envelope changed; pull and merge before push',
            exportedAt: storedMeta?.exportedAt ?? storedExportedAt,
            deviceId: storedMeta?.deviceId ?? null,
            checksum: storedMeta?.checksum ?? null,
            encryptedBytes: storedMeta?.encryptedBytes,
          },
          { 'X-MyDSP-CAS': 'conflict' },
        )
      }

      await env.STORE.put('envelope', body)
      return json(200, {
        ok: true,
        exportedAt: envelope.exportedAt,
        deviceId: envelope.deviceId,
        checksum: envelope.checksum ?? null,
        encryptedBytes: body.length,
      })
    }

    return new Response('Method not allowed', { status: 405, headers: cors })
  },
}
