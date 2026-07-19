/** Full MyDSP workspace backups (all portfolios) — IndexedDB, keep last 10. */

import type { PortfolioMeta } from '../domain/types'
import { normalizePortfolio, toStorageShape } from '../domain/normalize'
import {
  flushSave,
  getActivePortfolioId,
  listPortfolios,
  loadPortfolio,
  savePortfolioImmediate,
  setActivePortfolioId,
} from './portfolioStore'
import { STORAGE } from './keys'
import {
  exportMarketQuotesForBackup,
  exportMarketsForBackup,
  importMarketQuotesFromBackup,
  importMarketsFromBackup,
} from './marketsStore'
import {
  exportNewsArticlesForBackup,
  exportNewsForBackup,
  importNewsArticlesFromBackup,
  importNewsFromBackup,
} from './newsStore'
import { exportNavLayoutForBackup, importNavLayoutFromBackup } from './navOrder'
import {
  exportBottomNavSlotsForBackup,
  importBottomNavSlotsFromBackup,
} from './bottomNavSlots'
import {
  exportLaunchPathForBackup,
  importLaunchPathFromBackup,
} from './launchPathStore'
import {
  exportUiPanelsForBackup,
  importUiPanelsFromBackup,
} from './uiPanelsStore'
import {
  exportSettingsSectionsForBackup,
  importSettingsSectionsFromBackup,
} from './settingsSectionsStore'
import {
  exportMarketsTagYieldForBackup,
  importMarketsTagYieldFromBackup,
} from '../domain/marketsTagYieldPref'
import {
  exportSettingsRecentJumpsForBackup,
  importSettingsRecentJumpsFromBackup,
} from '../domain/settingsSearch'
import {
  exportTaxYearForBackup,
  importTaxYearFromBackup,
} from '../domain/taxYearPref'
import {
  exportJournalFilterForBackup,
  importJournalFilterFromBackup,
} from '../domain/journalFilterPref'
import {
  exportNwSparkWindowForBackup,
  importNwSparkWindowFromBackup,
} from '../domain/nwSparkWindowPref'
import {
  exportWebhookUrlForBackup,
  importWebhookUrlFromBackup,
} from '../domain/webhookUrlPref'
import {
  exportAchievementsSeenForBackup,
  importAchievementsSeenFromBackup,
} from '../domain/achievementsSeenPref'
import {
  exportGettingStartedDismissedForBackup,
  importGettingStartedDismissedFromBackup,
} from '../domain/gettingStartedDismissedPref'
import {
  exportWhatArrivedDismissForBackup,
  importWhatArrivedDismissFromBackup,
} from '../domain/whatArrivedDismissPref'
import {
  exportTodosSortForBackup,
  importTodosSortFromBackup,
} from '../domain/todosSortPrefs'
import {
  exportJobsViewForBackup,
  importJobsViewFromBackup,
} from '../domain/jobsViewPrefs'
import {
  exportLiabilitiesRagForBackup,
  importLiabilitiesRagFromBackup,
} from '../domain/liabilitiesRagPref'
import {
  exportReviewMonthForBackup,
  importReviewMonthFromBackup,
} from '../domain/reviewMonthPref'
import {
  exportGlassModeForBackup,
  importGlassModeFromBackup,
} from '../domain/glassModePref'
import {
  exportLargeTextForBackup,
  importLargeTextFromBackup,
} from '../domain/largeTextPref'
import {
  exportThemePrefForBackup,
  importThemePrefFromBackup,
} from '../domain/themePref'
import {
  exportA11yPrefsForBackup,
  importA11yPrefsFromBackup,
} from '../domain/a11yPrefsPref'
import {
  exportYoutubeForBackup,
  exportYoutubeVideosForBackup,
  importYoutubeFromBackup,
  importYoutubeVideosFromBackup,
} from './youtubeStore'
import {
  exportIsaRemainingForBackup,
  importIsaRemainingFromBackup,
} from '../domain/isaPrefs'
import {
  exportDigestHighlightsForBackup,
  importDigestHighlightsFromBackup,
} from '../domain/digestHighlightsPrefs'
import {
  exportCompareSelectionForBackup,
  importCompareSelectionFromBackup,
} from '../domain/compareSelectionPrefs'
import {
  exportRecurringSortForBackup,
  importRecurringSortFromBackup,
} from '../domain/recurringSortPrefs'
import {
  exportHoldingsDriftForBackup,
  importHoldingsDriftFromBackup,
} from '../domain/holdingsDrift'
import {
  exportPortfolioConcentrationForBackup,
  importPortfolioConcentrationFromBackup,
} from '../domain/portfolioConcentration'
import {
  exportSpendingFiltersForBackup,
  importSpendingFiltersFromBackup,
} from '../domain/spendingFilterPrefs'
import {
  exportNewsFilterForBackup,
  importNewsFilterFromBackup,
} from '../domain/newsFilterPrefs'
import {
  exportTodosQuickFilterForBackup,
  importTodosQuickFilterFromBackup,
} from '../domain/todosQuickFilterPrefs'
import {
  exportJobsFilterForBackup,
  importJobsFilterFromBackup,
} from '../domain/jobsFilterPrefs'
import {
  exportPriceAlertThresholdsForBackup,
  importPriceAlertThresholdsFromBackup,
} from '../domain/priceAlerts'
import {
  exportCompareWeekSnapshotForBackup,
  importCompareWeekSnapshotFromBackup,
} from '../domain/compareWeekSnapshot'

// Lazy import to avoid circular deps - sync service imports backupStore
let _pushSyncLazy: ((url: string, pass: string) => Promise<unknown>) | null = null
let _loadSyncConfigLazy: (() => { remoteUrl: string; enabled: boolean } | null) | null = null
let _getSessionPassphraseLazy: (() => string | null) | null = null

async function lazyLoadSync() {
  if (_pushSyncLazy && _loadSyncConfigLazy && _getSessionPassphraseLazy) return
  try {
    const mod = await import('../services/sync/syncService')
    _pushSyncLazy = mod.pushSync
    _loadSyncConfigLazy = mod.loadSyncConfig
    const sessionMod = await import('../services/sync/sessionPassphrase')
    _getSessionPassphraseLazy = sessionMod.getSessionSyncPassphrase
  } catch {
    /* sync modules may not be available */
  }
}

const DB_NAME = 'mydsp_backups'
const STORE = 'backups'
const DB_VERSION = 1
export const MAX_BACKUPS = 10
export const LAST_BACKUP_KEY = 'mydsp_last_full_backup_day'

export interface FullBackupMeta {
  id: string
  createdAt: string
  appVersion: string
  label: string
  source: 'auto' | 'manual'
  portfolioCount: number
  activePortfolioId: string
}

export interface FullBackupRecord extends FullBackupMeta {
  portfolios: PortfolioMeta[]
  /** portfolioId → storage-shaped data */
  blobs: Record<string, unknown>
  /** Optional Markets watchlist (workspace-level) */
  markets?: unknown
  /** Optional last-good Markets quotes (by ticker id) — syncs live prints across devices */
  marketQuotes?: unknown
  /** Optional News tags / feed prefs (workspace-level) */
  news?: unknown
  /** Optional last-good News headlines cache (Top + By ticker) */
  newsArticles?: unknown
  /** Optional YouTube favourite channels (workspace-level) */
  youtube?: unknown
  /** Optional last-good YouTube video cache */
  youtubeVideos?: unknown
  /** Optional ISA remaining override */
  isaRemaining?: unknown
  /** Optional price-alert thresholds */
  priceAlertThresholds?: unknown
  /** Optional Compare week-over-week NW baselines */
  compareWeekSnapshot?: unknown
  /** Optional weekly digest highlight edits */
  digestHighlights?: unknown
  /** Optional Compare selected portfolio ids */
  compareSelection?: unknown
  /** Optional Recurring sort preference */
  recurringSort?: unknown
  /** Optional holdings drift % threshold */
  holdingsDrift?: unknown
  /** Optional portfolio concentration % threshold */
  portfolioConcentration?: unknown
  /** Optional Spending filter prefs */
  spendingFilters?: unknown
  /** Optional News tag filter */
  newsFilter?: unknown
  /** Optional Todos quick-filter (Due today / High priority) */
  todosQuickFilter?: unknown
  /** Optional Jobs filter (incl. Needs follow-up) */
  jobsFilter?: unknown
  /** Optional sidebar Favourites / Others layout (workspace-level) */
  navLayout?: unknown
  /** Optional phone/tablet bottom-nav middle slots */
  bottomNavSlots?: unknown
  /** Optional on-launch home path */
  launchPath?: unknown
  /** Optional UI panel open/collapsed map */
  uiPanels?: unknown
  /** Optional Settings section open/collapsed map */
  settingsSections?: unknown
  /** Optional Markets tag/Yield chips visibility */
  marketsTagYield?: unknown
  /** Optional Settings recent jump chips */
  settingsRecentJumps?: unknown
  /** Optional Tax year selection */
  taxYear?: unknown
  /** Optional Journal asset filter */
  journalFilter?: unknown
  /** Optional Today NW spark window (7/30) */
  nwSparkWindow?: unknown
  /** Optional API webhook URL */
  webhookUrl?: unknown
  /** Optional achievements seen ids */
  achievementsSeen?: unknown
  /** Optional getting-started checklist dismissed */
  gettingStartedDismissed?: unknown
  /** Optional What arrived dismiss fingerprint */
  whatArrivedDismiss?: unknown
  /** Optional Todos sort preference */
  todosSort?: unknown
  /** Optional Jobs viewMode + list sort */
  jobsView?: unknown
  /** Optional Liabilities RAG filter */
  liabilitiesRag?: unknown
  /** Optional Monthly Review selected month */
  reviewMonth?: unknown
  /** Optional Glass Mode */
  glassMode?: unknown
  /** Optional large text mode */
  largeText?: unknown
  /** Optional theme preference (auto/light/dark) */
  themePref?: unknown
  /** Optional accessibility prefs blob */
  a11yPrefs?: unknown
  /** Optional file attachments (CV/PDFs) as base64 payloads */
  documentBlobs?: import('./documentBlobStore').DocumentBlobPayload[]
  documentBlobsSkipped?: number[]
  /** SHA-256 hex prefix (crypto.checksum) over canonical backup payload */
  checksum?: string
}

function backupCanonical(record: Pick<
  FullBackupRecord,
  | 'portfolios'
  | 'activePortfolioId'
  | 'blobs'
  | 'markets'
  | 'marketQuotes'
  | 'news'
  | 'newsArticles'
  | 'youtube'
  | 'youtubeVideos'
  | 'isaRemaining'
  | 'priceAlertThresholds'
  | 'compareWeekSnapshot'
  | 'digestHighlights'
  | 'compareSelection'
  | 'recurringSort'
  | 'holdingsDrift'
  | 'portfolioConcentration'
  | 'spendingFilters'
  | 'newsFilter'
  | 'todosQuickFilter'
  | 'jobsFilter'
  | 'navLayout'
  | 'bottomNavSlots'
  | 'launchPath'
  | 'uiPanels'
  | 'settingsSections'
  | 'marketsTagYield'
  | 'settingsRecentJumps'
  | 'taxYear'
  | 'journalFilter'
  | 'nwSparkWindow'
  | 'webhookUrl'
  | 'achievementsSeen'
  | 'gettingStartedDismissed'
  | 'whatArrivedDismiss'
  | 'todosSort'
  | 'jobsView'
  | 'liabilitiesRag'
  | 'reviewMonth'
  | 'glassMode'
  | 'largeText'
  | 'themePref'
  | 'a11yPrefs'
  | 'documentBlobs'
>): string {
  return JSON.stringify({
    portfolios: record.portfolios,
    activePortfolioId: record.activePortfolioId,
    blobs: record.blobs,
    markets: record.markets ?? null,
    marketQuotes: record.marketQuotes ?? null,
    news: record.news ?? null,
    newsArticles: record.newsArticles ?? null,
    youtube: record.youtube ?? null,
    youtubeVideos: record.youtubeVideos ?? null,
    isaRemaining: record.isaRemaining ?? null,
    priceAlertThresholds: record.priceAlertThresholds ?? null,
    compareWeekSnapshot: record.compareWeekSnapshot ?? null,
    digestHighlights: record.digestHighlights ?? null,
    compareSelection: record.compareSelection ?? null,
    recurringSort: record.recurringSort ?? null,
    holdingsDrift: record.holdingsDrift ?? null,
    portfolioConcentration: record.portfolioConcentration ?? null,
    spendingFilters: record.spendingFilters ?? null,
    newsFilter: record.newsFilter ?? null,
    todosQuickFilter: record.todosQuickFilter ?? null,
    jobsFilter: record.jobsFilter ?? null,
    navLayout: record.navLayout ?? null,
    bottomNavSlots: record.bottomNavSlots ?? null,
    launchPath: record.launchPath ?? null,
    uiPanels: record.uiPanels ?? null,
    settingsSections: record.settingsSections ?? null,
    marketsTagYield: record.marketsTagYield ?? null,
    settingsRecentJumps: record.settingsRecentJumps ?? null,
    taxYear: record.taxYear ?? null,
    journalFilter: record.journalFilter ?? null,
    nwSparkWindow: record.nwSparkWindow ?? null,
    webhookUrl: record.webhookUrl ?? null,
    achievementsSeen: record.achievementsSeen ?? null,
    gettingStartedDismissed: record.gettingStartedDismissed ?? null,
    whatArrivedDismiss: record.whatArrivedDismiss ?? null,
    todosSort: record.todosSort ?? null,
    jobsView: record.jobsView ?? null,
    liabilitiesRag: record.liabilitiesRag ?? null,
    reviewMonth: record.reviewMonth ?? null,
    glassMode: record.glassMode ?? null,
    largeText: record.largeText ?? null,
    themePref: record.themePref ?? null,
    a11yPrefs: record.a11yPrefs ?? null,
    documentBlobs: record.documentBlobs ?? null,
  })
}

/** Compute integrity checksum for a full backup (same pattern as sync envelope). */
export async function computeFullBackupChecksum(
  record: Pick<
    FullBackupRecord,
    | 'portfolios'
    | 'activePortfolioId'
    | 'blobs'
    | 'markets'
    | 'marketQuotes'
    | 'news'
    | 'newsArticles'
    | 'youtube'
    | 'youtubeVideos'
    | 'isaRemaining'
    | 'priceAlertThresholds'
    | 'compareWeekSnapshot'
    | 'digestHighlights'
    | 'compareSelection'
    | 'recurringSort'
    | 'holdingsDrift'
    | 'portfolioConcentration'
    | 'spendingFilters'
    | 'newsFilter'
    | 'todosQuickFilter'
    | 'jobsFilter'
    | 'navLayout'
    | 'bottomNavSlots'
    | 'launchPath'
    | 'uiPanels'
    | 'settingsSections'
    | 'marketsTagYield'
    | 'settingsRecentJumps'
    | 'taxYear'
    | 'journalFilter'
    | 'nwSparkWindow'
    | 'webhookUrl'
    | 'achievementsSeen'
    | 'gettingStartedDismissed'
    | 'whatArrivedDismiss'
    | 'todosSort'
    | 'jobsView'
    | 'liabilitiesRag'
    | 'reviewMonth'
    | 'glassMode'
    | 'largeText'
    | 'themePref'
    | 'a11yPrefs'
    | 'documentBlobs'
  >,
): Promise<string> {
  const { checksum } = await import('../services/sync/crypto')
  return checksum(backupCanonical(record))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Backup DB open failed'))
  })
}

function appVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Snapshot every portfolio currently in the registry. */
export function captureFullWorkspace(): Omit<
  FullBackupRecord,
  'id' | 'createdAt' | 'label' | 'source'
> {
  flushSave()
  const portfolios = listPortfolios()
  const activePortfolioId = getActivePortfolioId()
  const blobs: Record<string, unknown> = {}
  for (const p of portfolios) {
    flushSave(p.id)
    blobs[p.id] = toStorageShape(loadPortfolio(p.id))
  }
  return {
    appVersion: appVersion(),
    portfolioCount: portfolios.length,
    activePortfolioId,
    portfolios: portfolios.map((p) => ({ ...p })),
    blobs,
    markets: exportMarketsForBackup(),
    marketQuotes: exportMarketQuotesForBackup(),
    news: exportNewsForBackup(),
    newsArticles: exportNewsArticlesForBackup(),
    youtube: exportYoutubeForBackup(),
    youtubeVideos: exportYoutubeVideosForBackup(),
    isaRemaining: exportIsaRemainingForBackup() ?? undefined,
    priceAlertThresholds: exportPriceAlertThresholdsForBackup(),
    compareWeekSnapshot: exportCompareWeekSnapshotForBackup() ?? undefined,
    digestHighlights: exportDigestHighlightsForBackup() ?? undefined,
    compareSelection: exportCompareSelectionForBackup() ?? undefined,
    recurringSort: exportRecurringSortForBackup() ?? undefined,
    holdingsDrift: exportHoldingsDriftForBackup() ?? undefined,
    portfolioConcentration: exportPortfolioConcentrationForBackup() ?? undefined,
    spendingFilters: exportSpendingFiltersForBackup() ?? undefined,
    newsFilter: exportNewsFilterForBackup() ?? undefined,
    todosQuickFilter: exportTodosQuickFilterForBackup() ?? undefined,
    jobsFilter: exportJobsFilterForBackup() ?? undefined,
    navLayout: exportNavLayoutForBackup() ?? undefined,
    bottomNavSlots: exportBottomNavSlotsForBackup() ?? undefined,
    launchPath: exportLaunchPathForBackup() ?? undefined,
    uiPanels: exportUiPanelsForBackup() ?? undefined,
    settingsSections: exportSettingsSectionsForBackup() ?? undefined,
    marketsTagYield: exportMarketsTagYieldForBackup() ?? undefined,
    settingsRecentJumps: exportSettingsRecentJumpsForBackup() ?? undefined,
    taxYear: exportTaxYearForBackup() ?? undefined,
    journalFilter: exportJournalFilterForBackup() ?? undefined,
    nwSparkWindow: exportNwSparkWindowForBackup() ?? undefined,
    webhookUrl: exportWebhookUrlForBackup() ?? undefined,
    achievementsSeen: exportAchievementsSeenForBackup() ?? undefined,
    gettingStartedDismissed: exportGettingStartedDismissedForBackup() ?? undefined,
    whatArrivedDismiss: exportWhatArrivedDismissForBackup() ?? undefined,
    todosSort: exportTodosSortForBackup() ?? undefined,
    jobsView: exportJobsViewForBackup() ?? undefined,
    liabilitiesRag: exportLiabilitiesRagForBackup() ?? undefined,
    reviewMonth: exportReviewMonthForBackup() ?? undefined,
    glassMode: exportGlassModeForBackup() ?? undefined,
    largeText: exportLargeTextForBackup() ?? undefined,
    themePref: exportThemePrefForBackup() ?? undefined,
    a11yPrefs: exportA11yPrefsForBackup() ?? undefined,
  }
}

async function putBackup(record: FullBackupRecord): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Backup put failed'))
  })
  db.close()
}

async function pruneOldBackups(): Promise<void> {
  const all = await listFullBackups()
  if (all.length <= MAX_BACKUPS) return
  const extra = all.slice(MAX_BACKUPS)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    for (const b of extra) tx.objectStore(STORE).delete(b.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Backup prune failed'))
  })
  db.close()
}

export async function createFullBackup(
  source: 'auto' | 'manual',
  label?: string,
  opts?: { skipAutoSync?: boolean },
): Promise<FullBackupMeta> {
  const snap = captureFullWorkspace()
  const createdAt = new Date().toISOString()
  const id = `bk_${createdAt.replace(/[:.]/g, '-')}_${Math.random().toString(36).slice(2, 6)}`

  let documentBlobs: import('./documentBlobStore').DocumentBlobPayload[] | undefined
  let documentBlobsSkipped: number[] | undefined
  try {
    const { collectBlobIdsFromPortfolios } = await import('./blobIds')
    const { exportDocumentBlobs } = await import('./documentBlobStore')
    const portfolios = Object.values(snap.blobs).map((raw) =>
      normalizePortfolio(raw),
    )
    const ids = collectBlobIdsFromPortfolios(portfolios)
    const exported = await exportDocumentBlobs(ids)
    documentBlobs = exported.payloads
    documentBlobsSkipped = exported.skipped
  } catch {
    /* blob export is best-effort */
  }

  const record: FullBackupRecord = {
    id,
    createdAt,
    label:
      label?.trim() ||
      (source === 'auto'
        ? `Daily backup ${createdAt.slice(0, 10)}`
        : `Manual ${createdAt.slice(0, 16).replace('T', ' ')}`),
    source,
    ...snap,
    documentBlobs,
    documentBlobsSkipped,
  }
  record.checksum = await computeFullBackupChecksum(record)
  await putBackup(record)
  await pruneOldBackups()
  try {
    localStorage.setItem(LAST_BACKUP_KEY, createdAt.slice(0, 10))
  } catch {
    /* ignore */
  }

  // Auto-sync after backup if enabled (unless explicitly skipped)
  if (!opts?.skipAutoSync && source === 'auto') {
    void attemptAutoSync().catch(() => {
      /* Sync errors should not fail the backup */
    })
  }

  return {
    id: record.id,
    createdAt: record.createdAt,
    appVersion: record.appVersion,
    label: record.label,
    source: record.source,
    portfolioCount: record.portfolioCount,
    activePortfolioId: record.activePortfolioId,
  }
}

export async function listFullBackups(): Promise<FullBackupMeta[]> {
  const db = await openDb()
  const rows = await new Promise<FullBackupRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as FullBackupRecord[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('Backup list failed'))
  })
  db.close()
  return rows
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      appVersion: r.appVersion,
      label: r.label,
      source: r.source,
      portfolioCount: r.portfolioCount,
      activePortfolioId: r.activePortfolioId,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getFullBackup(id: string): Promise<FullBackupRecord | null> {
  const db = await openDb()
  const row = await new Promise<FullBackupRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as FullBackupRecord | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('Backup get failed'))
  })
  db.close()
  return row
}

export async function deleteFullBackup(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Backup delete failed'))
  })
  db.close()
}

/** Replace entire workspace from a backup record (including document file blobs). */
export async function restoreFullWorkspace(record: FullBackupRecord): Promise<void> {
  if (record.checksum) {
    const expected = await computeFullBackupChecksum(record)
    if (expected !== record.checksum) {
      throw new Error(
        'Backup checksum mismatch — the file may be corrupted or tampered with. Restore cancelled.',
      )
    }
  }

  const keep = new Set(record.portfolios.map((p) => p.id))
  for (const p of listPortfolios()) {
    if (!keep.has(p.id) && p.id !== 'default') {
      localStorage.removeItem(STORAGE.dataKey(p.id))
    }
  }
  // Always clear default data key if restoring
  for (const p of listPortfolios()) {
    if (!keep.has(p.id)) {
      localStorage.removeItem(STORAGE.dataKey(p.id))
    }
  }
  localStorage.setItem(STORAGE.PORTFOLIOS, JSON.stringify(record.portfolios))
  for (const p of record.portfolios) {
    const raw = record.blobs[p.id]
    if (raw) {
      savePortfolioImmediate(normalizePortfolio(raw), p.id)
    }
  }
  const active = record.portfolios.some((p) => p.id === record.activePortfolioId)
    ? record.activePortfolioId
    : 'default'
  setActivePortfolioId(active)

  if (record.documentBlobs && record.documentBlobs.length > 0) {
    const { importDocumentBlobs } = await import('./documentBlobStore')
    await importDocumentBlobs(record.documentBlobs)
  }

  if (record.markets) {
    importMarketsFromBackup(record.markets)
  }
  if (record.marketQuotes) {
    importMarketQuotesFromBackup(record.marketQuotes)
  }
  if (record.news) {
    importNewsFromBackup(record.news)
  }
  if (record.newsArticles) {
    importNewsArticlesFromBackup(record.newsArticles)
  }
  if (record.youtube) {
    importYoutubeFromBackup(record.youtube)
  }
  if (record.youtubeVideos) {
    importYoutubeVideosFromBackup(record.youtubeVideos)
  }
  if (record.isaRemaining) {
    importIsaRemainingFromBackup(record.isaRemaining)
  }
  if (record.priceAlertThresholds) {
    importPriceAlertThresholdsFromBackup(record.priceAlertThresholds)
  }
  if (record.compareWeekSnapshot) {
    importCompareWeekSnapshotFromBackup(record.compareWeekSnapshot)
  }
  if (record.digestHighlights) {
    importDigestHighlightsFromBackup(record.digestHighlights)
  }
  if (record.compareSelection) {
    importCompareSelectionFromBackup(record.compareSelection)
  }
  if (record.recurringSort) {
    importRecurringSortFromBackup(record.recurringSort)
  }
  if (record.holdingsDrift) {
    importHoldingsDriftFromBackup(record.holdingsDrift)
  }
  if (record.portfolioConcentration) {
    importPortfolioConcentrationFromBackup(record.portfolioConcentration)
  }
  if (record.spendingFilters) {
    importSpendingFiltersFromBackup(record.spendingFilters)
  }
  if (record.newsFilter) {
    importNewsFilterFromBackup(record.newsFilter)
  }
  if (record.todosQuickFilter) {
    importTodosQuickFilterFromBackup(record.todosQuickFilter)
  }
  if (record.jobsFilter) {
    importJobsFilterFromBackup(record.jobsFilter)
  }
  if (record.navLayout) {
    importNavLayoutFromBackup(record.navLayout)
  }
  if (record.bottomNavSlots) {
    importBottomNavSlotsFromBackup(record.bottomNavSlots)
  }
  if (record.launchPath) {
    importLaunchPathFromBackup(record.launchPath)
  }
  if (record.uiPanels) {
    importUiPanelsFromBackup(record.uiPanels)
  }
  if (record.settingsSections) {
    importSettingsSectionsFromBackup(record.settingsSections)
  }
  if (record.marketsTagYield) {
    importMarketsTagYieldFromBackup(record.marketsTagYield)
  }
  if (record.settingsRecentJumps) {
    importSettingsRecentJumpsFromBackup(record.settingsRecentJumps)
  }
  if (record.taxYear) {
    importTaxYearFromBackup(record.taxYear)
  }
  if (record.journalFilter) {
    importJournalFilterFromBackup(record.journalFilter)
  }
  if (record.nwSparkWindow) {
    importNwSparkWindowFromBackup(record.nwSparkWindow)
  }
  if (record.webhookUrl) {
    importWebhookUrlFromBackup(record.webhookUrl)
  }
  if (record.achievementsSeen) {
    importAchievementsSeenFromBackup(record.achievementsSeen)
  }
  if (record.gettingStartedDismissed) {
    importGettingStartedDismissedFromBackup(record.gettingStartedDismissed)
  }
  if (record.whatArrivedDismiss) {
    importWhatArrivedDismissFromBackup(record.whatArrivedDismiss)
  }
  if (record.todosSort) {
    importTodosSortFromBackup(record.todosSort)
  }
  if (record.jobsView) {
    importJobsViewFromBackup(record.jobsView)
  }
  if (record.liabilitiesRag) {
    importLiabilitiesRagFromBackup(record.liabilitiesRag)
  }
  if (record.reviewMonth) {
    importReviewMonthFromBackup(record.reviewMonth)
  }
  if (record.glassMode) {
    importGlassModeFromBackup(record.glassMode)
  }
  if (record.largeText) {
    importLargeTextFromBackup(record.largeText)
  }
  if (record.themePref) {
    importThemePrefFromBackup(record.themePref)
  }
  if (record.a11yPrefs) {
    importA11yPrefsFromBackup(record.a11yPrefs)
  }
}

function fullBackupPayload(record: FullBackupRecord) {
  return {
    kind: 'mydsp-full-backup',
    version: `mydsp-${record.appVersion}`,
    exportDate: record.createdAt,
    source: 'MyDSP',
    label: record.label,
    appVersion: record.appVersion,
    activePortfolioId: record.activePortfolioId,
    portfolios: record.portfolios,
    blobs: record.blobs,
    ...(record.checksum ? { checksum: record.checksum } : {}),
    ...(record.documentBlobs && record.documentBlobs.length > 0
      ? { documentBlobs: record.documentBlobs }
      : {}),
    ...(record.documentBlobsSkipped && record.documentBlobsSkipped.length > 0
      ? { documentBlobsSkipped: record.documentBlobsSkipped }
      : {}),
    ...(record.markets ? { markets: record.markets } : {}),
    ...(record.marketQuotes ? { marketQuotes: record.marketQuotes } : {}),
    ...(record.news ? { news: record.news } : {}),
    ...(record.newsArticles ? { newsArticles: record.newsArticles } : {}),
    ...(record.youtube ? { youtube: record.youtube } : {}),
    ...(record.youtubeVideos ? { youtubeVideos: record.youtubeVideos } : {}),
    ...(record.isaRemaining ? { isaRemaining: record.isaRemaining } : {}),
    ...(record.priceAlertThresholds
      ? { priceAlertThresholds: record.priceAlertThresholds }
      : {}),
    ...(record.compareWeekSnapshot
      ? { compareWeekSnapshot: record.compareWeekSnapshot }
      : {}),
    ...(record.digestHighlights
      ? { digestHighlights: record.digestHighlights }
      : {}),
    ...(record.compareSelection
      ? { compareSelection: record.compareSelection }
      : {}),
    ...(record.recurringSort ? { recurringSort: record.recurringSort } : {}),
    ...(record.holdingsDrift ? { holdingsDrift: record.holdingsDrift } : {}),
    ...(record.portfolioConcentration
      ? { portfolioConcentration: record.portfolioConcentration }
      : {}),
    ...(record.spendingFilters ? { spendingFilters: record.spendingFilters } : {}),
    ...(record.newsFilter ? { newsFilter: record.newsFilter } : {}),
    ...(record.todosQuickFilter ? { todosQuickFilter: record.todosQuickFilter } : {}),
    ...(record.jobsFilter ? { jobsFilter: record.jobsFilter } : {}),
    ...(record.navLayout ? { navLayout: record.navLayout } : {}),
    ...(record.bottomNavSlots ? { bottomNavSlots: record.bottomNavSlots } : {}),
    ...(record.launchPath ? { launchPath: record.launchPath } : {}),
    ...(record.uiPanels ? { uiPanels: record.uiPanels } : {}),
    ...(record.settingsSections ? { settingsSections: record.settingsSections } : {}),
    ...(record.marketsTagYield ? { marketsTagYield: record.marketsTagYield } : {}),
    ...(record.settingsRecentJumps
      ? { settingsRecentJumps: record.settingsRecentJumps }
      : {}),
    ...(record.taxYear ? { taxYear: record.taxYear } : {}),
    ...(record.journalFilter ? { journalFilter: record.journalFilter } : {}),
    ...(record.nwSparkWindow ? { nwSparkWindow: record.nwSparkWindow } : {}),
    ...(record.webhookUrl ? { webhookUrl: record.webhookUrl } : {}),
    ...(record.achievementsSeen ? { achievementsSeen: record.achievementsSeen } : {}),
    ...(record.gettingStartedDismissed
      ? { gettingStartedDismissed: record.gettingStartedDismissed }
      : {}),
    ...(record.whatArrivedDismiss ? { whatArrivedDismiss: record.whatArrivedDismiss } : {}),
    ...(record.todosSort ? { todosSort: record.todosSort } : {}),
    ...(record.jobsView ? { jobsView: record.jobsView } : {}),
    ...(record.liabilitiesRag ? { liabilitiesRag: record.liabilitiesRag } : {}),
    ...(record.reviewMonth ? { reviewMonth: record.reviewMonth } : {}),
    ...(record.glassMode ? { glassMode: record.glassMode } : {}),
    ...(record.largeText ? { largeText: record.largeText } : {}),
    ...(record.themePref ? { themePref: record.themePref } : {}),
    ...(record.a11yPrefs ? { a11yPrefs: record.a11yPrefs } : {}),
  }
}

export function fullBackupFilename(record: FullBackupRecord): string {
  return `mydsp-full-${record.createdAt.slice(0, 10)}.json`
}

/** File download of a full backup (unencrypted JSON). */
export function downloadFullBackupFile(record: FullBackupRecord): void {
  const blob = new Blob([JSON.stringify(fullBackupPayload(record), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fullBackupFilename(record)
  
  // iOS Safari requires the link to be in the DOM and explicitly clicked
  if (isIOS()) {
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Clean up after a delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  } else {
    a.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Detect iOS devices (iPhone, iPad, iPod).
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Check if Web Share API is available (good indicator for mobile/native share support).
 */
export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator
}

/**
 * Share backup file using native share sheet (iOS, Android, etc).
 * Falls back to download if not supported.
 */
export async function shareBackupFile(record: FullBackupRecord): Promise<'shared' | 'fallback' | 'cancelled'> {
  if (!canUseNativeShare()) {
    downloadFullBackupFile(record)
    return 'fallback'
  }

  try {
    const payload = JSON.stringify(fullBackupPayload(record), null, 2)
    const name = fullBackupFilename(record)
    const blob = new Blob([payload], { type: 'application/json' })
    const file = new File([blob], name, { type: 'application/json' })
    
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean
      share: (data: { files: File[]; title?: string; text?: string }) => Promise<void>
    }

    // Check if we can share files
    if (nav.canShare && !nav.canShare({ files: [file] })) {
      downloadFullBackupFile(record)
      return 'fallback'
    }

    await nav.share({
      files: [file],
      title: 'MyDSP Backup',
      text: `${record.label} - ${record.portfolioCount} portfolio${record.portfolioCount === 1 ? '' : 's'}`,
    })
    
    return 'shared'
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    downloadFullBackupFile(record)
    return 'fallback'
  }
}

/**
 * Save backup into a user-picked folder (Chrome/Edge File System Access API).
 * Falls back to normal download when unsupported (Safari / iOS → Downloads / Files / iCloud).
 */
export async function saveFullBackupToFolder(
  record: FullBackupRecord,
): Promise<'saved' | 'fallback' | 'cancelled'> {
  const payload = JSON.stringify(fullBackupPayload(record), null, 2)
  const name = fullBackupFilename(record)
  const w = window as Window & {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof w.showDirectoryPicker !== 'function') {
    downloadFullBackupFile(record)
    return 'fallback'
  }
  try {
    const dir = await w.showDirectoryPicker({ mode: 'readwrite' })
    const file = await dir.getFileHandle(name, { create: true })
    const writable = await file.createWritable()
    await writable.write(payload)
    await writable.close()
    return 'saved'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    downloadFullBackupFile(record)
    return 'fallback'
  }
}

export function parseFullBackupFile(raw: unknown): FullBackupRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind !== 'mydsp-full-backup') return null
  if (!Array.isArray(o.portfolios) || !o.blobs || typeof o.blobs !== 'object') return null
  return {
    id: typeof o.id === 'string' ? o.id : `import_${Date.now()}`,
    createdAt: typeof o.exportDate === 'string' ? o.exportDate : new Date().toISOString(),
    appVersion: typeof o.appVersion === 'string' ? o.appVersion : 'unknown',
    label: typeof o.label === 'string' ? o.label : 'Imported backup',
    source: 'manual',
    portfolioCount: (o.portfolios as PortfolioMeta[]).length,
    activePortfolioId:
      typeof o.activePortfolioId === 'string' ? o.activePortfolioId : 'default',
    portfolios: o.portfolios as PortfolioMeta[],
    blobs: o.blobs as Record<string, unknown>,
    documentBlobs: Array.isArray(o.documentBlobs)
      ? (o.documentBlobs as import('./documentBlobStore').DocumentBlobPayload[])
      : undefined,
    documentBlobsSkipped: Array.isArray(o.documentBlobsSkipped)
      ? (o.documentBlobsSkipped as number[])
      : undefined,
    markets: o.markets,
    news: o.news,
    youtube: o.youtube,
    digestHighlights: o.digestHighlights,
    compareSelection: o.compareSelection,
    recurringSort: o.recurringSort,
    holdingsDrift: o.holdingsDrift,
    portfolioConcentration: o.portfolioConcentration,
    spendingFilters: o.spendingFilters,
    newsFilter: o.newsFilter,
    todosQuickFilter: o.todosQuickFilter,
    jobsFilter: o.jobsFilter,
    navLayout: o.navLayout,
    bottomNavSlots: o.bottomNavSlots,
    launchPath: o.launchPath,
    uiPanels: o.uiPanels,
    settingsSections: o.settingsSections,
    marketsTagYield: o.marketsTagYield,
    settingsRecentJumps: o.settingsRecentJumps,
    taxYear: o.taxYear,
    journalFilter: o.journalFilter,
    nwSparkWindow: o.nwSparkWindow,
    webhookUrl: o.webhookUrl,
    achievementsSeen: o.achievementsSeen,
    gettingStartedDismissed: o.gettingStartedDismissed,
    whatArrivedDismiss: o.whatArrivedDismiss,
    todosSort: o.todosSort,
    jobsView: o.jobsView,
    liabilitiesRag: o.liabilitiesRag,
    reviewMonth: o.reviewMonth,
    glassMode: o.glassMode,
    largeText: o.largeText,
    themePref: o.themePref,
    a11yPrefs: o.a11yPrefs,
    checksum: typeof o.checksum === 'string' ? o.checksum : undefined,
  }
}

/** Run once per calendar day if no auto backup yet. */
export async function ensureDailyBackup(): Promise<FullBackupMeta | null> {
  const today = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem(LAST_BACKUP_KEY) === today) return null
  } catch {
    /* continue */
  }
  return createFullBackup('auto')
}

/**
 * Attempt auto-sync push after daily backup.
 * Silent — errors logged but not thrown.
 */
async function attemptAutoSync(): Promise<void> {
  await lazyLoadSync()
  if (!_loadSyncConfigLazy || !_pushSyncLazy || !_getSessionPassphraseLazy) return

  const cfg = _loadSyncConfigLazy()
  if (!cfg || !cfg.enabled || !cfg.remoteUrl) return

  const pass = _getSessionPassphraseLazy()
  if (!pass) return

  try {
    await _pushSyncLazy(cfg.remoteUrl, pass)
  } catch (err) {
    console.warn('[auto-sync] Push failed after daily backup:', err)
  }
}

export async function clearServiceWorkerCaches(): Promise<void> {
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  }
}
