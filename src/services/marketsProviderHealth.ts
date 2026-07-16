/** Session-scoped Markets provider health (no backend). */

export type MarketsProviderId =
  | 'coingecko'
  | 'yahoo'
  | 'finnhub'
  | 'coincap'
  | 'coinbase'
  | 'fx'

export interface ProviderHealth {
  id: MarketsProviderId
  lastSuccessAt?: string
  lastFailureAt?: string
  consecutiveFailures: number
  lastError?: string
}

const STORAGE_KEY = 'mydsp_markets_provider_health_v1'

const PROVIDERS: MarketsProviderId[] = [
  'coingecko',
  'yahoo',
  'finnhub',
  'coincap',
  'coinbase',
  'fx',
]

type HealthMap = Record<MarketsProviderId, ProviderHealth>

function blank(): HealthMap {
  return Object.fromEntries(
    PROVIDERS.map((id) => [id, { id, consecutiveFailures: 0 }]),
  ) as HealthMap
}

let state: HealthMap = load()

function load(): HealthMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return blank()
    const parsed = JSON.parse(raw) as Partial<HealthMap>
    const next = blank()
    for (const id of PROVIDERS) {
      const row = parsed[id]
      if (row && typeof row === 'object') {
        next[id] = {
          id,
          lastSuccessAt: typeof row.lastSuccessAt === 'string' ? row.lastSuccessAt : undefined,
          lastFailureAt: typeof row.lastFailureAt === 'string' ? row.lastFailureAt : undefined,
          consecutiveFailures:
            typeof row.consecutiveFailures === 'number' ? row.consecutiveFailures : 0,
          lastError: typeof row.lastError === 'string' ? row.lastError : undefined,
        }
      }
    }
    return next
  } catch {
    return blank()
  }
}

function persist(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

export function resetMarketsProviderHealth(): void {
  state = blank()
  persist()
}

export function getMarketsProviderHealth(): ProviderHealth[] {
  return PROVIDERS.map((id) => ({ ...state[id] }))
}

export function recordProviderSuccess(id: MarketsProviderId, at = new Date().toISOString()): void {
  state[id] = {
    id,
    lastSuccessAt: at,
    lastFailureAt: state[id].lastFailureAt,
    consecutiveFailures: 0,
    lastError: undefined,
  }
  persist()
}

export function recordProviderFailure(
  id: MarketsProviderId,
  error?: string,
  at = new Date().toISOString(),
): void {
  const prev = state[id]
  state[id] = {
    id,
    lastSuccessAt: prev.lastSuccessAt,
    lastFailureAt: at,
    consecutiveFailures: (prev.consecutiveFailures || 0) + 1,
    lastError: error || prev.lastError,
  }
  persist()
}

/** Map a quote `source` string onto a known provider bucket. */
export function providerFromQuoteSource(source: string): MarketsProviderId | null {
  const s = (source || '').toLowerCase()
  if (s.includes('coingecko') || s === 'gecko') return 'coingecko'
  if (s.includes('finnhub')) return 'finnhub'
  if (s.includes('coincap')) return 'coincap'
  if (s.includes('coinbase')) return 'coinbase'
  if (s.includes('exchangerate') || s.includes('frankfurter') || s === 'fx') return 'fx'
  if (s.includes('yahoo')) return 'yahoo'
  // Derived / error / none / manual / portfolio / stale — not a live provider hit
  return null
}

/**
 * Update health from a finished Markets refresh map.
 * Live quotes with known sources count as success; `error`/`none` count against the kind's primary provider.
 */
export function recordMarketsRefreshHealth(
  quotes: Iterable<{ kind: string; last: number; source: string }>,
): void {
  const hasFinnhub =
    typeof localStorage !== 'undefined' &&
    Boolean(
      (typeof localStorage.getItem === 'function' && localStorage.getItem('finnhub_key')) ||
        false,
    )
  const kindPrimary: Record<string, MarketsProviderId> = {
    crypto: 'coingecko',
    equity: hasFinnhub ? 'finnhub' : 'yahoo',
    commodity: 'yahoo',
    index: 'yahoo',
    fx: 'fx',
    cross: 'coingecko',
  }

  const sawSuccess = new Set<MarketsProviderId>()
  const sawFailure = new Set<MarketsProviderId>()

  for (const q of quotes) {
    const primary = kindPrimary[q.kind] ?? 'yahoo'
    if (q.last > 0 && q.source && !['error', 'none', 'invalid'].includes(q.source)) {
      const mapped = providerFromQuoteSource(q.source) ?? primary
      sawSuccess.add(mapped)
    } else if (q.source === 'error' || q.source === 'none' || !(q.last > 0)) {
      sawFailure.add(primary)
    }
  }

  for (const id of sawSuccess) recordProviderSuccess(id)
  for (const id of sawFailure) {
    if (!sawSuccess.has(id)) recordProviderFailure(id, 'No live quote this refresh')
  }
}

/** One-line status for Markets page when providers are degraded. */
export function formatMarketsProviderHealthHint(minFailures = 2): string | null {
  const bad = getMarketsProviderHealth().filter((p) => p.consecutiveFailures >= minFailures)
  if (bad.length === 0) return null
  const parts = bad.map((p) => {
    const when = p.lastSuccessAt
      ? ` last OK ${new Date(p.lastSuccessAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
      : ''
    return `${labelProvider(p.id)} ${p.consecutiveFailures}× fail${when}`
  })
  return `Feeds struggling · ${parts.join(' · ')}`
}

function labelProvider(id: MarketsProviderId): string {
  switch (id) {
    case 'coingecko':
      return 'CoinGecko'
    case 'yahoo':
      return 'Yahoo'
    case 'finnhub':
      return 'Finnhub'
    case 'coincap':
      return 'CoinCap'
    case 'coinbase':
      return 'Coinbase'
    case 'fx':
      return 'FX'
    default:
      return id
  }
}
