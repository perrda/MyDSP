import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { calcBreakdown, goalCurrent, goalProgress } from '../domain/calc'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { upsertDailySnapshot } from '../domain/history'
import { appendHoldingPrices } from '../domain/holdingHistory'
import type { NetWorthBreakdown, PortfolioData, PortfolioMeta } from '../domain/types'
import { fetchCryptoPricesGbp, fetchEquityPrices } from '../services/prices'
import {
  enqueueOfflineJob,
  loadOfflineQueue,
  removeOfflineJob,
} from '../services/offlineQueue'
import {
  ensureFxRates,
  fetchFxRates,
  loadCachedFxRates,
  type FxRates,
} from '../services/fx'
import { getSessionSyncPassphrase } from '../services/sync/sessionPassphrase'
import { pushSync } from '../services/sync/syncService'
import {
  markLocalDataChanged,
  runAutoSyncCycle,
  startAutoSync,
  stopAutoSync,
  isApplyingRemote,
} from '../services/sync/autoSyncService'
import { setDisplayCurrency } from '../utils/format'
import { migrateEquityLivePricesToGbp, repairEquityLivePricesToGbp, EQUITY_GBP_VERSION } from '../domain/migrateEquityGbp'
import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import {
  bootstrapFamilyPortfolios,
  canCreatePortfolio,
  createPortfolio as createPortfolioMeta,
  deletePortfolio as deletePortfolioMeta,
  exportRawPortfolio,
  getActivePortfolioId,
  hasFccData,
  importRawPortfolio,
  listPortfolios,
  loadPortfolio,
  MAX_PORTFOLIOS,
  renamePortfolio as renamePortfolioMeta,
  savePortfolio,
  savePortfolioImmediate,
  setActivePortfolioId,
  setOnPortfolioDataChanged,
} from '../storage/portfolioStore'
import { ensureDailyBackup } from '../storage/backupStore'

interface PortfolioContextValue {
  data: PortfolioData
  setData: (updater: PortfolioData | ((prev: PortfolioData) => PortfolioData)) => void
  breakdown: NetWorthBreakdown
  portfolios: PortfolioMeta[]
  activeId: string
  switchPortfolio: (id: string) => void
  createPortfolio: (name: string) => { ok: boolean; error?: string }
  renamePortfolio: (id: string, name: string) => { ok: boolean; error?: string }
  deletePortfolio: (id: string) => void
  maxPortfolios: number
  canAddPortfolio: boolean
  reload: () => void
  resetToSample: () => void
  clearAll: () => void
  importJson: (raw: unknown) => void
  exportJson: () => Record<string, unknown>
  fccDataPresent: boolean
  goalCurrent: (metric: string) => number
  goalProgress: (goal: PortfolioData['goals'][number]) => number
  privacy: boolean
  setPrivacy: (v: boolean) => void
  refreshing: boolean
  refreshPrices: () => Promise<{ crypto: number; equities: number; skipped?: string }>
  lastPriceError: string | null
  lastPriceThrottleUntil: number | null
  fxRates: FxRates
  refreshFx: () => Promise<void>
  setCurrency: (code: string) => void
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState(getActivePortfolioId)
  const [portfolios, setPortfolios] = useState(() => {
    bootstrapFamilyPortfolios()
    return listPortfolios()
  })
  const [data, setDataState] = useState<PortfolioData>(() => {
    const initial = loadPortfolio(getActivePortfolioId())
    const rates = loadCachedFxRates()
    const { data: migrated, migrated: didMigrate } = migrateEquityLivePricesToGbp(initial, rates)
    if (didMigrate) {
      savePortfolioImmediate(migrated, getActivePortfolioId())
    }
    setDisplayCurrency(migrated.settings.currency || 'GBP', rates)
    return migrated
  })
  const [fccDataPresent, setFccDataPresent] = useState(() => hasFccData())
  const [refreshing, setRefreshing] = useState(false)
  const [lastPriceError, setLastPriceError] = useState<string | null>(null)
  const [lastPriceThrottleUntil, setLastPriceThrottleUntil] = useState<number | null>(null)
  const lastRefreshAtRef = useRef(0)
  const [fxRates, setFxRates] = useState<FxRates>(() => loadCachedFxRates())
  const PRICE_THROTTLE_MS = 60_000
  const STALE_AUTO_MS = 4 * 60 * 60_000
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    setDisplayCurrency(data.settings.currency || 'GBP', fxRates)
  }, [data.settings.currency, fxRates])

  // Async repair: catch USD livePrices wrongly flagged as GBP (compare to static GBP series)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rates = loadCachedFxRates()
      const { data: repaired, repaired: did } = await repairEquityLivePricesToGbp(
        dataRef.current,
        rates,
      )
      if (cancelled || !did) return
      savePortfolioImmediate(repaired, activeIdRef.current)
      setDataState(repaired)
    })()
    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    void fetchFxRates()
      .then((rates) => {
        setFxRates(rates)
        setDisplayCurrency(dataRef.current.settings.currency || 'GBP', rates)
      })
      .catch(() => {
        /* keep cached defaults */
      })
  }, [])

  const refreshFx = useCallback(async () => {
    try {
      const rates = await fetchFxRates()
      setFxRates(rates)
      setDisplayCurrency(dataRef.current.settings.currency || 'GBP', rates)
    } catch {
      /* keep previous */
    }
  }, [])

  const persist = useCallback(
    (next: PortfolioData) => {
      setDataState(next)
      savePortfolio(next, activeId)
    },
    [activeId],
  )

  const setData = useCallback(
    (updater: PortfolioData | ((prev: PortfolioData) => PortfolioData)) => {
      setDataState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        savePortfolio(next, activeId)
        return next
      })
    },
    [activeId],
  )

  const setCurrency = useCallback(
    (code: string) => {
      const allowed = new Set(['GBP', 'BTC', 'USD', 'THB'])
      const next = allowed.has(code) ? code : 'GBP'
      setDisplayCurrency(next, fxRates)
      setData((prev) => ({
        ...prev,
        settings: { ...prev.settings, currency: next },
      }))
    },
    [setData, fxRates],
  )

  const reload = useCallback(() => {
    try {
      const id = getActivePortfolioId()
      const portfolios = listPortfolios()
      const safeId = portfolios.some((p) => p.id === id) ? id : 'default'
      if (safeId !== id) setActivePortfolioId(safeId)
      setPortfolios(portfolios)
      setActiveId(safeId)
      const loaded = loadPortfolio(safeId)
      const rates = loadCachedFxRates()
      const { data: migrated, migrated: didMigrate } = migrateEquityLivePricesToGbp(loaded, rates)
      if (didMigrate) savePortfolioImmediate(migrated, safeId)
      setDataState(migrated)
      setDisplayCurrency(migrated.settings.currency || 'GBP', rates)
      setFccDataPresent(hasFccData())
    } catch (e) {
      console.warn('[portfolio] reload after sync failed:', e)
      try {
        setPortfolios(listPortfolios())
        setActiveId(getActivePortfolioId())
        setDataState(loadPortfolio())
      } catch {
        /* keep previous React state — data already on disk */
      }
    }
  }, [])

  const switchPortfolio = useCallback(
    (id: string) => {
      savePortfolioImmediate(dataRef.current, activeId)
      setActivePortfolioId(id)
      setActiveId(id)
      const loaded = loadPortfolio(id)
      const rates = loadCachedFxRates()
      const { data: migrated, migrated: didMigrate } = migrateEquityLivePricesToGbp(loaded, rates)
      if (didMigrate) savePortfolioImmediate(migrated, id)
      setDataState(migrated)
      setDisplayCurrency(migrated.settings.currency || 'GBP', rates)
    },
    [activeId],
  )

  const createPortfolio = useCallback(
    (name: string): { ok: boolean; error?: string } => {
      if (!canCreatePortfolio()) {
        return {
          ok: false,
          error: `Maximum of ${MAX_PORTFOLIOS} portfolios (David + up to 5 others).`,
        }
      }
      try {
        savePortfolioImmediate(dataRef.current, activeId)
        const meta = createPortfolioMeta(name.trim(), { empty: true })
        setPortfolios(listPortfolios())
        setActivePortfolioId(meta.id)
        setActiveId(meta.id)
        setDataState(loadPortfolio(meta.id))
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not create portfolio' }
      }
    },
    [activeId],
  )

  const renamePortfolio = useCallback((id: string, name: string): { ok: boolean; error?: string } => {
    try {
      renamePortfolioMeta(id, name)
      setPortfolios(listPortfolios())
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not rename portfolio' }
    }
  }, [])

  const deletePortfolio = useCallback(
    (id: string) => {
      savePortfolioImmediate(dataRef.current, activeId)
      deletePortfolioMeta(id)
      const nextId = getActivePortfolioId()
      setPortfolios(listPortfolios())
      setActiveId(nextId)
      setDataState(loadPortfolio(nextId))
    },
    [activeId],
  )

  const resetToSample = useCallback(() => {
    persist(createSamplePortfolio())
  }, [persist])

  const clearAll = useCallback(() => {
    persist(createEmptyPortfolio())
  }, [persist])

  const importJson = useCallback(
    (raw: unknown) => {
      const payload =
        raw && typeof raw === 'object' && 'data' in (raw as object)
          ? (raw as { data: unknown }).data
          : raw
      const next = importRawPortfolio(payload, activeId)
      setDataState(next)
      setPortfolios(listPortfolios())
      setFccDataPresent(hasFccData())
    },
    [activeId],
  )

  const exportJson = useCallback(() => exportRawPortfolio(activeId), [activeId])

  const setPrivacy = useCallback(
    (v: boolean) => {
      setData((prev) => ({
        ...prev,
        settings: { ...prev.settings, privacy: v },
      }))
    },
    [setData],
  )

  const refreshPrices = useCallback(async () => {
    const snapshot = dataRef.current
    if (snapshot.settings.privacy) {
      setLastPriceError('Price refresh blocked while privacy mode is on.')
      return { crypto: 0, equities: 0, skipped: 'privacy' }
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineJob('quote_refresh', { note: 'Queued while offline' })
      setLastPriceError('Offline — quote refresh queued.')
      return { crypto: 0, equities: 0, skipped: 'offline' }
    }
    const nowMs = Date.now()
    if (nowMs - lastRefreshAtRef.current < PRICE_THROTTLE_MS) {
      const until = lastRefreshAtRef.current + PRICE_THROTTLE_MS
      setLastPriceThrottleUntil(until)
      setLastPriceError(`Wait ${Math.ceil((until - nowMs) / 1000)}s before refreshing again.`)
      return { crypto: 0, equities: 0, skipped: 'throttle' }
    }

    const startedOn = activeIdRef.current
    setRefreshing(true)
    setLastPriceError(null)
    try {
      const rates = await ensureFxRates()
      setFxRates(rates)
      setDisplayCurrency(dataRef.current.settings.currency || 'GBP', rates)

      const cryptoUpdates = await fetchCryptoPricesGbp(
        snapshot.crypto.map((c) => c.symbol),
        snapshot.settings.manualCryptoPrices ?? {},
      )
      const equityMap = await fetchEquityPrices(
        snapshot.equities.map((e) => e.symbol),
        snapshot.settings.finnhubKey || localStorage.getItem('finnhub_key') || '',
        rates,
      )

      if (activeIdRef.current !== startedOn) {
        return { crypto: 0, equities: 0 }
      }

      const now = new Date().toISOString()
      setData((prev) => {
        const crypto = prev.crypto.map((c) => {
          const u = cryptoUpdates.find((x) => x.symbol === c.symbol)
          if (u && u.price > 0) return { ...c, price: u.price }
          return c
        })
        const equities = prev.equities.map((e) => {
          const p = equityMap[e.symbol.toUpperCase()]
          if (p && p > 0) return { ...e, livePrice: p }
          return e
        })
        // Only mark GBP-normalized when every US listing received a converted quote
        const usSymbols = prev.equities
          .map((e) => e.symbol.toUpperCase())
          .filter((s) => equityNeedsUsdToGbp(s))
        const allUsQuoted = usSymbols.every((s) => equityMap[s] > 0)
        let next: PortfolioData = {
          ...prev,
          crypto,
          equities,
          settings: { ...prev.settings, lastPriceUpdate: now },
          extras: {
            ...prev.extras,
            ...(allUsQuoted
              ? { equityPricesAreGbp: true, equityGbpVersion: EQUITY_GBP_VERSION }
              : {}),
          },
        }
        const holdingUpdates = [
          ...crypto
            .filter((c) => c.price > 0)
            .map((c) => ({ kind: 'crypto' as const, symbol: c.symbol, price: c.price })),
          ...equities
            .filter((e) => e.livePrice > 0)
            .map((e) => ({ kind: 'equity' as const, symbol: e.symbol, price: e.livePrice })),
        ]
        next = appendHoldingPrices(next, holdingUpdates, now)
        return upsertDailySnapshot(next, 'auto', { forceIntraday: true })
      })

      lastRefreshAtRef.current = Date.now()
      setLastPriceThrottleUntil(null)

      return {
        crypto: cryptoUpdates.filter((u) => u.price > 0).length,
        equities: Object.keys(equityMap).length,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Price refresh failed'
      setLastPriceError(msg)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineJob('quote_refresh', { note: msg })
      }
      return { crypto: 0, equities: 0 }
    } finally {
      setRefreshing(false)
    }
  }, [setData])

  // Auto-refresh when returning to tab if quotes are stale (>4h)
  useEffect(() => {
    const onFocus = () => {
      const last = dataRef.current.settings.lastPriceUpdate
      if (!last) return
      if (dataRef.current.settings.privacy) return
      const age = Date.now() - new Date(last).getTime()
      if (age > STALE_AUTO_MS) void refreshPrices()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshPrices])

  // Automatic Cloudflare sync: pull on resume, push after local edits
  useEffect(() => {
    setOnPortfolioDataChanged(() => markLocalDataChanged())
    startAutoSync()
    const onApplied = () => {
      // Defer so Pull-to-refresh / in-flight React updates finish before remounting charts
      window.setTimeout(() => {
        try {
          reload()
        } catch (e) {
          console.warn('[portfolio] sync reload failed:', e)
        }
      }, 0)
    }
    window.addEventListener('mydsp-sync-applied', onApplied)
    return () => {
      setOnPortfolioDataChanged(null)
      stopAutoSync()
      window.removeEventListener('mydsp-sync-applied', onApplied)
    }
  }, [reload])

  // Flush offline quote + sync jobs when connectivity returns
  useEffect(() => {
    const onOnline = () => {
      const queue = loadOfflineQueue()
      for (const job of queue) {
        if (job.type === 'quote_refresh') {
          void refreshPrices().then(() => removeOfflineJob(job.id))
          continue
        }
        if (job.type === 'sync_push' && job.remoteUrl) {
          const pass = getSessionSyncPassphrase()
          if (!pass) continue
          void pushSync(job.remoteUrl, pass)
            .then(() => removeOfflineJob(job.id))
            .catch(() => {
              /* keep queued */
            })
        }
      }
      void runAutoSyncCycle('online')
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refreshPrices])

  const breakdown = useMemo(() => {
    try {
      return calcBreakdown(data)
    } catch (e) {
      console.warn('[portfolio] calcBreakdown failed:', e)
      const emptyAsset = { value: 0, cost: 0, pnl: 0, pct: 0 }
      const emptyLiab = { cc: 0, loans: 0, total: 0, monthly: 0 }
      return {
        netWorth: 0,
        assets: 0,
        liabilities: 0,
        crypto: emptyAsset,
        equity: emptyAsset,
        liability: emptyLiab,
      }
    }
  }, [data])

  useEffect(() => {
    if (isApplyingRemote()) return
    setDataState((prev) => {
      try {
        const next = upsertDailySnapshot(prev, 'auto')
        if (next === prev || next.history === prev.history) {
          const today = new Date().toISOString().slice(0, 10)
          const before = prev.history.find((h) => (h.date ?? '').slice(0, 10) === today)
          const after = next.history.find((h) => (h.date ?? '').slice(0, 10) === today)
          if (
            before &&
            after &&
            before.netWorth === after.netWorth &&
            before.crypto === after.crypto &&
            before.equity === after.equity
          ) {
            return prev
          }
        }
        if (next.history.length === prev.history.length) {
          const today = new Date().toISOString().slice(0, 10)
          const a = prev.history.find((h) => (h.date ?? '').slice(0, 10) === today)
          const b = next.history.find((h) => (h.date ?? '').slice(0, 10) === today)
          if (a && b && a.netWorth === b.netWorth) return prev
        }
        savePortfolioImmediate(next, activeId)
        return next
      } catch (e) {
        console.warn('[portfolio] daily snapshot failed:', e)
        return prev
      }
    })
  }, [activeId])

  // Automatic full workspace backup once per calendar day (keeps last 10)
  useEffect(() => {
    const t = window.setTimeout(() => {
      void ensureDailyBackup().catch(() => {
        /* IndexedDB may be unavailable */
      })
    }, 2500)
    return () => window.clearTimeout(t)
  }, [])

  const value: PortfolioContextValue = {
    data,
    setData,
    breakdown,
    portfolios,
    activeId,
    switchPortfolio,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    maxPortfolios: MAX_PORTFOLIOS,
    canAddPortfolio: portfolios.length < MAX_PORTFOLIOS,
    reload,
    resetToSample,
    clearAll,
    importJson,
    exportJson,
    fccDataPresent,
    goalCurrent: (metric) => goalCurrent(data, metric),
    goalProgress: (goal) => goalProgress(data, goal),
    privacy: data.settings.privacy,
    setPrivacy,
    refreshing,
    refreshPrices,
    lastPriceError,
    lastPriceThrottleUntil,
    fxRates,
    refreshFx,
    setCurrency,
  }

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider')
  return ctx
}
