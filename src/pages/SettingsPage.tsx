import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DataExportPanel } from '../components/DataExportPanel'
import { SettingsSection } from '../components/SettingsSection'
import { PageHeader } from '../components/ui/PageHeader'
import { openSettingsSection, setAllSettingsSectionsOpen } from '../storage/settingsSectionsStore'
import { ConfirmDialog } from '../components/ui/Modal'
import { useSecurity } from '../components/SecurityProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { useTheme, type ThemePreference } from '../context/ThemeContext'
import { useGlass } from '../context/GlassContext'
import { holdingHistoryKey, readHoldingHistory } from '../domain/holdingHistory'
import type { HoldingPricePoint } from '../domain/holdingHistory'
import { registerStaticPriceFile } from '../domain/staticPrices'
import {
  clearOfflineQueue,
  enqueueOfflineJob,
  isOnline,
  loadOfflineQueue,
  removeOfflineJob,
  type OfflineJob,
} from '../services/offlineQueue'
import { DISPLAY_CURRENCIES } from '../services/fx'
import { fetchSymbolHistory } from '../services/yahooHistory'
import {
  conflictKey,
  summarizeConflict,
  summarizeConflictBatch,
  type ConflictChoice,
  type SyncConflict,
} from '../services/sync/conflicts'
import { loadSyncActivity, type SyncActivityEntry } from '../services/sync/syncActivity'
import {
  formatMarketsProviderHealthHint,
  getMarketsProviderHealth,
} from '../services/marketsProviderHealth'
import {
  DEFAULT_LAUNCH_PATH,
  LAUNCH_PATH_OPTIONS,
  loadLaunchPath,
  saveLaunchPath,
} from '../storage/launchPathStore'
import {
  loadPriceAlertThresholds,
  resetPriceAlertThresholds,
  savePriceAlertThresholds,
  type PriceAlertThreshold,
} from '../domain/priceAlerts'
import {
  allConflictsResolved,
  applyMergePreview,
  downloadEncryptedBackup,
  getSyncRemoteUrlWarning,
  loadSyncConfig,
  normalizeSyncRemoteUrl,
  previewImport,
  previewPull,
  pushSync,
  saveSyncConfig,
  type MergePreview,
} from '../services/sync/syncService'
import {
  clearBiometricCred,
  getBiometricLabel,
  hashPin,
  isBiometricSupported,
  loadSecurity,
  registerBiometric,
  saveSecurity,
  verifyPin,
  type SecurityState,
} from '../security/pin'
import {
  notificationManager,
  type NotificationPriority,
  type NotificationSettings,
} from '../utils/notifications'
import {
  clearServiceWorkerCaches,
  createFullBackup,
  deleteFullBackup,
  downloadFullBackupFile,
  getFullBackup,
  listFullBackups,
  MAX_BACKUPS,
  saveFullBackupToFolder,
  parseFullBackupFile,
  restoreFullWorkspace,
  shareBackupFile,
  canUseNativeShare,
  type FullBackupMeta,
} from '../storage/backupStore'
import { STORAGE } from '../storage/keys'
import {
  dedupePortfoliosByName,
  hasDuplicatePortfolioNames,
} from '../storage/portfolioStore'
import { resetNavOrder } from '../storage/navOrder'
import {
  getSessionSyncPassphrase,
  hasRememberedSyncPassphrase,
  setSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'
import {
  clearPendingAutoSyncConflicts,
  getAutoSyncStatus,
  getPendingAutoSyncConflicts,
  subscribeAutoSync,
  syncNow,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'

const TRADE_TEMPLATES = [
  { symbol: 'TSLA', kind: 'equity' as const, href: 'data/templates/trades-TSLA.csv' },
  { symbol: 'MSTR', kind: 'equity' as const, href: 'data/templates/trades-MSTR.csv' },
  { symbol: 'BTC', kind: 'crypto' as const, href: 'data/templates/trades-BTC.csv' },
]

/** Illustrative broker exports for Import history header detection. */
const BROKER_SAMPLE_TEMPLATES = [
  {
    label: 'IBKR sample (TSLA)',
    href: 'data/templates/broker-ibkr-TSLA.csv',
    download: 'broker-ibkr-TSLA.csv',
  },
  {
    label: 'IBKR Flex aliases (TSLA)',
    href: 'data/templates/broker-ibkr-flex-TSLA.csv',
    download: 'broker-ibkr-flex-TSLA.csv',
  },
  {
    label: 'Trading 212 sample (TSLA)',
    href: 'data/templates/broker-trading212-TSLA.csv',
    download: 'broker-trading212-TSLA.csv',
  },
  {
    label: 'Coinbase sample (BTC)',
    href: 'data/templates/broker-coinbase-BTC.csv',
    download: 'broker-coinbase-BTC.csv',
  },
]

/** Stable Settings accordion ids — used for expand/collapse-all + deep links. */
const SETTINGS_SECTION_IDS = [
  'sync',
  'appearance',
  'layout',
  'fcc',
  'display',
  'trade-history',
  'price-history',
  'security',
  'alerts',
  'income',
  'prices',
  'devices',
  'account',
  'open-banking',
  'portfolios',
  'full-backup',
  'export',
  'reports',
  'versions',
  'danger',
] as const

const SETTINGS_SECTION_SEARCH: Record<(typeof SETTINGS_SECTION_IDS)[number], string> = {
  sync: 'Encrypted cloud sync passphrase remote url push pull',
  appearance: 'Light dark glass mode theme',
  layout: 'On launch favourites sidebar bottom nav',
  fcc: 'Sample FCC portfolio',
  display: 'Currency tax residency privacy',
  'trade-history': 'Broker CSV IBKR Trading 212 Coinbase trades',
  'price-history': 'Holding price history import',
  security: 'PIN Face ID lock',
  alerts: 'Notifications quiet hours price alerts desktop sound',
  income: 'Income honesty',
  prices: 'Price refresh providers',
  devices: 'Devices sync activity log',
  account: 'Cloud account OAuth identity',
  'open-banking': 'Open banking PSD2 bank feed',
  portfolios: 'Create rename delete portfolios',
  'full-backup': 'Encrypted full backup download restore',
  export: 'Export data CSV JSON',
  reports: 'PDF financial report',
  versions: 'App version changelog',
  danger: 'Reset clear all data danger zone',
}

const TAX_RESIDENCIES = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'TH', label: 'Thailand' },
  { code: 'IE', label: 'Ireland' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'SG', label: 'Singapore' },
  { code: 'XX', label: 'Other' },
]

export function SettingsPage() {
  const {
    data,
    portfolios,
    activeId,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    switchPortfolio,
    resetToSample,
    clearAll,
    importJson,
    exportJson,
    fccDataPresent,
    reload,
    setData,
    setCurrency,
    canAddPortfolio,
    maxPortfolios,
    fxRates,
  } = usePortfolio()
  const { refreshSecurity, lock, pinEnabled } = useSecurity()
  const { theme, preference, setPreference } = useTheme()
  const { glass, setGlass } = useGlass()

  const fileRef = useRef<HTMLInputElement>(null)
  const priceFileRef = useRef<HTMLInputElement>(null)
  const fullBackupFileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [portfolioNameError, setPortfolioNameError] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [backups, setBackups] = useState<FullBackupMeta[]>([])
  const [backupBusy, setBackupBusy] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [backfillKind, setBackfillKind] = useState<'crypto' | 'equity'>('equity')
  const [backfillSymbol, setBackfillSymbol] = useState('TSLA')
  const [backfillFrom, setBackfillFrom] = useState('2020-01-01')
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [queue, setQueue] = useState<OfflineJob[]>(() => loadOfflineQueue())
  const [sec, setSec] = useState<SecurityState>(() => loadSecurity())
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    notificationManager.getSettings(),
  )
  const [syncCfg, setSyncCfg] = useState(loadSyncConfig)
  const [syncPass, setSyncPass] = useState(() => getSessionSyncPassphrase() ?? '')
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const syncFileRef = useRef<HTMLInputElement>(null)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [conflictChoices, setConflictChoices] = useState<Record<string, ConflictChoice>>({})
  const [pendingMerge, setPendingMerge] = useState<MergePreview | null>(null)
  const [launchPath, setLaunchPath] = useState(() => loadLaunchPath())
  const [priceThresholds, setPriceThresholds] = useState<PriceAlertThreshold[]>(() =>
    loadPriceAlertThresholds(),
  )
  const [syncActivity, setSyncActivity] = useState<SyncActivityEntry[]>(() => loadSyncActivity())
  const [quoteHealthHint, setQuoteHealthHint] = useState<string | null>(() =>
    formatMarketsProviderHealthHint(),
  )
  const [quoteHealthOk, setQuoteHealthOk] = useState(() =>
    getMarketsProviderHealth().every((p) => p.consecutiveFailures === 0),
  )
  const [settingsQuery, setSettingsQuery] = useState('')
  const [cloudEmail, setCloudEmail] = useState(() => {
    try {
      return localStorage.getItem('mydsp_cloud_email') ?? ''
    } catch {
      return ''
    }
  })
  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmLabel?: string
    variant?: 'default' | 'danger'
    holdMs?: number
    onConfirm: () => void
  } | null>(null)
  const [showSyncPass, setShowSyncPass] = useState(false)

  useEffect(() => subscribeAutoSync(setAutoSyncStatus), [])

  useEffect(() => {
    const refresh = () => setSyncActivity(loadSyncActivity())
    window.addEventListener('mydsp-sync-activity', refresh)
    return () => window.removeEventListener('mydsp-sync-activity', refresh)
  }, [])

  useEffect(() => {
    const refresh = () => {
      setQuoteHealthHint(formatMarketsProviderHealthHint())
      setQuoteHealthOk(getMarketsProviderHealth().every((p) => p.consecutiveFailures === 0))
    }
    refresh()
    window.addEventListener('mydsp-markets-quotes', refresh)
    const id = window.setInterval(refresh, 30_000)
    return () => {
      window.removeEventListener('mydsp-markets-quotes', refresh)
      window.clearInterval(id)
    }
  }, [])

  /** Hydrate parked auto-sync conflicts into the manual review UI. */
  const hydrateAutoSyncConflicts = () => {
    const preview = getPendingAutoSyncConflicts()
    if (!preview || preview.conflicts.length === 0) return false
    setPendingMerge(preview)
    setConflicts(preview.conflicts)
    setConflictChoices({})
    flash(
      `Review ${preview.conflicts.length} auto-sync conflict(s) — pick Keep local/remote, then Apply merge.`,
    )
    openSettingsSection('sync')
    return true
  }

  useEffect(() => {
    if (autoSyncStatus.state === 'conflict') {
      hydrateAutoSyncConflicts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate only when status flips to conflict
  }, [autoSyncStatus.state])

  useEffect(() => {
    const onConflicts = () => {
      hydrateAutoSyncConflicts()
    }
    window.addEventListener('mydsp-sync-conflicts', onConflicts)
    // Catch conflicts parked before Settings mounted
    hydrateAutoSyncConflicts()
    return () => window.removeEventListener('mydsp-sync-conflicts', onConflicts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const location = useLocation()
  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace(/^#/, '')
    if (!id) return
    openSettingsSection(id)
    const scroll = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const t = window.setTimeout(scroll, 120)
    return () => window.clearTimeout(t)
  }, [location.hash, location.pathname])

  const refreshBackupList = () => {
    void listFullBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
  }

  useEffect(() => {
    refreshBackupList()
  }, [])

  useEffect(() => notificationManager.subscribeSettings(setNotifSettings), [])

  const flash = (msg: string) => {
    setMessage(msg)
    window.setTimeout(() => setMessage(null), 5000)
  }

  const persistSecurity = (next: SecurityState) => {
    saveSecurity(next)
    setSec(next)
    refreshSecurity()
  }

  const onExportCsv = () => {
    const header = 'date,description,category,method,amount,tripId,paidBy,split\n'
    const body = data.spending
      .map((s) =>
        [
          s.date,
          `"${s.description.replace(/"/g, '""')}"`,
          s.category,
          s.method,
          s.amount,
          s.tripId ?? '',
          s.paidBy ?? '',
          s.split ?? '',
        ].join(','),
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mydsp-spending-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    flash('Spending CSV downloaded.')
  }

  const onExport = () => {
    const payload = exportJson()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mydsp-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup downloaded.')
  }

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      importJson(raw)
      flash('Import successful — portfolio updated.')
    } catch {
      flash('Import failed — check the JSON file.')
    }
  }

  const onImportFccLive = () => {
    try {
      const raw = localStorage.getItem(STORAGE.DATA)
      if (!raw) {
        flash('No dfc_data_v3 found in this browser.')
        return
      }
      importJson(JSON.parse(raw))
      flash('Imported live FCC data from this browser.')
    } catch {
      flash('Could not read FCC data.')
    }
  }

  const persistPricePoints = (
    kind: 'crypto' | 'equity',
    symbol: string,
    points: HoldingPricePoint[],
  ) => {
    const key = holdingHistoryKey(kind, symbol)
    setData((prev) => {
      const map = readHoldingHistory(prev)
      map[key] = points.sort((a, b) => a.date.localeCompare(b.date))
      return { ...prev, extras: { ...prev.extras, holdingHistory: map } }
    })
    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify({ symbol, series: points.map((p) => [p.date, p.price]) })], {
        type: 'application/json',
      }),
    )
    registerStaticPriceFile(kind, symbol, blobUrl)
  }

  const onImportPriceHistory = async (file: File) => {
    const symbol = backfillSymbol.trim().toUpperCase()
    if (!symbol) {
      flash('Enter a symbol first.')
      return
    }
    try {
      const text = await file.text()
      const json = JSON.parse(text) as {
        series?: [string, number][]
        symbol?: string
      }
      const series = json.series
      if (!Array.isArray(series) || series.length === 0) {
        flash('JSON needs a non-empty series: [["YYYY-MM-DD", price], ...]')
        return
      }
      const points: HoldingPricePoint[] = series
        .filter((row) => Array.isArray(row) && typeof row[0] === 'string' && Number(row[1]) > 0)
        .map(([date, price]) => ({
          date: String(date).slice(0, 10),
          price: Number(price),
          source: 'manual' as const,
        }))
      if (points.length === 0) {
        flash('No valid price rows found.')
        return
      }
      persistPricePoints(backfillKind, symbol, points)
      flash(`Imported ${points.length} daily prices for ${symbol}.`)
    } catch {
      flash('Could not parse price JSON.')
    }
  }

  const onFetchYahoo = async () => {
    const symbol = backfillSymbol.trim().toUpperCase()
    if (!symbol) {
      flash('Enter a symbol first.')
      return
    }
    setBackfillBusy(true)
    try {
      const { points, currency, yahooSymbol } = await fetchSymbolHistory(
        backfillKind,
        symbol,
        backfillFrom || '2015-01-01',
      )
      if (points.length === 0) {
        flash(`No Yahoo data for ${yahooSymbol}. Try another symbol or from-date.`)
        return
      }
      persistPricePoints(
        backfillKind,
        symbol,
        points.map((p) => ({ date: p.date, price: p.price, source: 'manual' as const })),
      )
      flash(`Fetched ${points.length} ${currency} closes for ${symbol} (${yahooSymbol}).`)
    } catch {
      flash('Yahoo fetch failed — check network or try again.')
    } finally {
      setBackfillBusy(false)
    }
  }

  const testSyncEndpoint = async () => {
    if (!syncCfg.remoteUrl) {
      flash('Enter a remote URL first.')
      return
    }
    const warn = getSyncRemoteUrlWarning(syncCfg.remoteUrl)
    if (warn) {
      flash(warn)
      return
    }
    try {
      const t0 = performance.now()
      const res = await fetch(syncCfg.remoteUrl, { method: 'GET' })
      const ms = Math.round(performance.now() - t0)
      if (res.status === 404) {
        flash(`Endpoint OK (${ms}ms) — empty store (404). Push from a device with data next.`)
        return
      }
      if (res.status === 401) {
        flash('Unauthorized (401) — check SYNC_KEY matches ?key= in the URL.')
        return
      }
      if (res.ok) {
        flash(`Endpoint ready (${res.status}) in ${ms}ms — you can Pull & merge.`)
        return
      }
      flash(`Endpoint ${res.status} in ${ms}ms — check Worker deploy / CORS / auth.`)
    } catch {
      flash('Endpoint unreachable (offline, wrong URL, or CORS).')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings & data"
        description="Sections start collapsed — tap a header (Sync, Display, Security…) to expand. Cloud Sync is first."
      />

      <div
        className="settings-search-sticky sticky z-20 -mx-1 px-1 py-2 mb-4 flex flex-wrap gap-2 items-center bg-bg/95 backdrop-blur-sm border-b border-border/60"
        style={{ top: 'var(--app-header-offset, 3.5rem)' }}
        role="group"
        aria-label="Settings sections"
      >
        <label className="sr-only" htmlFor="settings-search">
          Search settings
        </label>
        <input
          id="settings-search"
          type="search"
          className="toolbar-select flex-1 min-w-[12rem] max-w-md !w-auto px-3 py-2 text-sm min-h-11"
          placeholder="Search settings…"
          value={settingsQuery}
          onChange={(e) => {
            const q = e.target.value
            setSettingsQuery(q)
            const needle = q.trim().toLowerCase()
            if (needle.length < 2) return
            const hit = SETTINGS_SECTION_IDS.find((id) => {
              const hay = `${id} ${SETTINGS_SECTION_SEARCH[id]}`.toLowerCase()
              return hay.includes(needle)
            })
            if (!hit) return
            openSettingsSection(hit)
            requestAnimationFrame(() => {
              document.getElementById(hit)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            })
          }}
          autoComplete="off"
        />
        <button
          type="button"
          className="btn-secondary btn-sm min-h-11"
          onClick={() => setAllSettingsSectionsOpen([...SETTINGS_SECTION_IDS], true)}
        >
          Expand all
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm min-h-11"
          onClick={() => setAllSettingsSectionsOpen([...SETTINGS_SECTION_IDS], false)}
        >
          Collapse all
        </button>
      </div>

      {message && (
        <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6" role="status">
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-px">
        <SettingsSection id="sync" eyebrow="Sync" title="Encrypted cloud sync">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            On iPhone / iPad: pull down on any screen to sync across devices. Same Remote URL +
            passphrase on Mac, iPhone, and iPad. Turn on{' '}
            <span className="text-text font-medium">Automatic sync</span> and{' '}
            <span className="text-text font-medium">Remember passphrase</span> so sync works after
            you close the tab. Sync is encrypted batch sync (not live WebSockets): expect ~8s after
            an edit to push, and a pull when you open/focus the app, pull-to-refresh, or about once
            a minute while it stays open.
          </p>
          <div
            className={`quote-worker-health mb-4 inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border max-w-2xl ${
              quoteHealthHint
                ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
                : quoteHealthOk
                  ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-border text-text-muted'
            }`}
            role="status"
            aria-label="Quote Worker health"
          >
            <span
              className={`w-1.5 h-1.5 shrink-0 rounded-full ${
                quoteHealthHint ? 'bg-amber-500' : quoteHealthOk ? 'bg-emerald-500' : 'bg-text-subtle'
              }`}
              aria-hidden
            />
            <span className="font-semibold tracking-wide uppercase text-[10px] opacity-80">
              Quote Worker
            </span>
            <span className="font-light">
              {quoteHealthHint ?? (quoteHealthOk ? 'Healthy · markets feeds OK' : 'No recent feed checks')}
            </span>
          </div>
          <div className="border border-border p-4 mb-6 max-w-2xl space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle mb-3">
                First-time Cloudflare setup
              </p>
              <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5">
                <li>
                  Workers &amp; Pages → open existing <code className="text-accent">mydsp-sync</code>{' '}
                  (or <span className="text-text font-medium">Create application</span> → Worker)
                </li>
                <li>
                  Bind KV as variable name <code className="text-accent">STORE</code> (exact)
                </li>
                <li>
                  Paste <code className="text-accent">sync-endpoint/worker.js</code> → Deploy
                </li>
                <li>
                  (Recommended) Add secret <code className="text-accent">SYNC_KEY</code>, then use
                  URL with <code className="text-accent">?key=…</code>
                </li>
              </ol>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle mb-3">
                Connect this device (once)
              </p>
              <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5">
                <li>Paste Remote URL + enter passphrase (min 8 characters)</li>
                <li>
                  Turn on <span className="text-text font-medium">Automatic sync</span> and{' '}
                  <span className="text-text font-medium">Remember passphrase</span>
                </li>
                <li>
                  First device: <span className="text-text font-medium">Push</span> (or Sync now).
                  Other devices: open the app — they pull automatically
                </li>
              </ol>
            </div>
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Remote URL
          </label>
          <div className="flex flex-wrap gap-2 mb-4 max-w-4xl items-stretch">
            <input
              type="url"
              className="flex-1 min-w-[12rem] min-h-12 text-sm break-all"
              placeholder="https://mydsp-sync.YOUR_SUBDOMAIN.workers.dev?key=YOUR_SECRET"
              value={syncCfg.remoteUrl}
              onChange={(e) => {
                const next = { ...syncCfg, remoteUrl: e.target.value }
                setSyncCfg(next)
                saveSyncConfig(next)
              }}
              onBlur={() => {
                const normalized = normalizeSyncRemoteUrl(syncCfg.remoteUrl)
                if (normalized === syncCfg.remoteUrl) return
                const next = { ...syncCfg, remoteUrl: normalized }
                setSyncCfg(next)
                saveSyncConfig(next)
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              title={syncCfg.remoteUrl || undefined}
            />
            <button
              type="button"
              className="btn-secondary btn-sm min-h-12 shrink-0"
              onClick={() => {
                void (async () => {
                  try {
                    const text = await navigator.clipboard.readText()
                    const normalized = normalizeSyncRemoteUrl(text.trim())
                    const next = { ...syncCfg, remoteUrl: normalized }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    flash('Pasted Remote URL from clipboard.')
                  } catch {
                    flash('Could not read clipboard — paste manually.')
                  }
                })()
              }}
            >
              Paste
            </button>
          </div>
          {syncCfg.remoteUrl ? (
            <p className="text-xs text-text-subtle mb-2 -mt-2 max-w-4xl break-all font-mono">
              {syncCfg.remoteUrl}
            </p>
          ) : null}
          {getSyncRemoteUrlWarning(syncCfg.remoteUrl) ? (
            <p className="text-sm text-accent mb-4 max-w-4xl" role="alert">
              {getSyncRemoteUrlWarning(syncCfg.remoteUrl)}
            </p>
          ) : null}
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Passphrase
          </label>
          <div className="flex flex-wrap gap-2 mb-3 max-w-md items-stretch">
            <input
              type={showSyncPass ? 'text' : 'password'}
              className="flex-1 min-h-11"
              autoComplete="new-password"
              placeholder="Sync passphrase (min 8 chars)"
              value={syncPass}
              onChange={(e) => {
                const v = e.target.value
                setSyncPass(v)
                setSessionSyncPassphrase(v, { remember: Boolean(syncCfg.rememberPassphrase) })
              }}
            />
            <button
              type="button"
              className="btn-ghost btn-sm min-h-11 shrink-0"
              aria-pressed={showSyncPass}
              onClick={() => setShowSyncPass((v) => !v)}
            >
              {showSyncPass ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex flex-col gap-3 mb-6 max-w-2xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(syncCfg.enabled)}
                onChange={(e) => {
                  const on = e.target.checked
                  if (on) {
                    if (!syncCfg.remoteUrl.trim()) {
                      flash('Set Remote URL before enabling automatic sync.')
                      return
                    }
                    if (!syncPass || syncPass.length < 8) {
                      flash('Enter a passphrase (min 8 chars) before enabling automatic sync.')
                      return
                    }
                    setSessionSyncPassphrase(syncPass, {
                      remember: Boolean(syncCfg.rememberPassphrase),
                    })
                  }
                  const next = { ...syncCfg, enabled: on }
                  setSyncCfg(next)
                  saveSyncConfig(next)
                  if (on) {
                    void syncNow().then(() => {
                      setSyncCfg(loadSyncConfig())
                      flash('Automatic sync on — devices will stay in sync.')
                    })
                  } else {
                    flash('Automatic sync off — use Push / Pull manually.')
                  }
                }}
              />
              <span>
                <span className="text-sm font-medium text-text">Automatic sync</span>
                <span className="block text-xs text-text-muted font-light mt-0.5">
                  Pull when you open the app, return to the tab, or about every minute while open;
                  push ~8s after you edit (pulls first if another device updated cloud). No iCloud
                  needed — uses your Cloudflare Worker.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(syncCfg.rememberPassphrase) || hasRememberedSyncPassphrase()}
                onChange={(e) => {
                  const remember = e.target.checked
                  const next = { ...syncCfg, rememberPassphrase: remember }
                  setSyncCfg(next)
                  saveSyncConfig(next)
                  if (syncPass) {
                    setSessionSyncPassphrase(syncPass, { remember })
                  } else if (!remember) {
                    setSessionSyncPassphrase('', { remember: false })
                  }
                  flash(
                    remember
                      ? 'Passphrase saved on this device for automatic sync.'
                      : 'Passphrase cleared from this device.',
                  )
                }}
              />
              <span>
                <span className="text-sm font-medium text-text">Remember passphrase on this device</span>
                <span className="block text-xs text-text-muted font-light mt-0.5">
                  Required so sync continues after you close the tab. Stored only in this browser —
                  turn off on shared computers.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={syncCfg.autoResolveConflicts !== false}
                onChange={(e) => {
                  const next = { ...syncCfg, autoResolveConflicts: e.target.checked }
                  setSyncCfg(next)
                  saveSyncConfig(next)
                }}
              />
              <span>
                <span className="text-sm font-medium text-text">
                  Auto-resolve conflicts (prefer cloud)
                </span>
                <span className="block text-xs text-text-muted font-light mt-0.5">
                  If the same item was edited on two devices, keep the cloud version on pull. Turn off
                  to review conflicts manually.
                </span>
              </span>
            </label>
          </div>
          {(syncCfg.enabled || autoSyncStatus.state !== 'disabled') && (
            <p className="text-xs text-text-subtle mb-4" role="status">
              Auto-sync status:{' '}
              <span className="text-text">
                {autoSyncStatus.state}
                {autoSyncStatus.message ? ` — ${autoSyncStatus.message}` : ''}
              </span>
            </p>
          )}
          {autoSyncStatus.state === 'conflict' ||
          (pendingMerge && pendingMerge.conflicts.length > 0) ? (
            <div
              className="mb-4 border border-accent/40 bg-accent/5 px-4 py-3 text-sm"
              role="alert"
            >
              <p className="font-semibold text-text mb-1">
                {pendingMerge?.conflicts.length ?? autoSyncStatus.pendingConflicts ?? 0} sync
                conflict{(pendingMerge?.conflicts.length ?? 0) === 1 ? '' : 's'} need review
              </p>
              <p className="text-text-muted font-light text-xs mb-2">
                The same item changed on two devices. Choose Keep local or Keep remote for each row
                below, then Apply merge.
              </p>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  if (!hydrateAutoSyncConflicts()) {
                    document.getElementById('sync-conflicts-panel')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                }}
              >
                Jump to conflicts
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void (async () => {
                  if (!syncPass || syncPass.length < 8) {
                    flash('Use a passphrase of at least 8 characters.')
                    return
                  }
                  if (!syncCfg.remoteUrl) {
                    flash('Set a remote URL first (or use encrypted file download).')
                    return
                  }
                  setSessionSyncPassphrase(syncPass, {
                    remember: Boolean(syncCfg.rememberPassphrase),
                  })
                  if (!isOnline()) {
                    enqueueOfflineJob('sync_push', {
                      remoteUrl: syncCfg.remoteUrl,
                      note: 'Will push when online using session passphrase',
                    })
                    setQueue(loadOfflineQueue())
                    flash('Offline — push queued. Come online and press Flush queue.')
                    return
                  }
                  try {
                    await pushSync(syncCfg.remoteUrl, syncPass)
                    const next = {
                      ...syncCfg,
                      enabled: true,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                    }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    flash('Encrypted backup pushed.')
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Push failed'
                    const next = { ...syncCfg, lastSyncError: msg }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    if (!isOnline()) {
                      enqueueOfflineJob('sync_push', { remoteUrl: syncCfg.remoteUrl, note: msg })
                      setQueue(loadOfflineQueue())
                    }
                    flash(msg)
                  }
                })()
              }}
            >
              Push
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void (async () => {
                  if (!syncPass || !syncCfg.remoteUrl) {
                    flash('Need remote URL and passphrase.')
                    return
                  }
                  try {
                    const preview = await previewPull(syncCfg.remoteUrl, syncPass)
                    setPendingMerge(preview)
                    setConflicts(preview.conflicts)
                    if (preview.conflicts.length > 0) {
                      flash(
                        `Review ${preview.conflicts.length} conflict(s) — pick Keep local/remote, then Apply merge.`,
                      )
                    } else {
                      const r = await applyMergePreview(preview, {})
                      reload()
                      setPendingMerge(null)
                      setConflictChoices({})
                      setConflicts([])
                      const next = {
                        ...syncCfg,
                        lastSyncAt: new Date().toISOString(),
                        lastSyncError: undefined,
                        lastMergeCount: r.merged,
                      }
                      setSyncCfg(next)
                      saveSyncConfig(next)
                      const blobNote =
                        preview.documentBlobs && preview.documentBlobs.length > 0
                          ? ` · ${preview.documentBlobs.length} file(s)`
                          : ''
                      const cleaned =
                        r.removedDupes > 0 || preview.remoteHadDuplicateNames
                          ? ' · cleaned duplicate names'
                          : ''
                      flash(`Pulled & merged ${r.merged} portfolios${blobNote}${cleaned}.`)
                      if (r.removedDupes > 0 || preview.remoteHadDuplicateNames) {
                        void syncNow().catch(() => {
                          /* local already cleaned */
                        })
                      }
                    }
                  } catch (e) {
                    flash(e instanceof Error ? e.message : 'Pull failed')
                  }
                })()
              }}
            >
              Pull & merge
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void (async () => {
                  if (!syncPass || syncPass.length < 8) {
                    flash('Enter passphrase first.')
                    return
                  }
                  if (!syncCfg.remoteUrl) {
                    flash('Set Remote URL first.')
                    return
                  }
                  setSessionSyncPassphrase(syncPass, {
                    remember: Boolean(syncCfg.rememberPassphrase),
                  })
                  const next = { ...syncCfg, enabled: true }
                  setSyncCfg(next)
                  saveSyncConfig(next)
                  await syncNow()
                  setSyncCfg(loadSyncConfig())
                  reload()
                  flash('Sync now finished.')
                })()
              }}
            >
              Sync now
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={
                !pendingMerge ||
                (pendingMerge.conflicts.length > 0 &&
                  !allConflictsResolved(pendingMerge.conflicts, conflictChoices))
              }
              onClick={() => {
                void (async () => {
                  if (!pendingMerge) return
                  if (
                    pendingMerge.conflicts.length > 0 &&
                    !allConflictsResolved(pendingMerge.conflicts, conflictChoices)
                  ) {
                    flash('Resolve every conflict before applying.')
                    return
                  }
                  try {
                    const r = await applyMergePreview(pendingMerge, conflictChoices)
                    reload()
                    setPendingMerge(null)
                    setConflicts([])
                    setConflictChoices({})
                    clearPendingAutoSyncConflicts()
                    const next = {
                      ...syncCfg,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                      lastMergeCount: r.merged,
                    }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    flash(`Applied merge · ${r.merged} portfolios.`)
                    if (r.removedDupes > 0 || pendingMerge.remoteHadDuplicateNames) {
                      void syncNow().catch(() => {
                        /* local already cleaned */
                      })
                    }
                  } catch (e) {
                    flash(e instanceof Error ? e.message : 'Apply failed')
                  }
                })()
              }}
            >
              Apply merge
            </button>
            <button type="button" className="btn-ghost" onClick={() => void testSyncEndpoint()}>
              Test endpoint
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                void (async () => {
                  if (!syncPass || syncPass.length < 8) {
                    flash('Use a passphrase of at least 8 characters.')
                    return
                  }
                  await downloadEncryptedBackup(syncPass)
                  flash('Encrypted sync file downloaded.')
                })()
              }}
            >
              Download .enc.json
            </button>
            <button type="button" className="btn-ghost" onClick={() => syncFileRef.current?.click()}>
              Import .enc.json
            </button>
            <input
              ref={syncFileRef}
              type="file"
              accept=".json,.enc.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                void (async () => {
                  if (!syncPass) {
                    flash('Enter passphrase first.')
                    return
                  }
                  try {
                    const preview = await previewImport(f, syncPass)
                    setPendingMerge(preview)
                    setConflicts(preview.conflicts)
                    if (preview.conflicts.length > 0) {
                      flash(
                        `Review ${preview.conflicts.length} conflict(s) — pick Keep local/remote, then Apply merge.`,
                      )
                    } else {
                      const r = await applyMergePreview(preview, {})
                      reload()
                      setPendingMerge(null)
                      setConflictChoices({})
                      setConflicts([])
                      const next = {
                        ...syncCfg,
                        lastMergeCount: r.merged,
                        lastSyncAt: new Date().toISOString(),
                        lastSyncError: undefined,
                      }
                      setSyncCfg(next)
                      saveSyncConfig(next)
                      flash(`Imported & merged ${r.merged} portfolios.`)
                    }
                  } catch (err) {
                    flash(err instanceof Error ? err.message : 'Import failed')
                  }
                })()
              }}
            />
          </div>
          {pendingMerge && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
              Pending {pendingMerge.source} review
              {pendingMerge.conflicts.length > 0
                ? ` · ${pendingMerge.conflicts.length} conflict(s) to resolve`
                : ' · ready to apply'}
              {pendingMerge.documentBlobs && pendingMerge.documentBlobs.length > 0
                ? ` · ${pendingMerge.documentBlobs.length} attachment(s)`
                : ''}
              {' · '}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setPendingMerge(null)
                  setConflicts([])
                  setConflictChoices({})
                  clearPendingAutoSyncConflicts()
                }}
              >
                Discard
              </button>
            </p>
          )}
          {syncCfg.lastSyncAt && (
            <p className="text-xs text-text-subtle mb-2">
              Last sync {new Date(syncCfg.lastSyncAt).toLocaleString('en-GB')}
              {syncCfg.lastSyncError ? ` · ${syncCfg.lastSyncError}` : ''}
            </p>
          )}
          {syncCfg.lastMergeCount != null && (
            <p className="text-xs text-text-subtle">
              Last pull summary: merged {syncCfg.lastMergeCount} portfolio
              {syncCfg.lastMergeCount === 1 ? '' : 's'}
            </p>
          )}
          {syncActivity.length > 0 && (
            <div className="mt-4 max-w-2xl border border-border/60 p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle">
                Recent sync activity
              </p>
              <ul className="space-y-1.5">
                {syncActivity.slice(0, 8).map((e) => (
                  <li key={e.id} className="text-xs text-text-muted font-light">
                    <span className="text-text-subtle tabular-nums">
                      {new Date(e.at).toLocaleString('en-GB')}
                    </span>
                    {' · '}
                    <span className="uppercase tracking-wider text-[10px] font-bold text-text-subtle">
                      {e.source}
                    </span>
                    {' · '}
                    {e.message}
                    {e.conflicts ? ` · ${e.conflicts} conflict(s)` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {queue.length > 0 && (
            <div className="border border-border p-4 mt-6 max-w-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle">
                  Offline queue · {queue.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      void (async () => {
                        if (!isOnline()) {
                          flash('Still offline.')
                          return
                        }
                        let flushed = 0
                        let failed = false
                        let quotesSkipped = 0
                        for (const job of loadOfflineQueue()) {
                          if (job.type === 'quote_refresh') {
                            // Quote refresh is handled on reconnect by PortfolioContext;
                            // drop stale queue entries rather than pretending we refreshed.
                            removeOfflineJob(job.id)
                            quotesSkipped++
                            continue
                          }
                          if (job.type === 'sync_push' && job.remoteUrl) {
                            const pass = syncPass || getSessionSyncPassphrase() || ''
                            if (!pass || pass.length < 8) {
                              flash('Enter passphrase once this session, then flush.')
                              failed = true
                              break
                            }
                            try {
                              await pushSync(job.remoteUrl, pass)
                              removeOfflineJob(job.id)
                              flushed++
                            } catch (e) {
                              flash(e instanceof Error ? e.message : 'Flush failed')
                              failed = true
                              break
                            }
                          }
                        }
                        setQueue(loadOfflineQueue())
                        if (!failed) {
                          const bits = [`Flushed ${flushed} sync job(s)`]
                          if (quotesSkipped) bits.push(`cleared ${quotesSkipped} quote job(s) (auto-refresh on reconnect)`)
                          flash(bits.join(' · ') + '.')
                        }
                      })()
                    }}
                  >
                    Flush queue
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      clearOfflineQueue()
                      setQueue([])
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="text-sm text-text-muted space-y-1">
                {queue.map((j) => (
                  <li key={j.id}>
                    {j.type.replace('_', ' ')} · {new Date(j.createdAt).toLocaleString('en-GB')}
                    {j.note ? ` — ${j.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conflicts.length > 0 && (
            <div id="sync-conflicts-panel" className="mt-6 border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Sync conflicts</p>
              <p className="text-xs text-text-muted font-light">
                {summarizeConflictBatch(conflicts)} Nothing has been written yet — pick Keep local
                or Keep remote for each row, then Apply merge.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    const next: Record<string, ConflictChoice> = { ...conflictChoices }
                    for (const c of conflicts) next[conflictKey(c)] = 'local'
                    setConflictChoices(next)
                  }}
                >
                  Keep all local
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    const next: Record<string, ConflictChoice> = { ...conflictChoices }
                    for (const c of conflicts) next[conflictKey(c)] = 'remote'
                    setConflictChoices(next)
                  }}
                >
                  Keep all remote (newest from other device)
                </button>
              </div>
              {conflicts.map((c) => {
                const key = conflictKey(c)
                return (
                  <div
                    key={`${c.portfolioId}-${key}`}
                    className="text-sm border border-border/60 rounded-lg p-3 space-y-2"
                  >
                    <p className="text-xs text-text-muted font-light">{summarizeConflict(c)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="uppercase text-[11px] tracking-widest text-text-subtle font-bold">
                        {c.collection}
                      </span>
                      <span className="text-[11px] text-text-subtle">{c.portfolioId}</span>
                      <span className="font-medium">{c.localLabel}</span>
                      <span className="text-text-subtle">vs</span>
                      <span className="text-text-muted">{c.remoteLabel}</span>
                      <div className="flex gap-1 ml-auto">
                        <button
                          type="button"
                          className={`btn-sm ${conflictChoices[key] === 'local' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() =>
                            setConflictChoices((prev) => ({ ...prev, [key]: 'local' }))
                          }
                        >
                          Keep local
                        </button>
                        <button
                          type="button"
                          className={`btn-sm ${conflictChoices[key] === 'remote' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() =>
                            setConflictChoices((prev) => ({ ...prev, [key]: 'remote' }))
                          }
                        >
                          Keep remote
                        </button>
                      </div>
                    </div>
                    {c.fieldDiffs && c.fieldDiffs.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="text-text-subtle">
                              <th className="py-1 pr-3 font-semibold">Field</th>
                              <th className="py-1 pr-3 font-semibold">Local</th>
                              <th className="py-1 font-semibold">Remote</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.fieldDiffs.map((d) => (
                              <tr key={d.field} className="border-t border-border/40 align-top">
                                <td className="py-1 pr-3 font-mono text-text-subtle">{d.field}</td>
                                <td className="py-1 pr-3 text-text-muted max-w-[12rem] break-words">{d.local}</td>
                                <td className="py-1 text-text-muted max-w-[12rem] break-words">{d.remote}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SettingsSection>


        <SettingsSection id="appearance" eyebrow="Appearance" title="Light, dark & glass">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            <span className="text-text font-medium">Auto</span> follows your computer clock —
            light after approximate sunrise, dark after sunset (local time). Choose Light or Dark
            to lock a theme. Header moon toggle also locks Light/Dark.
          </p>
          <div
            className="appearance-preview mb-6 grid grid-cols-3 gap-2 max-w-lg"
            aria-hidden
          >
            <div className={`rounded-lg border border-border p-3 ${theme === 'light' && preference !== 'auto' ? 'ring-2 ring-accent' : ''}`}>
              <div className="h-8 rounded bg-white border border-border mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">Light</p>
            </div>
            <div className={`rounded-lg border border-border p-3 ${theme === 'dark' && preference !== 'auto' ? 'ring-2 ring-accent' : ''}`}>
              <div className="h-8 rounded bg-black border border-border mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">Dark</p>
            </div>
            <div className={`rounded-lg border border-border p-3 ${glass ? 'ring-2 ring-accent' : ''}`}>
              <div className="h-8 rounded border border-border mb-2 bg-gradient-to-br from-white/40 to-black/30 backdrop-blur-sm" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">Glass</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Theme preference">
            {(
              [
                { id: 'auto' as const, label: 'Auto (day / night)' },
                { id: 'light' as const, label: 'Light' },
                { id: 'dark' as const, label: 'Dark' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={preference === opt.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                aria-pressed={preference === opt.id}
                onClick={() => {
                  setPreference(opt.id as ThemePreference)
                  flash(
                    opt.id === 'auto'
                      ? `Auto theme on — currently ${theme} mode for local daytime.`
                      : `${opt.label} mode locked.`,
                  )
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-subtle mb-6">
            Now showing: <span className="text-text font-medium uppercase">{theme}</span>
            {preference === 'auto' ? ' · Auto' : ' · Manual'}
          </p>

          <p className="text-sm text-text-muted font-light mb-3 max-w-2xl">
            <span className="text-text font-medium">Glass Mode</span> frosts panels with a soft
            blur (Apple-style liquid glass). Works with Light or Dark. Header glass icon toggles
            the same setting.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Glass Mode">
            <button
              type="button"
              className={glass ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={glass}
              onClick={() => {
                setGlass(true)
                flash('Glass Mode on.')
              }}
            >
              Glass On
            </button>
            <button
              type="button"
              className={!glass ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={!glass}
              onClick={() => {
                setGlass(false)
                flash('Glass Mode off.')
              }}
            >
              Glass Off
            </button>
          </div>
        </SettingsSection>

        <SettingsSection id="layout" eyebrow="Layout" title="Sidebar Favourites">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Open the menu and tap <span className="text-text font-medium">Sort</span> to show grab
            handles and ★ controls. Pin sections to Favourites (always on top); everything else
            lives in a collapsible Others list. Favourites order is saved with cloud sync and full
            backups so phone, tablet, and web stay aligned.
          </p>
          <label className="block mb-6 max-w-md">
            <span className="label-uppercase block mb-2">On launch</span>
            <select
              className="w-full"
              value={launchPath}
              onChange={(e) => {
                saveLaunchPath(e.target.value)
                setLaunchPath(e.target.value)
                flash(
                  e.target.value === DEFAULT_LAUNCH_PATH
                    ? 'Opens on Overview by default.'
                    : `Opens on ${LAUNCH_PATH_OPTIONS.find((o) => o.path === e.target.value)?.label ?? e.target.value} on launch.`,
                )
              }}
            >
              {LAUNCH_PATH_OPTIONS.map((o) => (
                <option key={o.path} value={o.path}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-subtle mt-2 block font-light">
              Default is Overview on web, tablet, and phone. Applies the next time you open MyDSP.
            </span>
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              resetNavOrder()
              flash('Sidebar Favourites reset to defaults.')
            }}
          >
            Reset sidebar Favourites
          </button>
        </SettingsSection>

        <SettingsSection id="fcc" eyebrow="FCC bridge" title="Import your Financial Command Centre data">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            MyDSP reads the same <code className="text-accent">dfc_data_v3</code> key FCC uses.
            {fccDataPresent
              ? ' Live FCC data was detected in this browser.'
              : ' No live FCC blob detected here — use a JSON backup export from FCC instead.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={onImportFccLive} disabled={!fccDataPresent}>
              Import live FCC data
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              Import JSON backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </SettingsSection>

        <SettingsSection id="display" eyebrow="Display" title="Currency & tax residency">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Stored per active portfolio. Amounts stay in GBP internally; display currency uses FX.
            Tax residency flags CGT / reporting context for this workspace.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            <label className="block">
              <span className="label-uppercase block mb-2">Display currency</span>
              <select
                value={data.settings.currency || 'GBP'}
                onChange={(e) => {
                  setCurrency(e.target.value)
                  flash(`Display currency set to ${e.target.value}.`)
                }}
              >
                {DISPLAY_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-uppercase block mb-2">Tax residency</span>
              <select
                value={data.settings.taxResidency || 'GB'}
                onChange={(e) => {
                  const code = e.target.value
                  setData((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, taxResidency: code },
                  }))
                  flash(`Tax residency set to ${code}.`)
                }}
              >
                {TAX_RESIDENCIES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label} ({t.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-text-muted mt-4 label-muted">
            Active portfolio: {portfolios.find((p) => p.id === activeId)?.name ?? activeId}
            {fxRates.USD
              ? ` · GBP/USD ${fxRates.USD.toFixed(4)} (1 GBP = ${fxRates.USD.toFixed(2)} USD)`
              : ''}
          </p>
        </SettingsSection>

        <SettingsSection id="trade-history" eyebrow="David · holdings" title="TSLA / MSTR / BTC trade history">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Download a CSV template, fill your dated buys/sells (GBP unit prices), then open the
            holding → <strong className="text-text">Import history</strong>. Pre-2014 BTC dates use
            the OTC overlay below. For positions without journal legs, use the{' '}
            <Link to="/setup/opening" className="text-accent hover:underline">
              opening-balance wizard
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            {TRADE_TEMPLATES.map((t) => (
              <a
                key={t.symbol}
                className="btn-secondary btn-sm"
                href={`${import.meta.env.BASE_URL}${t.href}`}
                download={`trades-${t.symbol}.csv`}
              >
                {t.symbol} template
              </a>
            ))}
            <Link to="/setup/opening" className="btn-ghost btn-sm">
              Opening wizard
            </Link>
            <Link to="/compare" className="btn-ghost btn-sm">
              Compare portfolios
            </Link>
          </div>
          <p className="text-xs text-text-muted font-light mb-2 max-w-2xl">
            Broker sample exports (illustrative — convert unit prices to GBP before saving for UK cost
            basis):
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            {BROKER_SAMPLE_TEMPLATES.map((t) => (
              <a
                key={t.download}
                className="btn-ghost btn-sm"
                href={`${import.meta.env.BASE_URL}${t.href}`}
                download={t.download}
              >
                {t.label}
              </a>
            ))}
          </div>
          <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5 max-w-2xl">
            <li>
              Switch header portfolio to <strong className="text-text">David</strong>
            </li>
            <li>Equities → TSLA / MSTR or Crypto → BTC → Import history</li>
            <li>
              Paste CSV (IBKR / Trading 212 / Coinbase headers auto-detected) or use multi-row entry
              in Import history; journal rebuilds cost basis
            </li>
          </ol>
        </SettingsSection>

        <SettingsSection id="price-history" eyebrow="Markets" title="Historical prices & OTC">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Bundled daily closes: <strong className="text-text">TSLA</strong> /{' '}
            <strong className="text-text">MSTR</strong> (USD→GBP via GBPUSD),{' '}
            <strong className="text-text">BTC</strong> (GBP). Live equity refreshes convert USD
            quotes to GBP with the daily FX rate. Upload a JSON series for any other symbol, or a
            pre-2014 BTC OTC overlay. Format:{' '}
            <code className="text-accent">{`{ "series": [["2013-01-01", 12.5], ...] }`}</code>
          </p>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Kind
              <select
                className="mt-2 block"
                value={backfillKind}
                onChange={(e) => setBackfillKind(e.target.value as 'crypto' | 'equity')}
              >
                <option value="crypto">Crypto</option>
                <option value="equity">Equity</option>
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Symbol
              <input
                className="mt-2 block uppercase"
                value={backfillSymbol}
                onChange={(e) => setBackfillSymbol(e.target.value.toUpperCase())}
                placeholder="ETH / AAPL"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              From
              <input
                type="date"
                className="mt-2 block"
                value={backfillFrom}
                onChange={(e) => setBackfillFrom(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={backfillBusy}
              onClick={() => void onFetchYahoo()}
            >
              {backfillBusy ? 'Fetching…' : 'Fetch from Yahoo'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => priceFileRef.current?.click()}
            >
              Upload price JSON
            </button>
            <input
              ref={priceFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportPriceHistory(f)
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-xs text-text-subtle font-light max-w-2xl">
            Pre-2014 BTC: upload OTC rows into{' '}
            <code className="text-accent">btc-gbp-otc.json</code> format via Upload, or place the
            file under <code className="text-accent">public/data/prices/</code>. HTTPS host: see{' '}
            <code className="text-accent">DEPLOY.md</code>.
          </p>
        </SettingsSection>

        <SettingsSection id="security" eyebrow="Security" title="PIN & biometrics">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Lock MyDSP with a 4-digit PIN. On iPhone and iPad (HTTPS / Add to Home Screen), unlock
            with {getBiometricLabel()} via WebAuthn. Security stays on this device and is not
            included in cloud backups.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-lg">
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              New PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="mt-2"
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Confirm
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="mt-2"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void (async () => {
                  if (pinDraft.length !== 4 || pinDraft !== pinConfirm) {
                    flash('Enter a matching 4-digit PIN.')
                    return
                  }
                  const pinHash = await hashPin(pinDraft)
                  persistSecurity({ ...sec, pinEnabled: true, pinHash })
                  setPinDraft('')
                  setPinConfirm('')
                  flash('PIN enabled — locking now.')
                  lock()
                })()
              }}
            >
              Enable / update PIN
            </button>
            {pinEnabled && (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    void (async () => {
                      const entered = window.prompt('Enter your current 4-digit PIN to disable lock:')
                      if (entered == null) return
                      const ok = await verifyPin(entered.trim(), sec.pinHash)
                      if (!ok) {
                        flash('Incorrect PIN — lock not disabled.')
                        return
                      }
                      persistSecurity({
                        ...sec,
                        pinEnabled: false,
                        pinHash: '',
                        biometricEnabled: false,
                      })
                      clearBiometricCred()
                      flash('PIN disabled.')
                    })()
                  }}
                >
                  Disable PIN
                </button>
                <button type="button" className="btn-ghost" onClick={() => lock()}>
                  Lock now
                </button>
              </>
            )}
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Auto-lock (minutes)
          </label>
          <select
            className="max-w-xs mb-2"
            value={sec.autoLockMinutes}
            onChange={(e) => {
              const autoLockMinutes = Number(e.target.value)
              persistSecurity({ ...sec, autoLockMinutes })
              flash('Auto-lock updated.')
            }}
          >
            {[0, 1, 5, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'Off (manual lock only)' : `${m} min`}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-subtle mb-6 max-w-xl">
            When auto-lock is on, MyDSP also locks when you leave the app (iPhone/iPad app switcher).
          </p>
          <div className="flex flex-wrap gap-3 items-start">
            <button
              type="button"
              className="btn-secondary"
              disabled={!sec.pinEnabled || !isBiometricSupported()}
              onClick={() => {
                void (async () => {
                  if (!isBiometricSupported()) {
                    flash('Biometrics need HTTPS (or localhost). Open the installed PWA.')
                    return
                  }
                  const ok = await registerBiometric()
                  if (ok) {
                    persistSecurity({ ...sec, biometricEnabled: true })
                    flash(`${getBiometricLabel()} registered.`)
                  } else flash(`${getBiometricLabel()} unavailable or cancelled.`)
                })()
              }}
            >
              {sec.biometricEnabled
                ? `Re-register ${getBiometricLabel()}`
                : `Enable ${getBiometricLabel()}`}
            </button>
            {sec.biometricEnabled ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  clearBiometricCred()
                  persistSecurity({ ...sec, biometricEnabled: false })
                  flash(`${getBiometricLabel()} disabled.`)
                }}
              >
                Disable {getBiometricLabel()}
              </button>
            ) : null}
          </div>
          <p className="text-xs text-text-subtle mt-3 max-w-xl">
            {isBiometricSupported()
              ? `Tap “Unlock with ${getBiometricLabel()}” on the lock screen (iOS requires a tap — Face ID will not auto-start).`
              : 'Biometrics unavailable here — use an HTTPS host (e.g. workers.dev) and Add to Home Screen on iPhone/iPad.'}
          </p>
        </SettingsSection>

        <SettingsSection id="alerts" eyebrow="Alerts" title="Notifications">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            The header bell lists portfolio alerts. Optional desktop/OS banners fire only for new{' '}
            <strong className="text-text font-medium">critical</strong> items by default (budget
            overrun, debt RAG red, high card utilisation). iOS Safari support is limited; desktop
            Chrome/Edge work best.
          </p>

          <div className="space-y-4 max-w-xl">
            <label className="flex items-center justify-between gap-4 min-h-11">
              <span className="text-sm font-medium">In-app alerts</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent)]"
                checked={notifSettings.enabled}
                onChange={(e) => {
                  notificationManager.updateSettings({ enabled: e.target.checked })
                  flash(e.target.checked ? 'Alerts enabled.' : 'Alerts muted.')
                }}
              />
            </label>

            <label className="flex items-center justify-between gap-4 min-h-11">
              <span className="text-sm font-medium">Desktop / OS banners</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent)]"
                checked={notifSettings.desktopEnabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    void notificationManager.requestDesktopPermission().then((ok) => {
                      flash(
                        ok
                          ? 'Desktop notifications enabled.'
                          : 'Permission denied — enable notifications in the browser.',
                      )
                    })
                  } else {
                    notificationManager.updateSettings({ desktopEnabled: false })
                    flash('Desktop banners off.')
                  }
                }}
              />
            </label>

            <label className="flex items-center justify-between gap-4 min-h-11">
              <span className="text-sm font-medium">
                Alert sound
                <span className="block text-xs text-text-muted font-light mt-0.5">
                  Short beep on new critical alerts (off by default)
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent)]"
                checked={notifSettings.soundEnabled}
                onChange={(e) => {
                  notificationManager.updateSettings({ soundEnabled: e.target.checked })
                  flash(e.target.checked ? 'Alert sound on.' : 'Alert sound muted.')
                }}
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Minimum priority for banners
              <select
                className="mt-2 w-full"
                value={notifSettings.priorityThreshold}
                onChange={(e) => {
                  notificationManager.updateSettings({
                    priorityThreshold: e.target.value as NotificationPriority,
                  })
                  flash('Priority threshold saved.')
                }}
              >
                <option value="low">All (low+)</option>
                <option value="medium">Medium+</option>
                <option value="high">High+</option>
                <option value="critical">Critical only</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
                Quiet hours start
                <input
                  type="time"
                  className="mt-2"
                  value={notifSettings.quietHoursStart ?? '22:00'}
                  onChange={(e) => {
                    notificationManager.updateSettings({ quietHoursStart: e.target.value })
                  }}
                  onBlur={() => flash('Quiet hours saved.')}
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
                Quiet hours end
                <input
                  type="time"
                  className="mt-2"
                  value={notifSettings.quietHoursEnd ?? '07:00'}
                  onChange={(e) => {
                    notificationManager.updateSettings({ quietHoursEnd: e.target.value })
                  }}
                  onBlur={() => flash('Quiet hours saved.')}
                />
              </label>
            </div>
            <p className="text-xs text-text-subtle">
              Desktop banners are suppressed between these times (overnight ranges supported).
            </p>

            <div className="pt-4 border-t border-border">
              <label className="flex items-center justify-between gap-4 min-h-11 mb-3">
                <span className="text-sm font-medium">
                  Markets price alerts
                  <span className="block text-xs text-text-muted font-light mt-0.5">
                    Show in the bell when watchlist moves past your thresholds
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={notifSettings.categories['price-alerts'] !== false}
                  onChange={(e) => {
                    notificationManager.updateSettings({
                      categories: { 'price-alerts': e.target.checked },
                    })
                    flash(e.target.checked ? 'Price alerts on.' : 'Price alerts muted.')
                  }}
                />
              </label>
              <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
                Thresholds (% move)
              </p>
              <div className="space-y-2">
                {priceThresholds.map((th, idx) => (
                  <div key={`${th.key}-${idx}`} className="grid grid-cols-[1fr_5.5rem_auto] gap-2 items-center">
                    <input
                      type="text"
                      className="text-sm"
                      value={th.key}
                      aria-label={`Alert symbol ${idx + 1}`}
                      onChange={(e) => {
                        const next = [...priceThresholds]
                        next[idx] = { ...next[idx], key: e.target.value.toUpperCase() }
                        setPriceThresholds(next)
                      }}
                      onBlur={(e) => {
                        const next = [...priceThresholds]
                        next[idx] = { ...next[idx], key: e.target.value.toUpperCase() }
                        setPriceThresholds(next)
                        savePriceAlertThresholds(next)
                        flash('Price alert thresholds saved.')
                      }}
                    />
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="text-sm"
                      value={th.changePct}
                      aria-label={`Alert threshold % for ${th.key}`}
                      onChange={(e) => {
                        const next = [...priceThresholds]
                        next[idx] = {
                          ...next[idx],
                          changePct: Number(e.target.value) || next[idx].changePct,
                        }
                        setPriceThresholds(next)
                      }}
                      onBlur={(e) => {
                        const next = [...priceThresholds]
                        next[idx] = {
                          ...next[idx],
                          changePct: Number(e.target.value) || next[idx].changePct,
                        }
                        setPriceThresholds(next)
                        savePriceAlertThresholds(next)
                        flash('Price alert thresholds saved.')
                      }}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      aria-label={`Remove ${th.key}`}
                      onClick={() => {
                        const next = priceThresholds.filter((_, i) => i !== idx)
                        setPriceThresholds(next)
                        savePriceAlertThresholds(next)
                        flash('Threshold removed.')
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const next = [...priceThresholds, { key: 'BTC', changePct: 3 }]
                    setPriceThresholds(next)
                    savePriceAlertThresholds(next)
                  }}
                >
                  Add threshold
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    const next = resetPriceAlertThresholds()
                    setPriceThresholds(next)
                    flash('Defaults restored.')
                  }}
                >
                  Reset defaults
                </button>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection id="income" eyebrow="Income" title="Monthly income">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Used by Monthly review for surplus calculations.
          </p>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Amount £
          </label>
          <input
            key={`income-${activeId}`}
            type="text"
            inputMode="decimal"
            className="max-w-xs"
            defaultValue={data.monthlyIncome || ''}
            onBlur={(e) => {
              const n = Number(String(e.target.value).replace(/,/g, ''))
              setData((prev) => ({
                ...prev,
                monthlyIncome: Number.isFinite(n) ? n : 0,
              }))
              flash('Monthly income saved.')
            }}
          />
        </SettingsSection>

        <SettingsSection id="prices" eyebrow="Prices" title="Live market data">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Crypto prices use CoinGecko (no key). Equities use Finnhub if you add a free API key,
            otherwise Yahoo via a CORS proxy. Use the Prices button in the header to refresh.
          </p>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Finnhub API key
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              key={`finnhub-${activeId}`}
              type="password"
              autoComplete="off"
              placeholder="Optional — finnhub.io"
              defaultValue={data.settings.finnhubKey ?? ''}
              onBlur={(e) => {
                const key = e.target.value.trim()
                setData((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, finnhubKey: key || undefined },
                }))
                try {
                  if (key) localStorage.setItem('finnhub_key', key)
                  else localStorage.removeItem('finnhub_key')
                } catch {
                  /* ignore */
                }
                flash(key ? 'Finnhub key saved.' : 'Finnhub key cleared.')
              }}
            />
          </div>
        </SettingsSection>

        <SettingsSection id="devices" eyebrow="Devices" title="Install on iPhone & iPad">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl leading-relaxed">
            Pin MyDSP as a home-screen app so it opens full-screen with the orange icon. Data on
            each device is local-first (same browser origin). Use{' '}
            <a href="#sync" className="text-accent font-medium">
              Encrypted cloud sync
            </a>{' '}
            (top of this page) so web, iPhone, and iPad stay aligned.
          </p>
          <ol className="text-sm text-text-muted font-light space-y-2 mb-6 max-w-2xl list-decimal list-inside leading-relaxed">
            <li>
              Open MyDSP in <span className="text-text font-medium">Safari</span> (required on iOS).
            </li>
            <li>
              Tap <span className="text-text font-medium">Share</span>, then{' '}
              <span className="text-text font-medium">Add to Home Screen</span>.
            </li>
            <li>Confirm the name <span className="text-text font-medium">MyDSP</span> and add.</li>
            <li>
              Open Settings (bottom tab) → turn on{' '}
              <span className="text-text font-medium">Automatic sync</span> +{' '}
              <span className="text-text font-medium">Remember passphrase</span>.
            </li>
          </ol>
          <p className="text-xs text-text-subtle leading-relaxed max-w-2xl">
            On desktop Chrome/Edge, use the install banner or the browser&apos;s Install app menu.
            Android: browser menu → Install app / Add to Home screen.
          </p>
        </SettingsSection>

        <SettingsSection id="account" eyebrow="Account" title="Cloud account (preview)">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl leading-relaxed">
            Keep an optional email on this device as a future identity hint. Encrypted sync stays{' '}
            <strong className="text-text font-medium">passphrase-based</strong> today — there is no
            Google / Apple / Microsoft OAuth sign-in yet (planned later). Do not expect a “Sign in
            with…” button here.
          </p>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Email
          </label>
          <input
            type="email"
            className="max-w-md mb-6"
            placeholder="you@example.com"
            value={cloudEmail}
            onChange={(e) => {
              const v = e.target.value
              setCloudEmail(v)
              try {
                if (v.trim()) localStorage.setItem('mydsp_cloud_email', v.trim())
                else localStorage.removeItem('mydsp_cloud_email')
              } catch {
                /* ignore */
              }
            }}
          />
          <div className="border border-border px-4 py-3 max-w-2xl">
            <p className="text-sm font-medium mb-1">Export identity backup note</p>
            <p className="text-xs text-text-muted font-light leading-relaxed">
              Your portfolio identity is the combination of this browser origin, any email you
              store above, and your sync passphrase / full backup files. Export a full backup from
              Settings → Full backup before clearing site data. OAuth will not replace passphrase
              sync when it lands — it is only planned as an optional account link.
            </p>
          </div>
        </SettingsSection>

        <SettingsSection id="open-banking" eyebrow="Import" title="Open banking (coming)">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl leading-relaxed">
            Direct bank account linking (PSD2 / Open Banking) is <strong className="text-text font-medium">not
            implemented</strong>. MyDSP stays local-first: you import CSV exports from your bank or
            broker. We are not requesting AISP consent, storing bank credentials, or polling live
            transaction feeds.
          </p>
          <ul className="text-sm text-text-muted font-light space-y-2 max-w-2xl list-disc pl-5 mb-4">
            <li>
              Use{' '}
              <Link to="/import" className="text-accent hover:underline">
                CSV Import
              </Link>{' '}
              or Enhanced CSV for spending
            </li>
            <li>Use Settings → Trade history templates for broker CSVs</li>
            <li>Future open-banking work would be opt-in and UK/EU regulated — out of scope for now</li>
          </ul>
          <p className="text-xs text-text-subtle max-w-2xl">
            Honest parking-lot item only — no fake “Connect bank” button.
          </p>
        </SettingsSection>

        <SettingsSection id="portfolios" eyebrow="Portfolios" title="Family portfolios">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Up to {maxPortfolios} workspaces — <strong className="text-text">David</strong>{' '}
            plus {maxPortfolios - 1} others. Names must be unique. New portfolios start empty so you
            can enter data manually. Set currency / tax residency per active portfolio above.{' '}
            <Link to="/setup/opening" className="text-accent hover:underline">
              Opening wizard
            </Link>
            {' · '}
            <Link to="/compare" className="text-accent hover:underline">
              Compare
            </Link>
          </p>
          <ul className="divide-y divide-border mb-6">
            {portfolios.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
                {renameId === p.id ? (
                  <form
                    className="flex flex-wrap gap-2 flex-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!renameDraft.trim()) return
                      const r = renamePortfolio(p.id, renameDraft.trim())
                      if (!r.ok) {
                        setPortfolioNameError(r.error ?? 'Rename failed')
                        flash(r.error ?? 'Rename failed')
                        return
                      }
                      setPortfolioNameError(null)
                      flash(`Renamed to ${renameDraft.trim()}.`)
                      setRenameId(null)
                    }}
                  >
                    <input
                      className="flex-1 min-w-[10rem]"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary btn-sm">
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setRenameId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`text-left font-medium ${p.id === activeId ? 'text-accent' : ''}`}
                      onClick={() => switchPortfolio(p.id)}
                    >
                      {p.name}
                      {p.id === activeId ? ' · active' : ''}
                      {p.id === 'default' ? (
                        <span className="text-text-subtle font-light"> · primary</span>
                      ) : null}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setRenameId(p.id)
                          setRenameDraft(p.name)
                        }}
                      >
                        Rename
                      </button>
                      {p.id !== 'default' && (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            setConfirmState({
                              title: 'Delete portfolio',
                              body: `Delete “${p.name}”? All holdings and history in that portfolio will be removed.`,
                              confirmLabel: 'Delete portfolio',
                              onConfirm: () => {
                                deletePortfolio(p.id)
                                flash(`Deleted ${p.name}.`)
                              },
                            })
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              placeholder="New portfolio name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (portfolioNameError) setPortfolioNameError(null)
              }}
              disabled={!canAddPortfolio}
              aria-invalid={Boolean(portfolioNameError)}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!canAddPortfolio}
              onClick={() => {
                if (!newName.trim()) return
                const r = createPortfolio(newName.trim())
                if (!r.ok) {
                  setPortfolioNameError(r.error ?? 'Could not create')
                  flash(r.error ?? 'Could not create')
                  return
                }
                setPortfolioNameError(null)
                setNewName('')
                flash('Empty portfolio created — add holdings when ready.')
              }}
            >
              Add portfolio
            </button>
          </div>
          {portfolioNameError ? (
            <p className="text-sm text-red-500 mt-2" role="alert">
              {portfolioNameError}
            </p>
          ) : null}
          <p className="text-xs text-text-subtle mt-3">
            {portfolios.length} / {maxPortfolios} used
            {!canAddPortfolio ? ' · delete one to add another' : ''}
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                const before = hasDuplicatePortfolioNames()
                const { removed, kept } = dedupePortfoliosByName()
                reload()
                setPortfolioNameError(null)
                if (!before && removed.length === 0) {
                  flash('Portfolio names are already unique. Syncing current list…')
                } else {
                  flash(
                    `Removed ${removed.length} duplicate(s) — ${kept} portfolio(s) kept. Syncing…`,
                  )
                }
                void syncNow()
                  .then(() => flash('Portfolio list synced — other devices will match on refresh.'))
                  .catch((e) =>
                    flash(e instanceof Error ? e.message : 'Cleanup saved locally; sync failed.'),
                  )
              }}
            >
              Clean up duplicates & sync
            </button>
            <p className="text-xs text-text-muted">
              Ensures one entry per name (max {maxPortfolios}) and pushes so iPhone / Mac / iPad match.
            </p>
          </div>
        </SettingsSection>

        <SettingsSection id="full-backup" eyebrow="Backup" title="Full MyDSP backup">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Snapshots <strong className="text-text">every portfolio</strong> automatically once per
            day (keeps the last {MAX_BACKUPS}). You can also back up manually, download a file, or
            restore. Active-portfolio JSON export remains below for single-workspace copies.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              type="button"
              className="btn-primary"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    await createFullBackup('manual')
                    refreshBackupList()
                    flash('Full backup saved on this device.')
                  } catch {
                    flash('Backup failed — check browser storage permissions.')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              Backup now
            </button>
            {canUseNativeShare() && (
              <button
                type="button"
                className="btn-secondary"
                disabled={backupBusy}
                onClick={() => {
                  void (async () => {
                    setBackupBusy(true)
                    try {
                      const meta = await createFullBackup('manual', 'Share archive')
                      const full = await getFullBackup(meta.id)
                      if (full) {
                        const result = await shareBackupFile(full)
                        if (result === 'shared') {
                          flash('Backup shared successfully.')
                        } else if (result === 'cancelled') {
                          flash('Share cancelled.')
                        }
                      }
                      refreshBackupList()
                    } catch {
                      flash('Share failed.')
                    } finally {
                      setBackupBusy(false)
                    }
                  })()
                }}
              >
                Share backup
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    const meta = await createFullBackup('manual', 'Download archive')
                    const full = await getFullBackup(meta.id)
                    if (full) downloadFullBackupFile(full)
                    refreshBackupList()
                    flash('Full backup downloaded.')
                  } catch {
                    flash('Download failed.')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              Download JSON
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    const meta = await createFullBackup('manual', 'Folder export')
                    const full = await getFullBackup(meta.id)
                    if (!full) {
                      flash('Could not read backup.')
                      return
                    }
                    const result = await saveFullBackupToFolder(full)
                    refreshBackupList()
                    if (result === 'saved') {
                      flash('Saved to chosen folder (iCloud Drive / Google Drive / local).')
                    } else if (result === 'fallback') {
                      flash(
                        'Folder picker unavailable — file downloaded instead (share to iCloud/Drive).',
                      )
                    }
                  } catch {
                    flash('Folder export failed.')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              Save to folder…
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fullBackupFileRef.current?.click()}
            >
              Restore from file
            </button>
            <input
              ref={fullBackupFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                void (async () => {
                  try {
                    const text = await f.text()
                    const parsed = parseFullBackupFile(JSON.parse(text) as unknown)
                    if (!parsed) {
                      flash('Not a MyDSP full backup file.')
                      return
                    }
                    setConfirmState({
                      title: 'Restore full backup',
                      body: `Replace ALL portfolios with backup from ${parsed.createdAt.slice(0, 10)} (v${parsed.appVersion})?`,
                      confirmLabel: 'Restore backup',
                      onConfirm: () => {
                        void (async () => {
                          await restoreFullWorkspace(parsed)
                          reload()
                          flash('Full workspace restored.')
                        })()
                      },
                    })
                  } catch {
                    flash('Could not restore that file.')
                  }
                })()
                e.target.value = ''
              }}
            />
          </div>

          {backups.length === 0 ? (
            <p className="text-sm text-text-subtle">No local backups yet — one will run automatically today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {backups.map((b) => (
                <li key={b.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <p className="font-medium text-sm">{b.label}</p>
                    <p className="text-xs text-text-subtle">
                      {new Date(b.createdAt).toLocaleString('en-GB')} · v{b.appVersion} ·{' '}
                      {b.portfolioCount} portfolios · {b.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        void (async () => {
                          const full = await getFullBackup(b.id)
                          if (!full) return
                          setConfirmState({
                            title: 'Restore local backup',
                            body: `Restore “${b.label}”? This replaces all current portfolios.`,
                            confirmLabel: 'Restore backup',
                            onConfirm: () => {
                              void (async () => {
                                await restoreFullWorkspace(full)
                                reload()
                                flash('Restored from local backup.')
                              })()
                            },
                          })
                        })()
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        void (async () => {
                          const full = await getFullBackup(b.id)
                          if (full) downloadFullBackupFile(full)
                        })()
                      }}
                    >
                      Download
                    </button>
                    {canUseNativeShare() ? (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          void (async () => {
                            const full = await getFullBackup(b.id)
                            if (!full) return
                            const result = await shareBackupFile(full)
                            if (result === 'shared') flash('Shared backup.')
                            else if (result === 'fallback') flash('Share unavailable — downloaded instead.')
                          })()
                        }}
                      >
                        Share
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        void (async () => {
                          await deleteFullBackup(b.id)
                          refreshBackupList()
                        })()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>

        <SettingsSection id="export" eyebrow="Export" title="Active portfolio only">
          <p className="text-sm text-text-muted font-light mb-6">
            Active: <strong>{portfolios.find((p) => p.id === activeId)?.name}</strong> ·{' '}
            {data.crypto.length} crypto · {data.equities.length} equities ·{' '}
            {data.creditCards.length + data.loans.length} debts
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={onExport}>
              Download JSON (active)
            </button>
            <button type="button" className="btn-ghost" onClick={onExportCsv}>
              Export spending CSV
            </button>
            <button type="button" className="btn-ghost" onClick={() => reload()}>
              Reload from storage
            </button>
          </div>
        </SettingsSection>

        <SettingsSection id="reports" eyebrow="Reports" title="PDF & spreadsheet exports">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Print-ready PDFs and CSV downloads for portfolio, spending, goals, jobs, and todos —
            separate from encrypted full backups above.
          </p>
          <DataExportPanel />
        </SettingsSection>

        <SettingsSection id="versions" eyebrow="Versions" title="App version & rollback">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Running <strong className="text-text">v{__APP_VERSION__}</strong>. Full backups store
            the app version they were taken under. To roll back the <em>app code</em>, redeploy a
            previous build (see DEPLOY.md / Netlify–Vercel history), then restore a matching data
            backup if needed.
          </p>
          <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5 mb-6 max-w-2xl">
            <li>Take a manual full backup before upgrading or rolling back.</li>
            <li>Redeploy the older MyDSP release from your host or git tag.</li>
            <li>Clear the service worker cache (below) and hard-refresh.</li>
            <li>Restore the backup taken under that version if data looks wrong.</li>
          </ol>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void (async () => {
                await clearServiceWorkerCaches()
                flash('Caches cleared — reload the page to finish.')
                window.setTimeout(() => window.location.reload(), 800)
              })()
            }}
          >
            Clear SW cache &amp; reload
          </button>
        </SettingsSection>

        <SettingsSection id="danger" eyebrow="Danger zone" title="Reset active portfolio">
          <p className="text-sm text-text-muted font-light mb-6">
            Affects only the active portfolio. Prefer a full backup first.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setConfirmState({
                  title: 'Load sample data',
                  body: 'Replace active portfolio with FCC sample data?',
                  confirmLabel: 'Load sample',
                  variant: 'default',
                  onConfirm: () => {
                    resetToSample()
                    flash('Loaded FCC sample portfolio.')
                  },
                })
              }}
            >
              Load sample data
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setConfirmState({
                  title: 'Clear portfolio',
                  body: 'Clear all holdings and history on this portfolio?',
                  confirmLabel: 'Clear portfolio',
                  onConfirm: () => {
                    clearAll()
                    flash('Portfolio cleared.')
                  },
                })
              }}
            >
              Clear portfolio
            </button>
          </div>
        </SettingsSection>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        body={confirmState?.body ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        holdMs={confirmState?.holdMs ?? (confirmState?.variant === 'danger' ? 800 : 0)}
        onClose={() => setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />
    </div>
  )
}
