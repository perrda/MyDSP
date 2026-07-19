import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DataExportPanel } from '../components/DataExportPanel'
import { SettingsSection } from '../components/SettingsSection'
import { WhatsNewArchive } from '../components/WhatsNewArchive'
import { PageHeader } from '../components/ui/PageHeader'
import { openSettingsSection, setAllSettingsSectionsOpen } from '../storage/settingsSectionsStore'
import { ConfirmDialog } from '../components/ui/Modal'
import { useSecurity } from '../components/SecurityProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { useTheme, type ThemePreference } from '../context/ThemeContext'
import { useGlass } from '../context/GlassContext'
import {
  applyLargeTextDom,
  LARGE_TEXT_STORAGE_KEY,
  loadLargeText,
  saveLargeText,
} from '../utils/largeText'
import { isSyncTradeBackupSuccess, triggerSuccessFlash } from '../utils/successFlash'
import {
  A11Y_CHART_CB_KEY,
  A11Y_HIGH_CONTRAST_KEY,
  A11Y_REDUCED_MOTION_KEY,
  applyA11yHighContrastDom,
  applyA11yReducedMotionDom,
  loadA11yChartColourBlind,
  loadA11yHighContrast,
  loadA11yReducedMotion,
  saveA11yChartColourBlind,
  saveA11yHighContrast,
  saveA11yReducedMotion,
} from '../utils/a11yPrefs'
import { holdingHistoryKey, readHoldingHistory } from '../domain/holdingHistory'
import type { HoldingPricePoint } from '../domain/holdingHistory'
import { registerStaticPriceFile } from '../domain/staticPrices'
import {
  clearOfflineQueue,
  enqueueOfflineJob,
  formatOfflineJobAge,
  isOfflineJobReady,
  isOnline,
  jobsReadyToFlush,
  loadOfflineQueue,
  markOfflineJobFailed,
  oldestOfflineJobAgeMs,
  removeOfflineJob,
  retryOfflineJobNow,
  shareOfflineJobError,
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
import { downloadConflictSummary, shareConflictSummary } from '../services/sync/conflictExport'
import { loadSyncActivity, type SyncActivityEntry } from '../services/sync/syncActivity'
import {
  formatMarketsProviderHealthHint,
  getMarketsProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from '../services/marketsProviderHealth'
import { probeFinnhubKey } from '../services/prices'
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
  DEFAULT_HOLDINGS_DRIFT_PCT,
  loadHoldingsDriftThresholdPct,
  saveHoldingsDriftThresholdPct,
} from '../domain/holdingsDrift'
import {
  DEFAULT_PORTFOLIO_CONCENTRATION_PCT,
  loadPortfolioConcentrationThresholdPct,
  savePortfolioConcentrationThresholdPct,
} from '../domain/portfolioConcentration'
import {
  loadShowMarketsTagYieldChips,
  saveShowMarketsTagYieldChips,
} from '../domain/marketsTagYieldPref'
import {
  allConflictsResolved,
  applyMergePreview,
  downloadEncryptedBackup,
  formatRemoteBlobAge,
  formatSyncPayloadBytes,
  getSyncRemoteUrlWarning,
  loadSyncConfig,
  normalizeSyncRemoteUrl,
  previewImport,
  previewPull,
  pushSync,
  saveSyncConfig,
  shareSyncDiagnostics,
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
  type SecurityState,
} from '../security/pin'
import {
  notificationManager,
  type NotificationPriority,
  type NotificationSettings,
} from '../utils/notifications'
import {
  isInQuietWindow,
  nowPct,
  quietSegments,
} from '../domain/quietHoursTimeline'
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
  DEFAULT_BOTTOM_NAV_MIDDLE,
  loadBottomNavMiddleSlots,
  resetBottomNavMiddleSlots,
  saveBottomNavMiddleSlots,
} from '../storage/bottomNavSlots'
import { BOTTOM_NAV_CATALOG } from '../domain/bottomNav'
import {
  completeFinnhubSetupTodo,
  ensureFinnhubSetupTodo,
  hasFinnhubKey,
} from '../domain/finnhubReminder'
import { PinConfirmModal } from '../components/PinConfirmModal'
import {
  getRememberPassphraseMode,
  getSessionSyncPassphrase,
  hasRememberedSyncPassphrase,
  rememberPassphraseExpiresAt,
  setSessionSyncPassphrase,
  type RememberPassphraseMode,
} from '../services/sync/sessionPassphrase'
import {
  clearPendingAutoSyncConflicts,
  forceSyncNow,
  getAutoSyncStatus,
  getPendingAutoSyncConflicts,
  isAutoSyncPaused,
  pauseAutoSync,
  resumeAutoSync,
  subscribeAutoSync,
  syncNow,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { scorePassphraseStrength } from '../services/sync/passphraseStrength'
import {
  defaultDeviceNickname,
  getLocalDeviceHint,
  loadDeviceNickname,
  saveDeviceNickname,
} from '../services/sync/deviceNickname'
import {
  buildSyncSetupText,
  copySyncSetupUrl,
  downloadSyncSetupUrl,
  drawSyncSetupCard,
} from '../services/sync/syncSetupExport'
import {
  loadRecentSettingsJumps,
  rankSettingsSections,
  recordSettingsJump,
  settingsSectionLabel,
} from '../domain/settingsSearch'

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
  'accessibility',
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
  'whats-new',
  'danger',
] as const

const SETTINGS_SECTION_SEARCH: Record<(typeof SETTINGS_SECTION_IDS)[number], string> = {
  sync: 'Encrypted cloud sync passphrase remote url push pull dry-run device nickname setup url',
  appearance: 'Light dark glass mode theme larger text accessibility',
  accessibility:
    'Accessibility larger text reduced motion high contrast colour blind chart palette a11y',
  layout: 'On launch favourites sidebar bottom nav tabs middle slots Overview Settings',
  fcc: 'Sample FCC portfolio',
  display: 'Currency tax residency privacy',
  'trade-history': 'Broker CSV IBKR Trading 212 Coinbase trades',
  'price-history': 'Holding price history import',
  security: 'PIN Face ID lock biometric unlock timeout iPhone iPad',
  alerts: 'Notifications quiet hours price alerts youtube uploads desktop sound holdings drift',
  income: 'Income honesty',
  prices: 'Price refresh providers Finnhub CoinGecko Yahoo failover API key',
  devices: 'Devices sync activity log smoke checklist install PWA nickname',
  account: 'Cloud account OAuth identity',
  'open-banking': 'Open banking PSD2 bank feed',
  portfolios: 'Create rename delete portfolios',
  'full-backup': 'Encrypted full backup download restore',
  export: 'Export data CSV JSON',
  reports: 'PDF financial report',
  versions: 'App version changelog rollback',
  'whats-new': 'What’s new release notes archive versions changelog',
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
  const [largeText, setLargeTextState] = useState(() => loadLargeText())
  const [a11yReducedMotion, setA11yReducedMotion] = useState(() => loadA11yReducedMotion())
  const [a11yHighContrast, setA11yHighContrast] = useState(() => loadA11yHighContrast())
  const [a11yChartCb, setA11yChartCb] = useState(() => loadA11yChartColourBlind())
  const [layoutFlash, setLayoutFlash] = useState(false)

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
  const [bottomMiddle, setBottomMiddle] = useState<string[]>(() => loadBottomNavMiddleSlots())
  const [priceThresholds, setPriceThresholds] = useState<PriceAlertThreshold[]>(() =>
    loadPriceAlertThresholds(),
  )
  const [driftPct, setDriftPct] = useState(() => loadHoldingsDriftThresholdPct())
  const [concentrationPct, setConcentrationPct] = useState(() =>
    loadPortfolioConcentrationThresholdPct(),
  )
  const [showMarketsTagYield, setShowMarketsTagYield] = useState(() =>
    loadShowMarketsTagYieldChips(),
  )
  const [syncActivity, setSyncActivity] = useState<SyncActivityEntry[]>(() => loadSyncActivity())
  const [syncActivityFilter, setSyncActivityFilter] = useState<'all' | 'this' | 'others'>('all')
  const [disablePinOpen, setDisablePinOpen] = useState(false)
  const [rememberMode, setRememberMode] = useState<RememberPassphraseMode>(() =>
    getRememberPassphraseMode(),
  )
  const [quoteHealthHint, setQuoteHealthHint] = useState<string | null>(() =>
    formatMarketsProviderHealthHint(),
  )
  const [quoteHealthOk, setQuoteHealthOk] = useState(() =>
    getMarketsProviderHealth().every((p) => p.consecutiveFailures === 0),
  )
  const [settingsQuery, setSettingsQuery] = useState('')
  const [recentJumps, setRecentJumps] = useState<string[]>(() => loadRecentSettingsJumps())

  const jumpToSettingsSection = (id: string) => {
    openSettingsSection(id)
    setRecentJumps(recordSettingsJump(id))
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }
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
  const [deviceNickname, setDeviceNickname] = useState(() => loadDeviceNickname())
  const [dryRunSummary, setDryRunSummary] = useState<string | null>(null)
  const [showSetupCard, setShowSetupCard] = useState(false)
  const [rotatePassOpen, setRotatePassOpen] = useState(false)
  const [rotatePass, setRotatePass] = useState('')
  const [rotateBusy, setRotateBusy] = useState(false)
  const setupCanvasRef = useRef<HTMLCanvasElement>(null)

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
    let flashClear: number | undefined
    if (id === 'layout') {
      setLayoutFlash(true)
      flashClear = window.setTimeout(() => setLayoutFlash(false), 1800)
    }
    return () => {
      window.clearTimeout(t)
      if (flashClear) window.clearTimeout(flashClear)
    }
  }, [location.hash, location.pathname])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LARGE_TEXT_STORAGE_KEY) {
        const on = e.newValue === '1'
        applyLargeTextDom(on)
        setLargeTextState(on)
      }
      if (e.key === A11Y_REDUCED_MOTION_KEY) {
        const on = e.newValue === '1'
        applyA11yReducedMotionDom(on)
        setA11yReducedMotion(on)
        window.dispatchEvent(new Event('mydsp-a11y-change'))
      }
      if (e.key === A11Y_HIGH_CONTRAST_KEY) {
        const on = e.newValue === '1'
        applyA11yHighContrastDom(on)
        setA11yHighContrast(on)
      }
      if (e.key === A11Y_CHART_CB_KEY) {
        setA11yChartCb(e.newValue === '1')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
    if (isSyncTradeBackupSuccess(msg)) triggerSuccessFlash()
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

  const pendingConflictCount =
    conflicts.length ||
    pendingMerge?.conflicts.length ||
    autoSyncStatus.pendingConflicts ||
    0

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings & data"
        description="Sections start collapsed — tap a header (Sync, Display, Security…) to expand. Cloud Sync is first."
      />

      {pendingConflictCount > 0 ? (
        <button
          type="button"
          className="settings-sync-conflict-fab sticky top-[calc(var(--app-header-offset,3.5rem)+0.5rem)] z-30 ml-auto mb-3 flex w-fit items-center gap-2 border border-accent bg-bg-elevated px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent shadow-lg sm:mr-2 lg:hidden"
          onClick={() => {
            if (!hydrateAutoSyncConflicts()) {
              document.getElementById('sync-conflicts-panel')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          }}
        >
          Review {pendingConflictCount} sync conflict{pendingConflictCount === 1 ? '' : 's'}
        </button>
      ) : null}

      <div
        className="settings-search-sticky sticky z-20 -mx-1 px-1 py-2 mb-4 flex flex-wrap gap-2 items-center bg-bg/95 backdrop-blur-sm border-b border-border/60"
        style={{ top: 'var(--app-header-offset, 3.5rem)' }}
        role="group"
        aria-label="Settings sections"
      >
        <div className="flex flex-wrap gap-1 w-full basis-full sm:basis-auto" role="group" aria-label="Pinned settings">
          {(
            [
              ['sync', 'Sync'],
              ['security', 'Security'],
              ['full-backup', 'Backup'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="settings-pin-chip btn-ghost btn-sm min-h-9 px-2.5 text-[11px] font-bold uppercase tracking-wider shrink-0"
              onClick={() => jumpToSettingsSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
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
            const needle = q.trim()
            if (needle.length < 2) return
            const ranked = rankSettingsSections(
              needle,
              SETTINGS_SECTION_IDS,
              SETTINGS_SECTION_SEARCH,
            )
            const hit = ranked[0]?.id
            if (!hit) return
            jumpToSettingsSection(hit)
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
        {recentJumps.length > 0 ? (
          <div
            className="settings-recent-jumps flex flex-wrap gap-1.5 w-full basis-full mt-1"
            role="group"
            aria-label="Recent settings sections"
          >
            <span className="text-[11px] uppercase tracking-wider text-text-subtle font-semibold self-center mr-1">
              Recent
            </span>
            {recentJumps.map((id) => (
              <button
                key={id}
                type="button"
                className="btn-ghost btn-sm min-h-9 text-xs"
                onClick={() => jumpToSettingsSection(id)}
              >
                {settingsSectionLabel(id)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {message && (
        <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6" role="status">
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="settings-split">
        <nav
          className="settings-split-nav"
          aria-label="Settings sections"
        >
          <p className="settings-split-nav__title">Sections</p>
          <ul className="settings-split-nav__list">
            {SETTINGS_SECTION_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="settings-split-nav__link"
                  onClick={() => jumpToSettingsSection(id)}
                >
                  {settingsSectionLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="settings-split-content grid grid-cols-1 gap-px">
        <SettingsSection id="sync" eyebrow="Sync" title="Encrypted cloud sync">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            On iPhone / iPad: pull down on Today or Markets to sync across devices. Same Remote URL +
            passphrase on Mac, iPhone, and iPad. Turn on{' '}
            <span className="text-text font-medium">Automatic sync</span> and{' '}
            <span className="text-text font-medium">Remember passphrase</span> so sync works after
            you close the tab. Sync is encrypted batch sync (not live WebSockets): expect ~8s after
            an edit to push (~4s), and a pull when you open/focus the app, pull-to-refresh, or about
            every 30 seconds while it stays open.
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
          {quoteHealthHint || !quoteHealthOk ? (
            <p className="text-xs text-text-muted font-light mb-4 max-w-2xl">
              Deploy with{' '}
              <code
                className="text-accent font-mono cursor-pointer select-all"
                title="Click to copy"
                role="button"
                tabIndex={0}
                onClick={() => {
                  void navigator.clipboard.writeText('npm run deploy:quote').then(
                    () => flash('Copied: npm run deploy:quote'),
                    () => flash('Could not copy.'),
                  )
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    ;(e.currentTarget as HTMLElement).click()
                  }
                }}
              >
                npm run deploy:quote
              </code>
              . Expect Worker mydsp-quote, not mydspv1.
            </p>
          ) : null}
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
          <div className="mb-4 max-w-md space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Device nickname
              <input
                type="text"
                className="mt-2 w-full min-h-11"
                value={deviceNickname}
                placeholder={defaultDeviceNickname()}
                maxLength={40}
                onChange={(e) => setDeviceNickname(e.target.value)}
                onBlur={() => {
                  const next = saveDeviceNickname(deviceNickname)
                  setDeviceNickname(next)
                  flash(`Device nickname saved: ${next}`)
                }}
              />
            </label>
            <p className="text-xs text-text-subtle font-light">
              Shown in sync activity and conflict sheet. Stored only on this install (
              <code className="text-accent">mydsp_device_nickname</code>).
            </p>
          </div>
          <div className="mb-6 max-w-2xl border border-border/60 p-3 space-y-2 sync-setup-url-card">
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle">
              Scan / setup URL
            </p>
            <p className="text-xs text-text-muted font-light">
              Share the Remote URL only — never the passphrase. Copy, download a text file, or show a
              setup card.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!syncCfg.remoteUrl.trim()}
                onClick={() => {
                  void (async () => {
                    const ok = await copySyncSetupUrl(syncCfg.remoteUrl)
                    flash(ok ? 'Remote URL copied (passphrase not included).' : 'Could not copy.')
                  })()
                }}
              >
                Copy setup URL
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={!syncCfg.remoteUrl.trim()}
                onClick={() => {
                  downloadSyncSetupUrl(syncCfg.remoteUrl)
                  flash('Downloaded mydsp-sync-setup-url.txt')
                }}
              >
                Download .txt
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={!syncCfg.remoteUrl.trim()}
                onClick={() => {
                  setShowSetupCard((v) => !v)
                  requestAnimationFrame(() => {
                    if (setupCanvasRef.current) {
                      drawSyncSetupCard(setupCanvasRef.current, syncCfg.remoteUrl)
                    }
                  })
                }}
              >
                {showSetupCard ? 'Hide card' : 'Show setup card'}
              </button>
            </div>
            {showSetupCard ? (
              <canvas
                ref={setupCanvasRef}
                className="mt-2 max-w-full border border-border"
                width={360}
                height={220}
                aria-label={buildSyncSetupText(syncCfg.remoteUrl)}
              />
            ) : null}
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Passphrase
          </label>
          <div className="flex flex-wrap gap-2 mb-1 max-w-md items-stretch">
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
          {(() => {
            const strength = scorePassphraseStrength(syncPass)
            const pct = (strength.score / 4) * 100
            return (
              <div className="passphrase-strength mb-3 max-w-md" aria-live="polite">
                <div
                  className="h-1.5 w-full bg-border/60 overflow-hidden"
                  role="meter"
                  aria-label="Passphrase strength"
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={strength.score}
                  aria-valuetext={strength.label}
                >
                  <div
                    className={`h-full transition-[width] duration-200 ${
                      strength.score <= 1
                        ? 'bg-accent/70'
                        : strength.score === 2
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {syncPass ? (
                  <p className="text-[10px] text-text-subtle mt-1 font-medium tracking-wide uppercase">
                    Strength: {strength.label}
                  </p>
                ) : null}
              </div>
            )
          })()}
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
                  Pull when you open the app, return to the tab, or about every 30s while open;
                  push ~4s after you edit (pulls first if another device updated cloud). No iCloud
                  needed — uses your Cloudflare Worker.
                </span>
              </span>
            </label>
            <div
              className="settings-what-does-not-sync surface-nested p-3 max-w-2xl"
              id="what-does-not-sync"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-1.5">
                What does not sync
              </p>
              <ul className="text-xs text-text-muted font-light list-disc list-inside space-y-1 leading-relaxed">
                <li>Finnhub API key (and other live provider keys) — local to each device</li>
                <li>PIN / Face ID credentials and unlock timeout</li>
                <li>Session / remembered sync passphrase storage</li>
                <li>Provider health counters (this browser session only)</li>
                <li>Accessibility prefs (reduced motion, high contrast) — device-local</li>
                <li>Glass theme and large text mode — device-local presentation</li>
                <li>
                  Price-alert notification permission / OS prompts — thresholds sync; permission is
                  per device
                </li>
                <li>YouTube upload alert toggle (bell / desktop) — device-local</li>
              </ul>
              <p className="text-xs text-text-muted font-light mt-2 leading-relaxed">
                These sync via fullArchive: Launch path, UI panels, Markets tag/Yield chips, Settings
                recent jumps, Settings sections, Tax year, Journal asset filter, Today NW spark
                window, API webhook URL, Achievements seen, Getting started dismissed, What arrived
                dismiss fingerprint, portfolio concentration threshold, spending filters, news tag
                filter, Todos quick filter, Jobs filter, Bottom nav middle slots, Recurring sort,
                holdings drift threshold, and digest highlight edits. Notification quiet-hours,
                desktop banners, and sound stay device-local.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(syncCfg.rememberPassphrase) || hasRememberedSyncPassphrase()}
                onChange={(e) => {
                  const remember = e.target.checked
                  const mode: RememberPassphraseMode = remember ? rememberMode === 'session' ? 'forever' : rememberMode : 'session'
                  const next = { ...syncCfg, rememberPassphrase: remember }
                  setSyncCfg(next)
                  saveSyncConfig(next)
                  setRememberMode(remember ? mode : 'session')
                  if (syncPass) {
                    setSessionSyncPassphrase(syncPass, { remember, rememberMode: mode })
                  } else if (!remember) {
                    setSessionSyncPassphrase('', { remember: false, rememberMode: 'session' })
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
            {(Boolean(syncCfg.rememberPassphrase) || hasRememberedSyncPassphrase()) && (
              <label className="block max-w-sm ml-8 -mt-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-text-subtle">
                  Remember for
                </span>
                <select
                  className="mt-2 w-full"
                  aria-label="Passphrase remember duration"
                  value={rememberMode === 'session' ? 'forever' : rememberMode}
                  onChange={(e) => {
                    const mode = e.target.value as RememberPassphraseMode
                    setRememberMode(mode)
                    const next = { ...syncCfg, rememberPassphrase: true }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    if (syncPass || getSessionSyncPassphrase()) {
                      setSessionSyncPassphrase(syncPass || getSessionSyncPassphrase() || '', {
                        remember: true,
                        rememberMode: mode,
                      })
                    }
                    flash(
                      mode === '7d'
                        ? 'Passphrase remembered for 7 days.'
                        : 'Passphrase remembered until you revoke it.',
                    )
                  }}
                >
                  <option value="7d">7 days</option>
                  <option value="forever">Until I revoke</option>
                </select>
                {rememberPassphraseExpiresAt() ? (
                  <span className="text-xs text-text-subtle mt-1 block font-light">
                    Expires {new Date(rememberPassphraseExpiresAt()!).toLocaleString('en-GB')}
                  </span>
                ) : null}
              </label>
            )}
            <div className="passphrase-rotate-wizard ml-8 -mt-1 max-w-xl border border-border/60 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text">Rotate sync passphrase</p>
                  <p className="text-xs text-text-muted font-light">
                    Re-encrypt local data and push it. After a successful push, the remote uses the
                    new passphrase; update your other devices before they sync again.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  aria-expanded={rotatePassOpen}
                  onClick={() => setRotatePassOpen((v) => !v)}
                >
                  {rotatePassOpen ? 'Cancel rotate' : 'Rotate passphrase'}
                </button>
              </div>
              {rotatePassOpen ? (
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-text-subtle">
                      New passphrase
                    </span>
                    <input
                      type={showSyncPass ? 'text' : 'password'}
                      className="mt-2 w-full max-w-md"
                      autoComplete="new-password"
                      placeholder="New sync passphrase (min 8 chars)"
                      value={rotatePass}
                      onChange={(e) => setRotatePass(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={rotateBusy}
                      onClick={() => {
                        void (async () => {
                          if (!syncCfg.remoteUrl.trim()) {
                            flash('Set Remote URL before rotating passphrase.')
                            return
                          }
                          if (!rotatePass || rotatePass.trim().length < 8) {
                            flash('Use a new passphrase of at least 8 characters.')
                            return
                          }
                          if (!isOnline()) {
                            flash('Go online to rotate passphrase — the remote must be pushed now.')
                            return
                          }
                          setRotateBusy(true)
                          try {
                            const pushed = await pushSync(syncCfg.remoteUrl, rotatePass)
                            const remember = Boolean(syncCfg.rememberPassphrase) || hasRememberedSyncPassphrase()
                            const mode: RememberPassphraseMode = remember
                              ? rememberMode === 'session'
                                ? 'forever'
                                : rememberMode
                              : 'session'
                            setSessionSyncPassphrase(rotatePass, {
                              remember,
                              rememberMode: mode,
                            })
                            setSyncPass(rotatePass)
                            setRememberMode(mode)
                            const next = {
                              ...loadSyncConfig(),
                              ...syncCfg,
                              enabled: true,
                              rememberPassphrase: remember,
                              lastSyncAt: new Date().toISOString(),
                              lastSyncError: undefined,
                              lastRemoteExportedAt: pushed.exportedAt,
                              lastRemoteBlobBytes: pushed.bytes,
                              lastPushBytes: pushed.bytes,
                            }
                            setSyncCfg(next)
                            saveSyncConfig(next)
                            setRotatePass('')
                            setRotatePassOpen(false)
                            flash(
                              'Passphrase rotated — remote now uses the new passphrase after successful push. Update other devices.',
                            )
                          } catch (e) {
                            flash(e instanceof Error ? e.message : 'Passphrase rotate failed')
                          } finally {
                            setRotateBusy(false)
                          }
                        })()
                      }}
                    >
                      {rotateBusy ? 'Rotating…' : 'Re-encrypt & push'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={rotateBusy}
                      onClick={() => {
                        setRotatePass('')
                        setRotatePassOpen(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
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
            <div
              className="sync-health-dashboard mb-4 max-w-2xl border border-border p-4 space-y-2"
              role="region"
              aria-label="Sync health"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle">
                Sync health
              </p>
              <ul className="text-xs text-text-muted space-y-1.5 font-light">
                <li>
                  Status:{' '}
                  <span className="text-text font-medium">
                    {autoSyncStatus.state}
                    {autoSyncStatus.message ? ` — ${autoSyncStatus.message}` : ''}
                  </span>
                </li>
                <li>
                  Last sync:{' '}
                  <span className="text-text font-medium">
                    {syncCfg.lastSyncAt
                      ? new Date(syncCfg.lastSyncAt).toLocaleString('en-GB')
                      : 'Never'}
                  </span>
                  {autoSyncStatus.lastAt && syncCfg.lastSyncAt !== autoSyncStatus.lastAt
                    ? ` · auto ${new Date(autoSyncStatus.lastAt).toLocaleString('en-GB')}`
                    : ''}
                </li>
                <li>
                  Remote blob:{' '}
                  <span className="text-text font-medium">
                    {formatRemoteBlobAge(syncCfg.lastRemoteExportedAt) ?? 'Unknown age'}
                  </span>
                  {formatSyncPayloadBytes(
                    syncCfg.lastRemoteBlobBytes ?? syncCfg.lastPushBytes ?? syncCfg.lastPullBytes,
                  )
                    ? ` · approx ${formatSyncPayloadBytes(
                        syncCfg.lastRemoteBlobBytes ?? syncCfg.lastPushBytes ?? syncCfg.lastPullBytes,
                      )} encrypted`
                    : ''}
                </li>
                <li>
                  Passphrase:{' '}
                  <span className="text-text font-medium">
                    {syncPass || getSessionSyncPassphrase()
                      ? syncCfg.rememberPassphrase
                        ? 'In session · remembered'
                        : 'In session'
                      : 'Not set this session'}
                  </span>
                </li>
                <li>
                  Offline queue:{' '}
                  <span className="text-text font-medium">
                    {queue.length === 0
                      ? 'Empty'
                      : `${queue.length} job(s) · ${jobsReadyToFlush(queue).length} ready`}
                  </span>
                </li>
                <li>
                  Quote Worker:{' '}
                  <span className="text-text font-medium">
                    {quoteHealthHint ?? (quoteHealthOk ? 'Healthy' : 'No recent checks')}
                  </span>
                </li>
                {syncCfg.lastSyncError ? (
                  <li className="text-accent" role="alert">
                    Last error: {syncCfg.lastSyncError}
                  </li>
                ) : null}
                {isAutoSyncPaused(syncCfg) ? (
                  <li>
                    Paused until{' '}
                    <span className="text-text font-medium">
                      {new Date(syncCfg.pausedUntil!).toLocaleString('en-GB')}
                    </span>
                  </li>
                ) : null}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                {isAutoSyncPaused(syncCfg) ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      const next = resumeAutoSync({ toast: true })
                      setSyncCfg(next)
                      flash('Sync resumed')
                    }}
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      const next = pauseAutoSync(3_600_000)
                      setSyncCfg(next)
                      flash('Auto-sync paused for 1 hour.')
                    }}
                  >
                    Pause 1 hour
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    void (async () => {
                      try {
                        const result = await shareSyncDiagnostics(syncCfg, deviceNickname)
                        if (result === 'shared') flash('Sync diagnostics shared.')
                        else if (result === 'copied') flash('Sync diagnostics copied.')
                        else if (result !== 'cancelled') flash('Could not share diagnostics here.')
                      } catch {
                        flash('Could not share diagnostics here.')
                      }
                    })()
                  }}
                  title="Share diagnostics: blob age, encrypted size, device nickname"
                >
                  Share diagnostics
                </button>
              </div>
            </div>
          )}
          {(syncCfg.enabled || autoSyncStatus.state !== 'disabled') && (
            <p className="text-xs text-text-subtle mb-4 sr-only" role="status">
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
                    const pushed = await pushSync(syncCfg.remoteUrl, syncPass)
                    const next = {
                      ...syncCfg,
                      enabled: true,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                      lastRemoteExportedAt: pushed.exportedAt,
                      lastRemoteBlobBytes: pushed.bytes,
                      lastPushBytes: pushed.bytes,
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
                    setSyncCfg(loadSyncConfig())
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
                      const stats = loadSyncConfig()
                      const next = {
                        ...syncCfg,
                        lastSyncAt: new Date().toISOString(),
                        lastSyncError: undefined,
                        lastMergeCount: r.merged,
                        lastRemoteExportedAt: stats.lastRemoteExportedAt,
                        lastRemoteBlobBytes: stats.lastRemoteBlobBytes,
                        lastPullBytes: stats.lastPullBytes,
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
              className="btn-ghost"
              onClick={() => {
                void (async () => {
                  if (!syncPass || !syncCfg.remoteUrl) {
                    flash('Need remote URL and passphrase for dry-run.')
                    return
                  }
                  try {
                    const preview = await previewPull(syncCfg.remoteUrl, syncPass)
                    // Dry-run: stage preview for review UI; do not write local data
                    setPendingMerge(preview)
                    setConflicts(preview.conflicts)
                    setConflictChoices({})
                    const newCount = preview.portfolios.filter((p) => p.isNew).length
                    const changed = preview.portfolios.length - newCount
                    const summary = [
                      `Dry-run pull (nothing written)`,
                      `${preview.portfolios.length} portfolio(s)`,
                      newCount ? `${newCount} new` : null,
                      changed ? `${changed} existing` : null,
                      preview.conflicts.length
                        ? `${preview.conflicts.length} conflict(s)`
                        : 'no conflicts',
                      preview.documentBlobs?.length
                        ? `${preview.documentBlobs.length} attachment(s)`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    setDryRunSummary(summary)
                    setSyncCfg(loadSyncConfig())
                    flash(summary)
                  } catch (e) {
                    setDryRunSummary(null)
                    flash(e instanceof Error ? e.message : 'Dry-run pull failed')
                  }
                })()
              }}
            >
              Dry-run pull
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
                  await forceSyncNow()
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
                    const stats = loadSyncConfig()
                    const next = {
                      ...syncCfg,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                      lastMergeCount: r.merged,
                      lastRemoteExportedAt: stats.lastRemoteExportedAt,
                      lastRemoteBlobBytes: stats.lastRemoteBlobBytes,
                      lastPullBytes: stats.lastPullBytes,
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
          {dryRunSummary ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2" role="status">
              {dryRunSummary}
              {' · '}
              <button
                type="button"
                className="underline"
                onClick={() => setDryRunSummary(null)}
              >
                Dismiss
              </button>
            </p>
          ) : null}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-subtle">
                  Recent sync activity
                </p>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter sync activity">
                  {(
                    [
                      ['all', 'All'],
                      ['this', 'This device'],
                      ['others', 'Others'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`btn-ghost btn-sm min-h-9 px-2 text-[11px] ${
                        syncActivityFilter === id ? 'text-accent border-accent' : ''
                      }`}
                      aria-pressed={syncActivityFilter === id}
                      onClick={() => setSyncActivityFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-1.5">
                {syncActivity
                  .filter((e) => {
                    if (syncActivityFilter === 'all') return true
                    const local = getLocalDeviceHint()
                    const hint = (e.deviceHint || '').trim()
                    const isThis =
                      !hint ||
                      hint === local ||
                      hint === deviceNickname ||
                      (deviceNickname.length > 0 && hint.startsWith(deviceNickname.slice(0, 8)))
                    return syncActivityFilter === 'this' ? isThis : !isThis
                  })
                  .slice(0, 8)
                  .map((e) => (
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
                    {e.deviceHint ? (
                      <span className="text-text-subtle"> · {e.deviceHint.slice(0, 24)}</span>
                    ) : null}
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
                  <span className="normal-case tracking-normal font-medium text-text-muted ml-2">
                    oldest {formatOfflineJobAge(oldestOfflineJobAgeMs(queue))}
                  </span>
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
                        let deferred = 0
                        for (const job of loadOfflineQueue()) {
                          if (!isOfflineJobReady(job)) {
                            deferred++
                            continue
                          }
                          if (job.type === 'quote_refresh') {
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
                              markOfflineJobFailed(
                                job.id,
                                e instanceof Error ? e.message : 'Flush failed',
                              )
                              flash(e instanceof Error ? e.message : 'Flush failed — will retry with backoff')
                              failed = true
                              break
                            }
                          }
                        }
                        setQueue(loadOfflineQueue())
                        if (!failed) {
                          const bits = [`Flushed ${flushed} sync job(s)`]
                          if (quotesSkipped) bits.push(`cleared ${quotesSkipped} quote job(s)`)
                          if (deferred) bits.push(`${deferred} waiting on backoff`)
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
              <ul className="text-sm text-text-muted space-y-2">
                {queue.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {j.type.replace('_', ' ')} · {new Date(j.createdAt).toLocaleString('en-GB')}
                      {' · '}
                      {formatOfflineJobAge(Date.now() - new Date(j.createdAt).getTime())}
                      {j.attempts ? ` · try ${j.attempts}` : ''}
                      {j.nextRetryAt && !isOfflineJobReady(j)
                        ? ` · retry after ${new Date(j.nextRetryAt).toLocaleTimeString('en-GB')}`
                        : ''}
                      {j.note ? ` — ${j.note}` : ''}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {j.nextRetryAt && !isOfflineJobReady(j) ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm min-h-11"
                          onClick={() => setQueue(retryOfflineJobNow(j.id))}
                        >
                          Retry now
                        </button>
                      ) : null}
                      {(j.attempts ?? 0) > 0 && j.note ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm min-h-11"
                          onClick={() => {
                            void (async () => {
                              try {
                                const result = await shareOfflineJobError(j)
                                if (result === 'shared') flash('Offline job error shared.')
                                else if (result === 'copied') flash('Offline job error copied.')
                                else if (result !== 'cancelled') flash('Could not share offline job error.')
                              } catch {
                                flash('Could not share offline job error.')
                              }
                            })()
                          }}
                        >
                          Share error
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost btn-sm min-h-11"
                        onClick={() => setQueue(removeOfflineJob(j.id))}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conflicts.length > 0 && (
            <div id="sync-conflicts-panel" className="mt-6 border border-border p-4 space-y-3" tabIndex={-1}>
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
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    downloadConflictSummary(conflicts)
                    flash('Downloaded conflict summary.')
                  }}
                >
                  Export summary
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    void (async () => {
                      const r = await shareConflictSummary(conflicts)
                      if (r === 'shared') flash('Shared conflict summary.')
                      else if (r === 'downloaded') flash('Downloaded conflict summary.')
                    })()
                  }}
                >
                  Share summary
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

          <p className="text-sm text-text-muted font-light mb-3 mt-8 max-w-2xl">
            <span className="text-text font-medium">Larger text</span> scales prices, holdings, and
            Markets figures for easier reading (Dynamic Type–style). Also in{' '}
            <a href="#accessibility" className="text-accent font-medium">
              Accessibility
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Larger text">
            <button
              type="button"
              className={largeText ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={largeText}
              onClick={() => {
                applyLargeTextDom(true)
                saveLargeText(true)
                setLargeTextState(true)
                flash('Larger text on.')
              }}
            >
              Larger text On
            </button>
            <button
              type="button"
              className={!largeText ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={!largeText}
              onClick={() => {
                applyLargeTextDom(false)
                saveLargeText(false)
                setLargeTextState(false)
                flash('Larger text off.')
              }}
            >
              Larger text Off
            </button>
          </div>
        </SettingsSection>

        <SettingsSection id="accessibility" eyebrow="Accessibility" title="Reading & motion">
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Preferences persist as <span className="text-text font-medium">mydsp_a11y_*</span> keys
            and apply html classes on load. Larger text also lives under Appearance.
          </p>

          <p className="text-sm text-text-muted font-light mb-3 max-w-2xl">
            <span className="text-text font-medium">Larger text</span> — same control as{' '}
            <a href="#appearance" className="text-accent font-medium">
              Appearance
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Larger text accessibility">
            <button
              type="button"
              className={largeText ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={largeText}
              onClick={() => {
                applyLargeTextDom(true)
                saveLargeText(true)
                setLargeTextState(true)
                flash('Larger text on.')
              }}
            >
              On
            </button>
            <button
              type="button"
              className={!largeText ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={!largeText}
              onClick={() => {
                applyLargeTextDom(false)
                saveLargeText(false)
                setLargeTextState(false)
                flash('Larger text off.')
              }}
            >
              Off
            </button>
          </div>

          <p className="text-sm text-text-muted font-light mb-3 max-w-2xl">
            <span className="text-text font-medium">Respect reduced motion</span> overrides system
            preference and disables animations app-wide (
            <code className="text-xs">mydsp_a11y_reduced_motion</code>).
          </p>
          <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Reduced motion override">
            <button
              type="button"
              className={a11yReducedMotion ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={a11yReducedMotion}
              onClick={() => {
                saveA11yReducedMotion(true)
                applyA11yReducedMotionDom(true)
                setA11yReducedMotion(true)
                window.dispatchEvent(new Event('mydsp-a11y-change'))
                flash('Reduced motion override on.')
              }}
            >
              On
            </button>
            <button
              type="button"
              className={!a11yReducedMotion ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={!a11yReducedMotion}
              onClick={() => {
                saveA11yReducedMotion(false)
                applyA11yReducedMotionDom(false)
                setA11yReducedMotion(false)
                window.dispatchEvent(new Event('mydsp-a11y-change'))
                flash('Reduced motion override off.')
              }}
            >
              Off
            </button>
          </div>

          <p className="text-sm text-text-muted font-light mb-3 max-w-2xl">
            <span className="text-text font-medium">High contrast muted text</span> strengthens
            secondary copy contrast (
            <code className="text-xs">mydsp_a11y_high_contrast</code>).
          </p>
          <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="High contrast muted text">
            <button
              type="button"
              className={a11yHighContrast ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={a11yHighContrast}
              onClick={() => {
                saveA11yHighContrast(true)
                applyA11yHighContrastDom(true)
                setA11yHighContrast(true)
                flash('High contrast muted text on.')
              }}
            >
              On
            </button>
            <button
              type="button"
              className={!a11yHighContrast ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={!a11yHighContrast}
              onClick={() => {
                saveA11yHighContrast(false)
                applyA11yHighContrastDom(false)
                setA11yHighContrast(false)
                flash('High contrast muted text off.')
              }}
            >
              Off
            </button>
          </div>

          <p className="text-sm text-text-muted font-light mb-3 max-w-2xl">
            <span className="text-text font-medium">Colour-blind safe charts</span> switches
            allocation rings to a blue / orange / vermillion-safe palette (
            <code className="text-xs">mydsp_a11y_chart_cb</code>).
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Colour-blind safe charts">
            <button
              type="button"
              className={a11yChartCb ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={a11yChartCb}
              onClick={() => {
                saveA11yChartColourBlind(true)
                setA11yChartCb(true)
                flash('Colour-blind safe chart palette on — reopen charts to apply.')
              }}
            >
              On
            </button>
            <button
              type="button"
              className={!a11yChartCb ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              aria-pressed={!a11yChartCb}
              onClick={() => {
                saveA11yChartColourBlind(false)
                setA11yChartCb(false)
                flash('Default chart palette restored.')
              }}
            >
              Off
            </button>
          </div>
        </SettingsSection>

        <SettingsSection
          id="layout"
          eyebrow="Layout"
          title="Sidebar & bottom nav"
          className={layoutFlash ? 'settings-section-flash' : ''}
        >
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

          <div className="mb-8 max-w-xl">
            <p className="label-uppercase mb-2">Bottom navigation (phone &amp; tablet)</p>
            <p className="text-sm text-text-muted font-light mb-4 leading-relaxed">
              <span className="text-text font-medium">Overview</span> and{' '}
              <span className="text-text font-medium">Settings</span> stay fixed at each end. Choose
              the three middle tabs — default is Markets · To Do's · Equities (same on iPhone and
              iPad).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {([0, 1, 2] as const).map((slot) => (
                <label key={slot} className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
                  Slot {slot + 1}
                  <select
                    className="mt-2 w-full normal-case tracking-normal font-medium text-sm"
                    value={bottomMiddle[slot] ?? DEFAULT_BOTTOM_NAV_MIDDLE[slot]}
                    aria-label={`Bottom nav middle slot ${slot + 1}`}
                    onChange={(e) => {
                      const next = [...bottomMiddle]
                      const chosen = e.target.value
                      // Swap if the path is already used in another slot
                      const other = next.findIndex((p, i) => i !== slot && p === chosen)
                      if (other >= 0) next[other] = next[slot] ?? DEFAULT_BOTTOM_NAV_MIDDLE[slot]
                      next[slot] = chosen
                      saveBottomNavMiddleSlots(next)
                      setBottomMiddle(loadBottomNavMiddleSlots())
                      flash('Bottom nav updated.')
                    }}
                  >
                    {Object.values(BOTTOM_NAV_CATALOG)
                      .filter((item) => item.to !== '/' && item.to !== '/settings')
                      .map((item) => (
                        <option key={item.to} value={item.to}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-xs text-text-subtle mb-3 font-light">
              Preview:{' '}
              <span className="text-text font-medium">
                Overview ·{' '}
                {bottomMiddle
                  .map((p) => BOTTOM_NAV_CATALOG[p]?.label ?? p)
                  .join(' · ')}{' '}
                · Settings
              </span>
            </p>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                resetBottomNavMiddleSlots()
                setBottomMiddle(loadBottomNavMiddleSlots())
                flash("Bottom nav reset to Markets · To Do's · Equities.")
              }}
            >
              Reset bottom nav defaults
            </button>
          </div>

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
            Same lock on <span className="text-text font-medium">iPhone and iPad</span>: enable a
            4-digit PIN, then register {getBiometricLabel()} so unlock leads with Face ID. PIN is
            always the fallback if Face ID is cancelled or unavailable. Security stays on this
            device and is not included in cloud backups. Use the installed PWA on HTTPS (e.g.
            workers.dev) — Face ID needs a secure context.
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
                  flash('PIN enabled — register Face ID next, then lock.')
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
                  onClick={() => setDisablePinOpen(true)}
                >
                  Disable PIN
                </button>
                <button type="button" className="btn-ghost" onClick={() => lock()}>
                  Lock now
                </button>
                <PinConfirmModal
                  open={disablePinOpen}
                  title="Disable PIN"
                  subtitle="Enter your 4-digit PIN to turn off lock"
                  pinHash={sec.pinHash}
                  onClose={() => setDisablePinOpen(false)}
                  onVerified={() => {
                    persistSecurity({
                      ...sec,
                      pinEnabled: false,
                      pinHash: '',
                      biometricEnabled: false,
                    })
                    clearBiometricCred()
                    setDisablePinOpen(false)
                    flash('PIN disabled.')
                  }}
                />
              </>
            )}
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Biometric unlock timeout
          </label>
          <select
            className="max-w-xs mb-2"
            value={sec.autoLockMinutes}
            aria-label="Biometric unlock timeout"
            onChange={(e) => {
              const autoLockMinutes = Number(e.target.value)
              persistSecurity({ ...sec, autoLockMinutes })
              flash('Unlock timeout updated.')
            }}
          >
            {[
              { m: 0, label: 'Immediate' },
              { m: 1, label: '1 min' },
              { m: 5, label: '5 min' },
              { m: 15, label: '15 min' },
            ].map(({ m, label }) => (
              <option key={m} value={m}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-subtle mb-6 max-w-xl">
            Immediate locks when you leave the app. Timed options also lock after idle. Face ID / PIN
            unlock resets the idle timer.
          </p>
          <div className="flex flex-wrap gap-3 items-start">
            <button
              type="button"
              className="btn-primary"
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
                    flash(`${getBiometricLabel()} registered — it will lead unlock; PIN is fallback.`)
                  } else flash(`${getBiometricLabel()} unavailable or cancelled.`)
                })()
              }}
            >
              {sec.biometricEnabled
                ? `Re-register ${getBiometricLabel()}`
                : `Enable ${getBiometricLabel()} (recommended)`}
            </button>
            {sec.biometricEnabled ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  clearBiometricCred()
                  persistSecurity({ ...sec, biometricEnabled: false })
                  flash(`${getBiometricLabel()} disabled — PIN-only unlock.`)
                }}
              >
                Disable {getBiometricLabel()}
              </button>
            ) : null}
          </div>
          <p className="text-xs text-text-subtle mt-3 max-w-xl">
            {isBiometricSupported()
              ? sec.biometricEnabled
                ? `Lock screen opens with “Unlock with ${getBiometricLabel()}” first (tap once — iOS requires a gesture). Use PIN if Face ID fails.`
                : `PIN works now. Tap Enable ${getBiometricLabel()} so Face ID leads unlock on iPhone and iPad.`
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
            <div
              className="quiet-hours-timeline"
              aria-label="Quiet hours preview"
            >
              {(() => {
                const start = notifSettings.quietHoursStart ?? '22:00'
                const end = notifSettings.quietHoursEnd ?? '07:00'
                const segs = quietSegments(start, end)
                const marker = nowPct()
                const quietNow = isInQuietWindow(start, end)
                return (
                  <>
                    <div className="relative h-3 rounded-sm bg-surface-hover border border-border overflow-hidden">
                      {segs.map((seg, i) => (
                        <div
                          key={i}
                          className="absolute inset-y-0 bg-accent/35"
                          style={{
                            left: `${seg.startPct}%`,
                            width: `${Math.max(0, seg.endPct - seg.startPct)}%`,
                          }}
                        />
                      ))}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-text z-10"
                        style={{ left: `calc(${marker}% - 1px)` }}
                        title="Now"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-text-subtle mt-1 tabular-nums">
                      <span>00:00</span>
                      <span>12:00</span>
                      <span>24:00</span>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 font-light">
                      {quietNow
                        ? `Quiet now · banners off until ${end}`
                        : `Active now · quiet ${start}–${end}`}
                    </p>
                  </>
                )
              })()}
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
              <label className="flex items-center justify-between gap-4 min-h-11 mb-3">
                <span className="text-sm font-medium">
                  YouTube upload alerts
                  <span className="block text-xs text-text-muted font-light mt-0.5">
                    Bell (+ optional desktop banner) when favourite channels publish
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={notifSettings.categories['youtube-uploads'] !== false}
                  onChange={(e) => {
                    notificationManager.updateSettings({
                      categories: { 'youtube-uploads': e.target.checked },
                    })
                    flash(e.target.checked ? 'YouTube upload alerts on.' : 'YouTube upload alerts muted.')
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

            <div className="pt-4 border-t border-border">
              <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
                Holdings drift alert
              </p>
              <p className="text-xs text-text-muted font-light mb-3">
                Amber banner on Equities / Crypto when Markets live differs from the holding price by
                more than this % (default {DEFAULT_HOLDINGS_DRIFT_PCT}%).
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium inline-flex items-center gap-2">
                  Threshold %
                  <input
                    type="number"
                    min={0.5}
                    max={50}
                    step={0.5}
                    className="w-20 text-sm"
                    value={driftPct}
                    aria-label="Holdings drift threshold percent"
                    onChange={(e) => setDriftPct(Number(e.target.value) || DEFAULT_HOLDINGS_DRIFT_PCT)}
                    onBlur={() => {
                      saveHoldingsDriftThresholdPct(driftPct)
                      setDriftPct(loadHoldingsDriftThresholdPct())
                      flash('Drift threshold saved.')
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    saveHoldingsDriftThresholdPct(DEFAULT_HOLDINGS_DRIFT_PCT)
                    setDriftPct(DEFAULT_HOLDINGS_DRIFT_PCT)
                    flash('Drift threshold reset.')
                  }}
                >
                  Reset {DEFAULT_HOLDINGS_DRIFT_PCT}%
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
                Portfolio concentration alert
              </p>
              <p className="text-xs text-text-muted font-light mb-3">
                Amber banner on Equities / Crypto when any included holding exceeds this % of
                included portfolio value (default {DEFAULT_PORTFOLIO_CONCENTRATION_PCT}%).
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium inline-flex items-center gap-2">
                  Threshold %
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    className="w-20 text-sm"
                    value={concentrationPct}
                    aria-label="Portfolio concentration threshold percent"
                    onChange={(e) =>
                      setConcentrationPct(
                        Number(e.target.value) || DEFAULT_PORTFOLIO_CONCENTRATION_PCT,
                      )
                    }
                    onBlur={() => {
                      savePortfolioConcentrationThresholdPct(concentrationPct)
                      setConcentrationPct(loadPortfolioConcentrationThresholdPct())
                      flash('Concentration threshold saved.')
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    savePortfolioConcentrationThresholdPct(DEFAULT_PORTFOLIO_CONCENTRATION_PCT)
                    setConcentrationPct(DEFAULT_PORTFOLIO_CONCENTRATION_PCT)
                    flash('Concentration threshold reset.')
                  }}
                >
                  Reset {DEFAULT_PORTFOLIO_CONCENTRATION_PCT}%
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
          <label className="flex items-start gap-3 cursor-pointer mb-6 max-w-2xl">
            <input
              type="checkbox"
              className="mt-1"
              checked={showMarketsTagYield}
              onChange={(e) => {
                const on = e.target.checked
                setShowMarketsTagYield(on)
                saveShowMarketsTagYieldChips(on)
                flash(on ? 'Markets tag + Yield % chips shown.' : 'Markets tag + Yield % chips hidden.')
              }}
            />
            <span>
              <span className="text-sm font-semibold block">Show Markets tag + Yield % chips</span>
              <span className="text-xs text-text-muted font-light">
                Device-local. When on, Markets shows Core/Speculative/Income tag filters and a Yield
                % sort chip for equities.
              </span>
            </span>
          </label>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl leading-relaxed">
            Quotes always try the best live source first, then fail over automatically:
          </p>
          <ul className="text-sm text-text-muted font-light mb-6 max-w-2xl list-disc list-inside space-y-1.5 leading-relaxed">
            <li>
              <span className="text-text font-medium">Equities</span> — Finnhub (with your free
              key) → Yahoo Finance via CORS proxies
            </li>
            <li>
              <span className="text-text font-medium">Commodities</span> — Yahoo futures/spot
              (GC=F gold, SI=F silver, HG=F copper) → GBP via FX
            </li>
            <li>
              <span className="text-text font-medium">Crypto</span> — CoinGecko → Yahoo / CoinCap /
              Coinbase
            </li>
            <li>
              <span className="text-text font-medium">Indices &amp; FX</span> — Yahoo first, with
              Finnhub / Frankfurter backups
            </li>
          </ul>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Markets, holdings refresh, and Compare all share this cascade. Use the header Refresh
            (or pull-to-refresh on Today / Markets / Equities / Crypto / News) to pull the latest.
            Finnhub covers 24H / 1W / 1M / 12M equity windows when the key works.
          </p>

          <div className="surface-nested p-4 mb-6 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
              Get a free Finnhub API key
            </p>
            <ol className="text-sm text-text-muted font-light space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Open{' '}
                <a
                  href="https://finnhub.io/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent font-medium hover:underline"
                >
                  finnhub.io/register
                </a>{' '}
                and create a free account
              </li>
              <li>
                In the Finnhub dashboard, copy your API key (Dashboard → API Key)
              </li>
              <li>Paste it below and leave the field — it saves on blur</li>
              <li>Refresh Markets / prices — equities should prefer Finnhub when the key works</li>
            </ol>
            <p className="text-xs text-text-subtle mt-3 leading-relaxed">
              Free tier is enough for personal use. Without a key, equities still load via Yahoo;
              crypto and commodities never need Finnhub.
            </p>
            {!hasFinnhubKey(data) ? (
              <button
                type="button"
                className="btn-secondary btn-sm mt-4 min-h-11"
                onClick={() => {
                  setData((prev) => {
                    const next = ensureFinnhubSetupTodo(prev)
                    return next ?? prev
                  })
                  flash("Added a high-priority To Do — Add Finnhub API key (due today).")
                }}
              >
                Remind me — add Finnhub key to To Do&apos;s
              </button>
            ) : null}
          </div>

          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Finnhub API key
          </label>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              key={`finnhub-${activeId}`}
              type="password"
              autoComplete="off"
              placeholder="Paste key from finnhub.io dashboard"
              className="max-w-md"
              defaultValue={data.settings.finnhubKey ?? ''}
              onBlur={(e) => {
                const key = e.target.value.trim()
                setData((prev) => {
                  const patched = {
                    ...prev,
                    settings: { ...prev.settings, finnhubKey: key || undefined },
                  }
                  return key ? completeFinnhubSetupTodo(patched) : patched
                })
                try {
                  if (key) localStorage.setItem('finnhub_key', key)
                  else localStorage.removeItem('finnhub_key')
                } catch {
                  /* ignore */
                }
                if (!key) {
                  flash('Finnhub key cleared.')
                  return
                }
                flash('Finnhub key saved — probing…')
                void probeFinnhubKey(key).then((result) => {
                  if (result.ok) {
                    recordProviderSuccess('finnhub')
                    flash(`Finnhub key OK — ${result.detail}`)
                  } else {
                    recordProviderFailure('finnhub', result.detail)
                    flash(`Finnhub probe failed — ${result.detail}`)
                  }
                })
              }}
            />
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Provider health (this session)
          </p>
          <ul className="text-xs text-text-muted font-light space-y-1 mb-2 max-w-xl">
            {getMarketsProviderHealth().map((row) => (
              <li key={row.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="text-text font-medium capitalize min-w-[5.5rem]">{row.id}</span>
                <span>
                  {row.consecutiveFailures > 0
                    ? `${row.consecutiveFailures} fail(s)${row.lastError ? ` — ${row.lastError}` : ''}`
                    : row.lastSuccessAt
                      ? `OK · ${new Date(row.lastSuccessAt).toLocaleTimeString()}`
                      : 'No hits yet'}
                </span>
              </li>
            ))}
          </ul>
          {formatMarketsProviderHealthHint() ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 max-w-xl">
              {formatMarketsProviderHealthHint()}
            </p>
          ) : (
            <p className="text-xs text-text-subtle max-w-xl">
              All relays healthy (or not yet sampled this session).
            </p>
          )}
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
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Run the on-device{' '}
            <Link to="/smoke" className="text-accent font-medium">
              smoke checklist
            </Link>{' '}
            to verify sync, Markets refresh, backup, and PWA install.
          </p>
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
            Print-ready PDFs and CSV downloads for portfolio, spending, goals, jobs, and To Do's —
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

        <SettingsSection id="whats-new" eyebrow="What’s new" title="Release notes archive">
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Highlights from the last five MyDSP versions. Also linked from the update banner when a
            new build is ready.
          </p>
          <WhatsNewArchive limit={5} />
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
      </div>

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary settings actions">
        <button
          type="button"
          className="btn-primary btn-sm settings-sync-thumb"
          onClick={() => {
            void (async () => {
              try {
                await forceSyncNow()
                flash('Sync now finished.')
              } catch {
                flash('Sync failed — check Remote URL and passphrase.')
              }
            })()
          }}
        >
          Sync now
        </button>
        <Link to="/smoke" className="btn-secondary btn-sm settings-smoke-thumb">
          Smoke checklist
        </Link>
        <a href="#sync" className="btn-ghost btn-sm">
          Sync section
        </a>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />

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
