/** On-device /smoke reachability helpers — no secrets in requests. */

export const DEFAULT_QUOTE_WORKER_URL = 'https://mydsp-quote.dave-perry.workers.dev'

const SECRET_QUERY_KEYS = new Set(['key', 'token', 'pass', 'passphrase', 'secret', 'auth'])

/** Strip secret query params so Sync URL probes never send credentials. */
export function syncUrlForReachabilityCheck(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.has(k.toLowerCase())) u.searchParams.delete(k)
    }
    return u.toString()
  } catch {
    return null
  }
}

export type ReachabilityResult = {
  ok: boolean
  status: number
  detail: string
}

/** Ping Quote Worker health (`/` JSON) or a `/quote` probe path. */
export async function pingQuoteWorker(
  baseUrl: string = DEFAULT_QUOTE_WORKER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<ReachabilityResult> {
  const root = baseUrl.replace(/\/$/, '')
  try {
    const res = await fetchImpl(root + '/', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return { ok: false, status: res.status, detail: `HTTP ${res.status}` }
    }
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const body = (await res.json()) as { ok?: boolean; service?: string }
      if (body.ok === true || body.service === 'mydsp-quote') {
        return { ok: true, status: res.status, detail: 'Quote Worker healthy' }
      }
    }
    return { ok: true, status: res.status, detail: 'Quote Worker reachable' }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : 'Quote Worker unreachable',
    }
  }
}

/** HEAD then GET fallback against Sync remote URL (secrets stripped). */
export async function checkSyncUrlReachable(
  remoteUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReachabilityResult> {
  const url = syncUrlForReachabilityCheck(remoteUrl)
  if (!url) {
    return { ok: false, status: 0, detail: 'No Sync URL configured' }
  }

  const tryMethod = async (method: 'HEAD' | 'GET'): Promise<ReachabilityResult | null> => {
    try {
      const res = await fetchImpl(url, {
        method,
        mode: 'cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      // Any HTTP response means the host is reachable (401/403 still OK for smoke).
      if (res.status > 0) {
        return {
          ok: true,
          status: res.status,
          detail: `Sync URL reachable (${method} ${res.status})`,
        }
      }
      return null
    } catch {
      return null
    }
  }

  const head = await tryMethod('HEAD')
  if (head) return head
  const get = await tryMethod('GET')
  if (get) return get
  return { ok: false, status: 0, detail: 'Sync URL unreachable' }
}
