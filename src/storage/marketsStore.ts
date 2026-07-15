/** Persist Markets watchlist (workspace-level). */

import {
  createEmptyMarketsState,
  defaultNameForPair,
  mergeDefaultTickers,
  newMarketTickerId,
  normalizeMarketSymbol,
  parseRatePair,
  MARKET_TICKER_TAGS,
  type MarketAssetKind,
  type MarketQuote,
  type MarketTicker,
  type MarketTickerTag,
  type MarketsCollapsed,
  type MarketsState,
} from '../domain/markets'
import { quotesMapToRecord, quotesRecordToMap } from '../domain/marketQuotesCache'

const KEY = 'mydsp_markets_v1'

function notifyChanged(opts?: { fromSync?: boolean }): void {
  // Markets edits mark workspace sync dirty so watchlists replicate across devices.
  // Pull-before-push still protects portfolio todos from being overwritten by stale phones.
  try {
    window.dispatchEvent(new CustomEvent('mydsp-markets-changed'))
  } catch {
    /* ignore */
  }
  if (!opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) =>
      m.markWorkspaceChangedForSync(),
    )
  }
}

function readRaw(): MarketsState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MarketsState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tickers)) return null
    return parsed
  } catch {
    return null
  }
}

function writeState(state: MarketsState, opts?: { silent?: boolean; fromSync?: boolean }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  if (!opts?.silent) notifyChanged({ fromSync: opts?.fromSync })
}

function normalizeTag(raw: unknown): MarketTickerTag | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  return (MARKET_TICKER_TAGS as string[]).includes(t) ? (t as MarketTickerTag) : undefined
}

function normalizeYieldPct(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined
  return Math.min(100, raw)
}

function normalizeTicker(t: MarketTicker, i: number): MarketTicker {
  const notes =
    typeof t.notes === 'string' && t.notes.trim() ? t.notes.trim() : undefined
  const tag = normalizeTag(t.tag)
  const yieldPct = normalizeYieldPct(t.yieldPct)
  return {
    ...t,
    kind: (['crypto', 'equity', 'fx', 'cross', 'index'].includes(t.kind)
      ? t.kind
      : 'equity') as MarketAssetKind,
    symbol: normalizeMarketSymbol(t.symbol),
    sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
    notes,
    tag,
    yieldPct,
  }
}

export function loadMarketsState(): MarketsState {
  const existing = readRaw()
  if (existing) {
    const normalized: MarketsState = {
      ...existing,
      version: 1,
      collapsed: {
        crypto: Boolean(existing.collapsed?.crypto),
        equities: Boolean(existing.collapsed?.equities),
        indices: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.indices),
        fx: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.fx),
        crosses: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.crosses),
      },
      tickers: existing.tickers.map(normalizeTicker),
    }
    const { state, added } = mergeDefaultTickers(normalized)
    if (added.length > 0) writeState(state)
    return state
  }
  const seeded = createEmptyMarketsState()
  writeState(seeded)
  return seeded
}

export function saveMarketsState(state: MarketsState): void {
  writeState({
    ...state,
    version: 1,
    tickers: state.tickers.map(normalizeTicker),
  })
}

export function listMarketTickers(kind?: MarketAssetKind): MarketTicker[] {
  const state = loadMarketsState()
  const list = [...state.tickers].sort((a, b) => a.sortOrder - b.sortOrder)
  return kind ? list.filter((t) => t.kind === kind) : list
}

function validateSymbol(kind: MarketAssetKind, symbol: string): string {
  const norm = normalizeMarketSymbol(symbol)
  if (!norm) throw new Error('Symbol is required.')
  if (kind === 'fx' || kind === 'cross') {
    const pair = parseRatePair(norm)
    if (!pair) throw new Error('Use a pair like GBP/USD or ADA/BTC.')
    if (pair.base === pair.quote) throw new Error('Base and quote must differ.')
  }
  if (kind === 'index') {
    if (!/^[\^]?[A-Z0-9.&]+$/.test(norm)) {
      throw new Error('Use an index symbol like SPX, ^GSPC, NDX, or FTSE.')
    }
  }
  return norm
}

export function addMarketTicker(input: {
  kind: MarketAssetKind
  symbol: string
  name: string
  coingeckoId?: string
  notes?: string
  tag?: MarketTickerTag | ''
  yieldPct?: number | null
}): MarketTicker {
  const symbol = validateSymbol(input.kind, input.symbol)
  const state = loadMarketsState()
  const dup = state.tickers.find(
    (t) => t.kind === input.kind && normalizeMarketSymbol(t.symbol) === symbol,
  )
  if (dup) throw new Error('This rate or ticker is already on Markets.')
  const maxOrder = state.tickers.reduce((m, t) => Math.max(m, t.sortOrder), -1)
  const ticker: MarketTicker = {
    id: newMarketTickerId(input.kind, symbol),
    kind: input.kind,
    symbol,
    name: input.name.trim() || defaultNameForPair(input.kind, symbol),
    coingeckoId: input.coingeckoId?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    tag: normalizeTag(input.tag),
    yieldPct:
      input.kind === 'equity' ? normalizeYieldPct(input.yieldPct ?? undefined) : undefined,
    createdAt: new Date().toISOString(),
    sortOrder: maxOrder + 1,
  }
  state.tickers.push(ticker)
  saveMarketsState(state)
  return ticker
}

export function updateMarketTicker(
  id: string,
  patch: {
    symbol?: string
    name?: string
    coingeckoId?: string
    kind?: MarketAssetKind
    notes?: string
    tag?: MarketTickerTag | ''
    yieldPct?: number | null
  },
): MarketTicker {
  const state = loadMarketsState()
  const idx = state.tickers.findIndex((t) => t.id === id)
  if (idx < 0) throw new Error('Ticker not found.')
  const current = state.tickers[idx]
  const nextKind = patch.kind ?? current.kind
  const nextSymbol =
    patch.symbol != null ? validateSymbol(nextKind, patch.symbol) : current.symbol
  const clash = state.tickers.find(
    (t) => t.id !== id && t.kind === nextKind && normalizeMarketSymbol(t.symbol) === nextSymbol,
  )
  if (clash) throw new Error('This rate or ticker is already on Markets.')
  const updated: MarketTicker = {
    ...current,
    kind: nextKind,
    symbol: nextSymbol,
    name:
      patch.name != null
        ? patch.name.trim() || defaultNameForPair(nextKind, nextSymbol)
        : current.name,
    coingeckoId:
      patch.coingeckoId !== undefined
        ? patch.coingeckoId.trim() || undefined
        : current.coingeckoId,
    notes:
      patch.notes !== undefined
        ? patch.notes.trim() || undefined
        : current.notes,
    tag: patch.tag !== undefined ? normalizeTag(patch.tag) : current.tag,
    yieldPct:
      nextKind !== 'equity'
        ? undefined
        : patch.yieldPct !== undefined
          ? normalizeYieldPct(patch.yieldPct ?? undefined)
          : current.yieldPct,
  }
  state.tickers[idx] = updated
  saveMarketsState(state)
  return updated
}

export function removeMarketTicker(id: string): void {
  const state = loadMarketsState()
  state.tickers = state.tickers.filter((t) => t.id !== id)
  saveMarketsState(state)
}

/**
 * Reorder tickers within a single asset kind. Other kinds keep their sortOrder.
 * `orderedIds` is the full id list for that kind in the new top→bottom order.
 */
export function reorderMarketTickersInKind(kind: MarketAssetKind, orderedIds: string[]): void {
  const state = loadMarketsState()
  const inKind = state.tickers
    .filter((t) => t.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const byId = new Map(inKind.map((t) => [t.id, t]))
  const nextInKind: MarketTicker[] = []
  for (const id of orderedIds) {
    const t = byId.get(id)
    if (t) {
      nextInKind.push(t)
      byId.delete(id)
    }
  }
  for (const t of byId.values()) nextInKind.push(t)

  const idToOrder = new Map(nextInKind.map((t, i) => [t.id, i]))
  state.tickers = state.tickers.map((t) =>
    t.kind === kind && idToOrder.has(t.id)
      ? { ...t, sortOrder: idToOrder.get(t.id)! }
      : t,
  )
  saveMarketsState(state)
}

export function setMarketsCollapsed(
  section: keyof MarketsCollapsed,
  collapsed: boolean,
): void {
  const state = loadMarketsState()
  state.collapsed = { ...state.collapsed, [section]: collapsed }
  saveMarketsState(state)
}

export function setMarketsDensity(density: 'comfortable' | 'compact'): void {
  const state = loadMarketsState()
  state.density = density
  saveMarketsState(state)
}

export function getMarketsDensity(): 'comfortable' | 'compact' {
  return loadMarketsState().density === 'compact' ? 'compact' : 'comfortable'
}

export function setMarketsLastRefresh(iso: string): void {
  const state = loadMarketsState()
  state.lastRefreshAt = iso
  writeState(state, { silent: true })
}

const QUOTES_KEY = 'mydsp_markets_quotes_v1'

/** Last-good Markets quotes (by ticker id) — survives reloads and failed refreshes. */
export function loadMarketQuotesCache(): Map<string, MarketQuote> {
  try {
    const raw = localStorage.getItem(QUOTES_KEY)
    if (!raw) return new Map()
    return quotesRecordToMap(JSON.parse(raw))
  } catch {
    return new Map()
  }
}

export function saveMarketQuotesCache(map: Map<string, MarketQuote>): void {
  try {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(quotesMapToRecord(map)))
    window.dispatchEvent(new CustomEvent('mydsp-markets-quotes'))
  } catch {
    /* quota / private mode */
  }
}

export function exportMarketsForBackup(): MarketsState {
  return loadMarketsState()
}

export function importMarketsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as MarketsState
  if (parsed.version !== 1 || !Array.isArray(parsed.tickers)) return

  const local = readRaw()
  const remoteTickers = parsed.tickers.map(normalizeTicker)
  const keyOf = (t: MarketTicker) => `${t.kind}:${normalizeMarketSymbol(t.symbol)}`

  // Union watchlists: keep local ticker when both have the same kind+symbol;
  // append remote-only tickers so a phone wipe cannot drop Mac-only crosses.
  const byKey = new Map<string, MarketTicker>()
  const localList = local?.tickers?.map(normalizeTicker) ?? []
  for (const t of localList) byKey.set(keyOf(t), t)
  let nextOrder =
    localList.reduce((m, t) => Math.max(m, typeof t.sortOrder === 'number' ? t.sortOrder : 0), 0) + 1
  for (const t of remoteTickers) {
    const k = keyOf(t)
    if (byKey.has(k)) continue
    byKey.set(k, { ...t, sortOrder: nextOrder++ })
  }

  const collapsedLocal = local?.collapsed
  const collapsedRemote = parsed.collapsed
  const collapsed: MarketsCollapsed = {
    crypto: Boolean(collapsedRemote?.crypto ?? collapsedLocal?.crypto),
    equities: Boolean(collapsedRemote?.equities ?? collapsedLocal?.equities),
    indices: Boolean(
      (collapsedRemote as MarketsCollapsed | undefined)?.indices ??
        (collapsedLocal as MarketsCollapsed | undefined)?.indices,
    ),
    fx: Boolean(
      (collapsedRemote as MarketsCollapsed | undefined)?.fx ??
        (collapsedLocal as MarketsCollapsed | undefined)?.fx,
    ),
    crosses: Boolean(
      (collapsedRemote as MarketsCollapsed | undefined)?.crosses ??
        (collapsedLocal as MarketsCollapsed | undefined)?.crosses,
    ),
  }

  const { state } = mergeDefaultTickers({
    version: 1,
    tickers: [...byKey.values()],
    collapsed,
  })
  writeState(state, { fromSync: true })
}
