/** Persist Markets watchlist (workspace-level). */

import {
  createEmptyMarketsState,
  defaultNameForPair,
  mergeDefaultTickers,
  newMarketTickerId,
  normalizeMarketSymbol,
  normalizeSectionOrder,
  parseRatePair,
  MARKET_TICKER_TAGS,
  type MarketAssetKind,
  type MarketQuote,
  type MarketTicker,
  type MarketTickerTag,
  type MarketsCollapsed,
  type MarketsDensity,
  type MarketsSectionKey,
  type MarketsState,
} from '../domain/markets'
import { isMarketTimeframe, type MarketTimeframe } from '../domain/marketTimeframe'
import { quotesMapToRecord, quotesRecordToMap } from '../domain/marketQuotesCache'
import {
  exportMarketQuotesForBackup as packMarketQuotes,
  mergeQuotesForSync,
  parseMarketQuotesBackup,
} from '../domain/marketQuotesSync'

function touchPrefs(state: MarketsState): void {
  state.prefsUpdatedAt = new Date().toISOString()
}

const KEY = 'mydsp_markets_v1'
type StoredMarketsState = Omit<MarketsState, 'density'> & { density?: unknown }

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

function readRaw(): StoredMarketsState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredMarketsState
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

function normalizeQuantity(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined
  return raw
}

function normalizeAvgCostGbp(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return undefined
  return raw
}

function normalizeTicker(t: MarketTicker, i: number): MarketTicker {
  const notes =
    typeof t.notes === 'string' && t.notes.trim() ? t.notes.trim() : undefined
  const tag = normalizeTag(t.tag)
  const yieldPct = normalizeYieldPct(t.yieldPct)
  const quantity = normalizeQuantity(t.quantity)
  const avgCostGbp = normalizeAvgCostGbp(t.avgCostGbp)
  return {
    ...t,
    kind: (['crypto', 'equity', 'commodity', 'fx', 'cross', 'index'].includes(t.kind)
      ? t.kind
      : 'equity') as MarketAssetKind,
    symbol: normalizeMarketSymbol(t.symbol),
    sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
    notes,
    tag,
    yieldPct,
    quantity,
    avgCostGbp,
  }
}

export function loadMarketsState(): MarketsState {
  const existing = readRaw()
  if (existing) {
    const hadLegacyHeatDensity = existing.density === 'heat'
    const normalized: MarketsState = {
      ...existing,
      version: 1,
      collapsed: {
        crypto: Boolean(existing.collapsed?.crypto),
        equities: Boolean(existing.collapsed?.equities),
        commodities: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.commodities),
        indices: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.indices),
        fx: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.fx),
        crosses: Boolean((existing.collapsed as MarketsCollapsed | undefined)?.crosses),
      },
      sectionOrder: normalizeSectionOrder((existing as MarketsState).sectionOrder),
      tickers: existing.tickers.map(normalizeTicker),
      density: existing.density === 'compact' ? 'compact' : 'comfortable',
      timeframe: isMarketTimeframe((existing as MarketsState).timeframe)
        ? (existing as MarketsState).timeframe
        : '24H',
    }
    const { state, added } = mergeDefaultTickers(normalized)
    const hadNoSectionOrder = !Array.isArray((existing as MarketsState).sectionOrder)
    if (added.length > 0 || hadLegacyHeatDensity || hadNoSectionOrder) writeState(state)
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
  if (kind === 'commodity') {
    if (!/^[A-Z0-9.=^]+$/.test(norm)) {
      throw new Error('Use a commodity symbol like GC=F (gold), SI=F (silver), or HG=F (copper).')
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
  quantity?: number | null
  avgCostGbp?: number | null
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
    quantity:
      input.kind === 'commodity' ? normalizeQuantity(input.quantity ?? undefined) : undefined,
    avgCostGbp:
      input.kind === 'commodity' ? normalizeAvgCostGbp(input.avgCostGbp ?? undefined) : undefined,
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
    quantity?: number | null
    avgCostGbp?: number | null
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
    quantity:
      nextKind !== 'commodity'
        ? undefined
        : patch.quantity !== undefined
          ? normalizeQuantity(patch.quantity ?? undefined)
          : current.quantity,
    avgCostGbp:
      nextKind !== 'commodity'
        ? undefined
        : patch.avgCostGbp !== undefined
          ? normalizeAvgCostGbp(patch.avgCostGbp ?? undefined)
          : current.avgCostGbp,
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

export function getMarketSectionOrder(): MarketsSectionKey[] {
  return normalizeSectionOrder(loadMarketsState().sectionOrder)
}

/** Persist top→bottom order of Markets section cards (My Crypto, My Equities, …). */
export function reorderMarketSections(ordered: MarketsSectionKey[]): void {
  const state = loadMarketsState()
  state.sectionOrder = normalizeSectionOrder(ordered)
  touchPrefs(state)
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

export function setMarketsDensity(density: MarketsDensity): void {
  const state = loadMarketsState()
  state.density = density
  touchPrefs(state)
  saveMarketsState(state)
}

export function getMarketsDensity(): MarketsDensity {
  const d = loadMarketsState().density
  if (d === 'compact') return d
  return 'comfortable'
}

export function setMarketsTimeframe(timeframe: MarketTimeframe): void {
  const state = loadMarketsState()
  state.timeframe = timeframe
  touchPrefs(state)
  saveMarketsState(state)
}

export function getMarketsTimeframe(): MarketTimeframe {
  const tf = loadMarketsState().timeframe
  return isMarketTimeframe(tf) ? tf : '24H'
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

export function saveMarketQuotesCache(
  map: Map<string, MarketQuote>,
  opts?: { fromSync?: boolean; markDirty?: boolean },
): void {
  try {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(quotesMapToRecord(map)))
    window.dispatchEvent(new CustomEvent('mydsp-markets-quotes'))
  } catch {
    /* quota / private mode */
  }
  if (opts?.markDirty && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportMarketsForBackup(): MarketsState {
  return loadMarketsState()
}

/** Last-good quotes for fullArchive / sync (by ticker id). */
export function exportMarketQuotesForBackup(): Record<string, MarketQuote> {
  return packMarketQuotes(loadMarketQuotesCache())
}

/** Merge remote quotes into local cache (age-based; tags sync: for UI freshness). */
export function importMarketQuotesFromBackup(raw: unknown): void {
  const remote = parseMarketQuotesBackup(raw)
  if (remote.size === 0) return
  const local = loadMarketQuotesCache()
  const merged = mergeQuotesForSync(local, remote)
  saveMarketQuotesCache(merged, { fromSync: true })
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
    commodities: Boolean(
      (collapsedRemote as MarketsCollapsed | undefined)?.commodities ??
        (collapsedLocal as MarketsCollapsed | undefined)?.commodities,
    ),
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

  const remoteOrder = normalizeSectionOrder((parsed as MarketsState).sectionOrder)
  const localOrder = normalizeSectionOrder((local as MarketsState | null)?.sectionOrder)
  const remotePrefsAt = Date.parse((parsed as MarketsState).prefsUpdatedAt || '') || 0
  const localPrefsAt =
    Date.parse(((local as MarketsState | null)?.prefsUpdatedAt as string | undefined) || '') || 0
  const preferRemotePrefs = remotePrefsAt >= localPrefsAt && remotePrefsAt > 0
  const remoteCustomized =
    JSON.stringify(remoteOrder) !== JSON.stringify(normalizeSectionOrder(undefined))
  const sectionOrder = preferRemotePrefs
    ? remoteOrder
    : remoteCustomized && localPrefsAt === 0
      ? remoteOrder
      : localOrder

  const density: MarketsDensity = preferRemotePrefs
    ? (parsed as MarketsState).density === 'compact'
      ? 'compact'
      : 'comfortable'
    : (local as MarketsState | null)?.density === 'compact' ||
        (parsed as MarketsState).density === 'compact'
      ? 'compact'
      : 'comfortable'
  const timeframeRaw = preferRemotePrefs
    ? (parsed as MarketsState).timeframe
    : ((local as MarketsState | null)?.timeframe ?? (parsed as MarketsState).timeframe)
  const timeframe = isMarketTimeframe(timeframeRaw) ? timeframeRaw : '24H'
  const prefsUpdatedAt =
    remotePrefsAt >= localPrefsAt
      ? (parsed as MarketsState).prefsUpdatedAt || (local as MarketsState | null)?.prefsUpdatedAt
      : (local as MarketsState | null)?.prefsUpdatedAt || (parsed as MarketsState).prefsUpdatedAt

  const { state } = mergeDefaultTickers({
    version: 1,
    tickers: [...byKey.values()],
    collapsed,
    sectionOrder,
    density,
    timeframe,
    prefsUpdatedAt,
  })
  writeState(state, { fromSync: true })
}
