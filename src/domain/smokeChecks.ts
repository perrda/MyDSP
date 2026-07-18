/** On-device /smoke reachability helpers — no secrets in requests. */

export const DEFAULT_QUOTE_WORKER_URL = 'https://mydsp-quote.dave-perry.workers.dev'

/** Probe target used to confirm YouTube is on the Quote Worker allowlist. */
export const YOUTUBE_ALLOWLIST_PROBE =
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCYfdidRxbB8Qhf0Nx7ioOYw'

/** Probe target used to confirm News RSS is on the Quote Worker allowlist.
 *  Yahoo Finance headlines (primary News source) — Google News often returns 503.
 */
export const NEWS_ALLOWLIST_PROBE =
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US'

/** Soft probe — Google News host still allowlisted even when upstream is flaky. */
export const NEWS_GOOGLE_ALLOWLIST_PROBE =
  'https://news.google.com/rss/search?q=finance&hl=en-GB&gl=GB&ceid=GB:en'

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

/** Ensure Quote Worker URL points at mydsp-quote (not the SPA host mydspv1). */
export function assertQuoteWorkerIdentity(
  baseUrl: string = DEFAULT_QUOTE_WORKER_URL,
): { ok: boolean; detail: string } {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    if (host.includes('mydspv1')) {
      return {
        ok: false,
        detail: 'Quote Worker URL looks like app host mydspv1 — expect mydsp-quote',
      }
    }
    if (!host.includes('mydsp-quote')) {
      return {
        ok: false,
        detail: `Hostname "${host}" does not include mydsp-quote`,
      }
    }
    return { ok: true, detail: 'Quote Worker identity OK (mydsp-quote)' }
  } catch {
    return { ok: false, detail: 'Invalid Quote Worker URL' }
  }
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
      if (body.service === 'mydsp-quote') {
        return { ok: true, status: res.status, detail: 'Quote Worker healthy (mydsp-quote)' }
      }
      if (body.ok === true) {
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

/**
 * Confirm Quote Worker allowlists YouTube Atom feeds (not blocked with Host not allowed).
 * Upstream 4xx still counts as allowlisted — only 403 "Host not allowed" fails.
 */
export async function probeQuoteWorkerYoutubeAllowlist(
  baseUrl: string = DEFAULT_QUOTE_WORKER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<ReachabilityResult> {
  const root = baseUrl.replace(/\/$/, '')
  const probe = `${root}/quote?url=${encodeURIComponent(YOUTUBE_ALLOWLIST_PROBE)}`
  try {
    const res = await fetchImpl(probe, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 403) {
      let detail = `HTTP 403 — YouTube host may not be allowlisted`
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error) detail = body.error
      } catch {
        /* ignore */
      }
      return { ok: false, status: 403, detail }
    }
    if (res.status > 0) {
      return {
        ok: true,
        status: res.status,
        detail: `YouTube allowlisted (Worker HTTP ${res.status})`,
      }
    }
    return { ok: false, status: 0, detail: 'Worker returned empty status' }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : 'YouTube allowlist probe failed',
    }
  }
}

/**
 * Confirm Quote Worker can proxy Yahoo Finance RSS (primary News source).
 * Requires HTTP 200 + feed-shaped body — not merely "not 403".
 */
export async function probeQuoteWorkerNewsAllowlist(
  baseUrl: string = DEFAULT_QUOTE_WORKER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<ReachabilityResult> {
  const root = baseUrl.replace(/\/$/, '')
  const probe = `${root}/quote?url=${encodeURIComponent(NEWS_ALLOWLIST_PROBE)}`
  try {
    const res = await fetchImpl(probe, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 403) {
      let detail = `HTTP 403 — News host may not be allowlisted`
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error) detail = body.error
      } catch {
        /* ignore */
      }
      return { ok: false, status: 403, detail }
    }
    if (res.status !== 200) {
      return {
        ok: false,
        status: res.status,
        detail: `News feed probe HTTP ${res.status} — expected Yahoo RSS 200`,
      }
    }
    const text = await res.text()
    const lower = text.toLowerCase()
    const looksLikeFeed =
      lower.includes('<rss') ||
      lower.includes('<feed') ||
      (lower.includes('<?xml') && (lower.includes('<item') || lower.includes('<entry')))
    if (!looksLikeFeed) {
      return {
        ok: false,
        status: res.status,
        detail: 'News probe returned non-RSS body',
      }
    }
    return {
      ok: true,
      status: res.status,
      detail: 'News feed OK (Yahoo RSS via Worker)',
    }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : 'News allowlist probe failed',
    }
  }
}
