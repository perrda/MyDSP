/** Persist Markets watchlist (workspace-level). */

import {
  createEmptyMarketsState,
  defaultNameForPair,
  mergeDefaultTickers,
  newMarketTickerId,
  normalizeMarketSymbol,
  parseRatePair,
  type MarketAssetKind,
  type MarketTicker,
  type MarketsCollapsed,
  type MarketsState,
} from '../domain/markets'

const KEY = 'mydsp_markets_v1'

function notifyChanged(): void {
  void import('../services/sync/autoSyncService')
    .then((m) => m.markLocalDataChanged())
    .catch(() => {
      /* sync may be unavailable */
    })
  try {
    window.dispatchEvent(new CustomEvent('mydsp-markets-changed'))
  } catch {
    /* ignore */
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

function writeState(state: MarketsState, opts?: { silent?: boolean }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  if (!opts?.silent) notifyChanged()
}

function normalizeTicker(t: MarketTicker, i: number): MarketTicker {
  return {
    ...t,
    kind: (['crypto', 'equity', 'fx', 'cross'].includes(t.kind) ? t.kind : 'equity') as MarketAssetKind,
    symbol: normalizeMarketSymbol(t.symbol),
    sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
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
  return norm
}

export function addMarketTicker(input: {
  kind: MarketAssetKind
  symbol: string
  name: string
  coingeckoId?: string
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
    createdAt: new Date().toISOString(),
    sortOrder: maxOrder + 1,
  }
  state.tickers.push(ticker)
  saveMarketsState(state)
  return ticker
}

export function updateMarketTicker(
  id: string,
  patch: Partial<Pick<MarketTicker, 'symbol' | 'name' | 'coingeckoId' | 'kind'>>,
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

export function setMarketsCollapsed(
  section: keyof MarketsCollapsed,
  collapsed: boolean,
): void {
  const state = loadMarketsState()
  state.collapsed = { ...state.collapsed, [section]: collapsed }
  saveMarketsState(state)
}

export function setMarketsLastRefresh(iso: string): void {
  const state = loadMarketsState()
  state.lastRefreshAt = iso
  writeState(state, { silent: true })
}

export function exportMarketsForBackup(): MarketsState {
  return loadMarketsState()
}

export function importMarketsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as MarketsState
  if (parsed.version !== 1 || !Array.isArray(parsed.tickers)) return
  const { state } = mergeDefaultTickers({
    ...parsed,
    collapsed: {
      crypto: Boolean(parsed.collapsed?.crypto),
      equities: Boolean(parsed.collapsed?.equities),
      fx: Boolean((parsed.collapsed as MarketsCollapsed | undefined)?.fx),
      crosses: Boolean((parsed.collapsed as MarketsCollapsed | undefined)?.crosses),
    },
    tickers: parsed.tickers.map(normalizeTicker),
  })
  saveMarketsState(state)
}
