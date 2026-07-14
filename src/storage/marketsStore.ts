/** Persist Markets watchlist (workspace-level). */

import {
  createEmptyMarketsState,
  newMarketTickerId,
  normalizeMarketSymbol,
  type MarketAssetKind,
  type MarketTicker,
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

function writeState(state: MarketsState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  notifyChanged()
}

export function loadMarketsState(): MarketsState {
  const existing = readRaw()
  if (existing) {
    return {
      ...existing,
      collapsed: {
        crypto: Boolean(existing.collapsed?.crypto),
        equities: Boolean(existing.collapsed?.equities),
      },
      tickers: existing.tickers.map((t, i) => ({
        ...t,
        symbol: normalizeMarketSymbol(t.symbol),
        sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
      })),
    }
  }
  const seeded = createEmptyMarketsState()
  writeState(seeded)
  return seeded
}

export function saveMarketsState(state: MarketsState): void {
  writeState({
    ...state,
    version: 1,
    tickers: state.tickers.map((t, i) => ({
      ...t,
      symbol: normalizeMarketSymbol(t.symbol),
      sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
    })),
  })
}

export function listMarketTickers(kind?: MarketAssetKind): MarketTicker[] {
  const state = loadMarketsState()
  const list = [...state.tickers].sort((a, b) => a.sortOrder - b.sortOrder)
  return kind ? list.filter((t) => t.kind === kind) : list
}

export function addMarketTicker(input: {
  kind: MarketAssetKind
  symbol: string
  name: string
  coingeckoId?: string
}): MarketTicker {
  const symbol = normalizeMarketSymbol(input.symbol)
  if (!symbol) throw new Error('Symbol is required.')
  const state = loadMarketsState()
  const dup = state.tickers.find(
    (t) => t.kind === input.kind && normalizeMarketSymbol(t.symbol) === symbol,
  )
  if (dup) throw new Error('This ticker is already on Markets.')
  const maxOrder = state.tickers.reduce((m, t) => Math.max(m, t.sortOrder), -1)
  const ticker: MarketTicker = {
    id: newMarketTickerId(input.kind, symbol),
    kind: input.kind,
    symbol,
    name: input.name.trim() || symbol,
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
  const nextSymbol = patch.symbol != null ? normalizeMarketSymbol(patch.symbol) : current.symbol
  const nextKind = patch.kind ?? current.kind
  if (!nextSymbol) throw new Error('Symbol is required.')
  const clash = state.tickers.find(
    (t) => t.id !== id && t.kind === nextKind && normalizeMarketSymbol(t.symbol) === nextSymbol,
  )
  if (clash) throw new Error('This ticker is already on Markets.')
  const updated: MarketTicker = {
    ...current,
    kind: nextKind,
    symbol: nextSymbol,
    name: patch.name != null ? patch.name.trim() || nextSymbol : current.name,
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

export function setMarketsCollapsed(section: 'crypto' | 'equities', collapsed: boolean): void {
  const state = loadMarketsState()
  state.collapsed = { ...state.collapsed, [section]: collapsed }
  saveMarketsState(state)
}

export function setMarketsLastRefresh(iso: string): void {
  const state = loadMarketsState()
  state.lastRefreshAt = iso
  // Avoid dirty-marking sync for quote cache timestamps alone — write without markLocalDataChanged
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function exportMarketsForBackup(): MarketsState {
  return loadMarketsState()
}

export function importMarketsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as MarketsState
  if (parsed.version !== 1 || !Array.isArray(parsed.tickers)) return
  saveMarketsState(parsed)
}
