/** Encrypted sync push/pull — optional remote URL + passphrase. */

import { normalizePortfolio, toStorageShape } from '../../domain/normalize'
import type { PortfolioData, PortfolioMeta } from '../../domain/types'
import { captureFullWorkspace } from '../../storage/backupStore'
import {
  exportMarketsForBackup,
  importMarketQuotesFromBackup,
  importMarketsFromBackup,
} from '../../storage/marketsStore'
import { shouldImportSyncedMarketQuotes } from '../../domain/marketQuotesSync'
import { importFxRatesFromBackup } from '../fx'
import {
  exportNewsForBackup,
  importNewsArticlesFromBackup,
  importNewsFromBackup,
} from '../../storage/newsStore'
import { importIsaRemainingFromBackup } from '../../domain/isaPrefs'
import { importPriceAlertThresholdsFromBackup } from '../../domain/priceAlerts'
import { importNavLayoutFromBackup } from '../../storage/navOrder'
import {
  exportYoutubeForBackup,
  importYoutubeFromBackup,
  importYoutubeVideosFromBackup,
} from '../../storage/youtubeStore'
import { satelliteShouldReplaceExtrasOnImport } from './satelliteFactorySeed'
import {
  applyFamilyHoldingsToNamedBooks,
  flushSave,
  getActivePortfolioId,
  listPortfolios,
  loadPortfolio,
  resolveLocalPortfolioId,
  savePortfolioImmediate,
  setActivePortfolioId,
  dedupePortfoliosByName,
  deletePortfolio,
  portfolioNameKey,
  hasDuplicatePortfolioNames,
  MAX_PORTFOLIOS,
} from '../../storage/portfolioStore'
import { STORAGE } from '../../storage/keys'
import { checksum, decryptJson, encryptJson, type EncryptedBlob } from './crypto'
import { setSessionSyncPassphrase } from './sessionPassphrase'
import {
  COLLECTIONS,
  conflictKey,
  detectConflicts,
  mergeWithResolutions,
  stableHash,
  type ConflictChoice,
  type ConflictCollection,
  type SyncConflict,
} from './conflicts'
import type { DocumentBlobPayload } from '../../storage/documentBlobStore'

const CONFIG_KEY = 'mydsp_sync_config'
const DEVICE_KEY = 'mydsp_device_id'
/** Last Mini book row hashes after absorb/PUT. Separate from sync config so a Settings save cannot wipe the stamp. */
const BOOK_HASH_KEY = 'mydsp_last_book_holding_hashes'
const BOOK_SCALAR_KEY = 'mydsp_last_book_scalar_hashes'
const BOOK_REGISTRY_KEY = 'mydsp_last_book_registry_names'
const PULLED_SCALAR_KEY = 'mydsp_last_pulled_scalar_hashes'
const PULLED_HASH_KEY = 'mydsp_last_pulled_holding_hashes'
const PULLED_REGISTRY_KEY = 'mydsp_last_pulled_registry_names'
const PULLED_EXTRAS_KEY = 'mydsp_last_pulled_extras_hash'

/** Portfolio fields Mini absorb REPLACE would wipe — not in COLLECTIONS. */
export const BOOK_SCALAR_FIELDS = [
  'staking',
  'family',
  'fireInputs',
  'monthlyIncome',
  'monthlyExpenses',
  'budgetGoals',
  'paidOff',
  'recurringTransactions',
  'trips',
  'splitSettings',
  'targetAllocations',
  'merchantRules',
  'history',
  'customCategories',
  'settings',
  'extras',
] as const

export interface SyncConfig {
  remoteUrl: string
  /**
   * When true, devices auto pull on resume/online and push after local edits.
   * Requires passphrase (session or remembered on this device).
   */
  enabled: boolean
  /** Persist passphrase in localStorage on this device (needed for auto-sync after reload). */
  rememberPassphrase?: boolean
  /**
   * Mini (source of truth) turns this on. Sync always PUSHES this device.
   * Off (MacBook / iPhone / iPad satellite): Sync and pull-to-refresh always PULL
   * the remote book. Satellites never push a local book.
   */
  thisDeviceIsTheBook?: boolean
  /**
   * When auto-pull finds same-id conflicts, prefer remote (other device).
   * Default true. Set false to pause and review in Settings.
   */
  autoResolveConflicts?: boolean
  lastSyncAt?: string
  lastSyncError?: string
  /** Portfolios merged on the last successful pull */
  lastMergeCount?: number
  /** Last successful media / favourites extras apply from encrypted workspace archive */
  lastWorkspaceExtrasSyncAt?: string
  /** Last applied remote envelope exportedAt (skip re-pull of same blob) */
  lastRemoteExportedAt?: string
  /** Approx encrypted remote envelope size from meta/header/push body. */
  lastRemoteBlobBytes?: number
  /** Approx encrypted bytes downloaded by the last pull/preview. */
  lastPullBytes?: number
  /** Approx encrypted bytes uploaded by the last push. */
  lastPushBytes?: number
  /** When set (ISO), auto-sync cycles are skipped until this time */
  pausedUntil?: string
  /**
   * Holding ids present after the last successful satellite book pull.
   * Dirty overlay uses this to tell a satellite delete from a Mini add.
   */
  lastPulledHoldingIds?: Record<string, Partial<Record<string, number[]>>>
}

export interface SyncEnvelope {
  /** v1 = portfolios only; v2 full archive; v3 also encrypted document blobs */
  v: 1 | 2 | 3
  app: 'mydsp'
  exportedAt: string
  deviceId: string
  portfolios: PortfolioMeta[]
  activePortfolioId: string
  /** portfolioId → encrypted blob of storage shape */
  blobs: Record<string, EncryptedBlob>
  /** Encrypted captureFullWorkspace() snapshot (all portfolios + registry). */
  fullArchive?: EncryptedBlob
  /** Encrypted DocumentBlobPayload[] for CV/PDF attachments */
  documentBlobs?: EncryptedBlob
  /** Blob ids skipped due to size limits (plaintext metadata) */
  documentBlobsSkipped?: number[]
  checksum: string
}

export interface SyncPushResult {
  exportedAt: string
  bytes: number
}

export interface RemoteSyncMeta {
  exportedAt: string
  deviceId: string
  checksum?: string
  encryptedBytes?: number
}

export function estimateSyncPayloadBytes(text: string): number {
  try {
    return new TextEncoder().encode(text).byteLength
  } catch {
    return text.length
  }
}

export function formatSyncPayloadBytes(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function formatRemoteBlobAge(exportedAt?: string, now = Date.now()): string | null {
  if (!exportedAt) return null
  const t = new Date(exportedAt).getTime()
  if (!Number.isFinite(t)) return null
  const sec = Math.max(0, Math.round((now - t) / 1000))
  if (sec < 45) return 'just now'
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m old`
  if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h old`
  return `${Math.max(1, Math.round(sec / 86400))}d old`
}

export function buildSyncDiagnosticsText(
  cfg: SyncConfig,
  deviceNickname: string,
  now = Date.now(),
): string {
  const remoteBytes = formatSyncPayloadBytes(
    cfg.lastRemoteBlobBytes ?? cfg.lastPushBytes ?? cfg.lastPullBytes,
  )
  const lines = [
    'MyDSP sync diagnostics',
    `Generated ${new Date(now).toLocaleString('en-GB')}`,
    `Device nickname: ${deviceNickname || 'Unnamed device'}`,
    `Sync enabled: ${cfg.enabled ? 'yes' : 'no'}`,
    `Remote configured: ${cfg.remoteUrl ? 'yes' : 'no'}`,
    `Remote blob age: ${formatRemoteBlobAge(cfg.lastRemoteExportedAt, now) ?? 'unknown'}`,
    `Remote exported at: ${cfg.lastRemoteExportedAt ?? 'unknown'}`,
    `Encrypted remote blob size: ${remoteBytes ?? 'unknown'}`,
    `Last pull size: ${formatSyncPayloadBytes(cfg.lastPullBytes) ?? 'unknown'}`,
    `Last push size: ${formatSyncPayloadBytes(cfg.lastPushBytes) ?? 'unknown'}`,
    `Last sync: ${cfg.lastSyncAt ?? 'never'}`,
    `Last error: ${cfg.lastSyncError ?? 'none'}`,
  ]
  return lines.join('\n')
}

export async function shareSyncDiagnostics(
  cfg: SyncConfig,
  deviceNickname: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'unavailable'> {
  const text = buildSyncDiagnosticsText(cfg, deviceNickname)
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: 'MyDSP sync diagnostics',
        text,
      })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied'
  }
  return 'unavailable'
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function responseContentLength(res: Response): number | undefined {
  const raw = res.headers.get('content-length')
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function metaByteEstimate(
  data: Record<string, unknown>,
  res: Response,
  opts?: { envelopeResponse?: boolean },
): number | undefined {
  const explicit =
    optionalFiniteNumber(data.encryptedBytes) ??
    optionalFiniteNumber(data.payloadBytes) ??
    optionalFiniteNumber(data.bytes) ??
    optionalFiniteNumber(data.size) ??
    optionalFiniteNumber(data.contentLength)
  if (explicit !== undefined) return explicit

  // Content-Length is only the encrypted payload size when the response is the envelope itself.
  const looksLikeEnvelope = data.app === 'mydsp' && typeof data.blobs === 'object'
  if (!opts?.envelopeResponse && !looksLikeEnvelope) return undefined
  return responseContentLength(res)
}

export function rememberSyncPayloadStats(patch: Partial<SyncConfig>): SyncConfig {
  const next = { ...loadSyncConfig(), ...patch }
  saveSyncConfig(next)
  return next
}

/** Staged merge plan — no local writes until applyMergePreview. */
export interface MergePreview {
  source: 'pull' | 'import'
  portfolios: Array<{
    portfolioId: string
    isNew: boolean
    local: PortfolioData | null
    remote: PortfolioData
    conflicts: SyncConflict[]
  }>
  registryPortfolios: PortfolioMeta[]
  /** Remote envelope registry with local id remaps — satellite REPLACE uses this, not a local-first union. */
  remoteRegistry?: PortfolioMeta[]
  activePortfolioId?: string
  documentBlobs?: DocumentBlobPayload[]
  documentBlobsSkipped?: number[]
  conflicts: SyncConflict[]
  /** Remote registry had duplicate names or exceeded the cap — push cleaned local after merge. */
  remoteHadDuplicateNames?: boolean
  /**
   * Workspace extras from encrypted fullArchive (Favourites + Markets/News/YouTube).
   * Applied last-write-wins on pull. Local Markets edits no longer skip sync —
   * they mark dirty so other devices receive the watchlist.
   */
  workspaceExtras?: {
    navLayout?: unknown
    markets?: unknown
    /** Last-good Markets quotes (by ticker id) */
    marketQuotes?: unknown
    /** Last-good display FX (GBP/USD/THB/BTC) */
    fxRates?: unknown
    news?: unknown
    /** Last-good News headlines cache */
    newsArticles?: unknown
    youtube?: unknown
    youtubeVideos?: unknown
    isaRemaining?: unknown
    priceAlertThresholds?: unknown
    compareWeekSnapshot?: unknown
    digestHighlights?: unknown
    compareSelection?: unknown
    recurringSort?: unknown
    holdingsDrift?: unknown
    portfolioConcentration?: unknown
    spendingFilters?: unknown
    newsFilter?: unknown
    todosQuickFilter?: unknown
    jobsFilter?: unknown
    bottomNavSlots?: unknown
    todayLayout?: unknown
    hubLayout?: unknown
    launchPath?: unknown
    uiPanels?: unknown
    settingsSections?: unknown
    marketsTagYield?: unknown
    settingsRecentJumps?: unknown
    taxYear?: unknown
    journalFilter?: unknown
    nwSparkWindow?: unknown
    webhookUrl?: unknown
    achievementsSeen?: unknown
    gettingStartedDismissed?: unknown
    merchantRuleSuggestionDismiss?: unknown
    whatArrivedDismiss?: unknown
    todosSort?: unknown
    jobsView?: unknown
    liabilitiesRag?: unknown
    reviewMonth?: unknown
    glassMode?: unknown
    largeText?: unknown
    themePref?: unknown
    a11yPrefs?: unknown
    notificationSettings?: unknown
  }
}

export interface MergeUndoSnapshot {
  portfolios: Array<{
    portfolioId: string
    existed: boolean
    local: PortfolioData | null
  }>
  registryPortfolios: PortfolioMeta[]
  activePortfolioId: string
}

export function captureMergeUndoSnapshot(preview: MergePreview): MergeUndoSnapshot {
  const existingIds = new Set(listPortfolios().map((p) => p.id))
  return {
    portfolios: preview.portfolios.map((plan) => {
      const existed = existingIds.has(plan.portfolioId)
      if (existed) {
        try {
          flushSave(plan.portfolioId)
        } catch {
          /* ignore */
        }
      }
      return {
        portfolioId: plan.portfolioId,
        existed,
        local: existed ? loadPortfolio(plan.portfolioId) : null,
      }
    }),
    registryPortfolios: listPortfolios(),
    activePortfolioId: getActivePortfolioId(),
  }
}

export function restoreMergeUndoSnapshot(snapshot: MergeUndoSnapshot): void {
  for (const item of snapshot.portfolios) {
    if (item.existed && item.local) {
      savePortfolioImmediate(item.local, item.portfolioId)
    } else {
      try {
        localStorage.removeItem(STORAGE.dataKey(item.portfolioId))
      } catch {
        /* ignore */
      }
    }
  }
  localStorage.setItem(STORAGE.PORTFOLIOS, JSON.stringify(snapshot.registryPortfolios))
  setActivePortfolioId(snapshot.activePortfolioId)
}

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { remoteUrl: '', enabled: false, autoResolveConflicts: false }
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return {
      remoteUrl: normalizeSyncRemoteUrl(
        typeof parsed.remoteUrl === 'string' ? parsed.remoteUrl : '',
      ),
      enabled: Boolean(parsed.enabled),
      rememberPassphrase: Boolean(parsed.rememberPassphrase),
      thisDeviceIsTheBook: Boolean(parsed.thisDeviceIsTheBook),
      autoResolveConflicts:
        parsed.autoResolveConflicts === undefined ? false : Boolean(parsed.autoResolveConflicts),
      lastSyncAt: parsed.lastSyncAt,
      lastSyncError: parsed.lastSyncError,
      lastMergeCount:
        typeof parsed.lastMergeCount === 'number' ? parsed.lastMergeCount : undefined,
      lastWorkspaceExtrasSyncAt:
        typeof parsed.lastWorkspaceExtrasSyncAt === 'string'
          ? parsed.lastWorkspaceExtrasSyncAt
          : undefined,
      lastRemoteExportedAt:
        typeof parsed.lastRemoteExportedAt === 'string' ? parsed.lastRemoteExportedAt : undefined,
      lastRemoteBlobBytes: optionalFiniteNumber(parsed.lastRemoteBlobBytes),
      lastPullBytes: optionalFiniteNumber(parsed.lastPullBytes),
      lastPushBytes: optionalFiniteNumber(parsed.lastPushBytes),
      pausedUntil: typeof parsed.pausedUntil === 'string' ? parsed.pausedUntil : undefined,
      lastPulledHoldingIds:
        parsed.lastPulledHoldingIds && typeof parsed.lastPulledHoldingIds === 'object'
          ? parsed.lastPulledHoldingIds
          : undefined,
    }
  } catch {
    return { remoteUrl: '', enabled: false, autoResolveConflicts: false }
  }
}

export function saveSyncConfig(cfg: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

/** Mini turns this on. Satellites (MacBook / iPhone / iPad) leave it off. */
export function isBookDevice(cfg: SyncConfig = loadSyncConfig()): boolean {
  return cfg.thisDeviceIsTheBook === true
}

const ALLOWED_APP_PUSH_HOSTS = new Set([
  'mydspv1.dave-perry.workers.dev',
  'main-mydspv1.dave-perry.workers.dev',
  'localhost',
  '127.0.0.1',
])

/**
 * Cloudflare branch / commit / leftover previews are a new origin with empty
 * localStorage. Pushing from them would overwrite Mini’s cloud book.
 * Live (`mydspv1…`) and main preview (`main-mydspv1…`) are allowed.
 * Block `cursor-*-mydspv1`, leftover `cursor-*-mydsp` (no v1), and
 * commit previews like `047722a6-mydspv1…`.
 */
export function isDraftWorkerPreview(hostname?: string): boolean {
  const host = (
    hostname ??
    (typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : '')
  )
    .trim()
    .toLowerCase()
  if (!host || ALLOWED_APP_PUSH_HOSTS.has(host)) return false
  if (host.startsWith('mydsp-sync.') || host.startsWith('mydsp-quote.')) return false
  return host.includes('mydsp') && host.endsWith('.workers.dev')
}

/**
 * Ensure Remote URL is absolute https. Without a scheme, browsers treat it as a
 * path on the app host → Push hits mydspv1…/mydsp-sync… and returns 405.
 */
/** Existing mydsp-sync Worker host from this repo. Never append an access key here. */
export const DEFAULT_SYNC_REMOTE_URL = 'https://mydsp-sync.dave-perry.workers.dev'

/** Use a stored Remote URL when set; otherwise the baked mydsp-sync Worker. */
export function resolveSyncRemoteUrl(stored?: string): string {
  const normalized = normalizeSyncRemoteUrl(stored ?? '')
  return normalized || normalizeSyncRemoteUrl(DEFAULT_SYNC_REMOTE_URL)
}

export function normalizeSyncRemoteUrl(url: string): string {
  let raw = url.trim()
  if (!raw) return ''
  // Common paste: "mydsp-sync….workers.dev" or "mydsp-sync….workers.dev?key=…"
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    raw = `https://${raw.replace(/^\/\//, '')}`
  }
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.toString()
  } catch {
    return raw
  }
}

/**
 * Detect common mistakes: Remote URL must be the sync Worker (mydsp-sync…),
 * not the MyDSP app host (mydspv1… / GitHub Pages). Those return HTTP 405 on Push.
 */
export function getSyncRemoteUrlWarning(url: string): string | null {
  const raw = normalizeSyncRemoteUrl(url)
  if (!raw) return null
  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return 'Remote URL must be a full https://… address (e.g. https://mydsp-sync.…workers.dev).'
  }

  const looksLikeApp =
    host.includes('github.io') ||
    /^mydspv?\d*\./.test(host) ||
    host.startsWith('mydsp.') ||
    host.includes('pages.dev')

  if (looksLikeApp && !host.includes('sync')) {
    return (
      'This looks like the MyDSP app URL, not the sync Worker. ' +
      'Use https://mydsp-sync.<your-subdomain>.workers.dev (optional ?key=…). ' +
      'App hosts return Push failed (405/405).'
    )
  }

  if (host.includes('workers.dev') && !host.includes('sync')) {
    return (
      'Remote URL should be your sync Worker (name usually contains “sync”), ' +
      'not the app Worker. Example: https://mydsp-sync.dave-perry.workers.dev'
    )
  }

  return null
}

function pushFailureMessage(url: string, putStatus: number, postStatus: number): string {
  const normalized = normalizeSyncRemoteUrl(url)
  const missingScheme = url.trim() && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url.trim())
  if (putStatus === 405 || postStatus === 405) {
    if (missingScheme) {
      return (
        'Push failed (405) — Remote URL needs https:// at the start. ' +
        `Use ${normalized || 'https://mydsp-sync.…workers.dev'}.`
      )
    }
    return (
      getSyncRemoteUrlWarning(url) ??
      `Push failed (405) — this URL rejects PUT/POST. ` +
        `Use the sync Worker URL (e.g. https://mydsp-sync.…workers.dev), not the app URL.`
    )
  }
  if (putStatus === 401 || postStatus === 401) {
    return (
      'Push unauthorized (401) — the Worker rejected this request. ' +
      'The live app host should not need an access key on the URL after the Worker allowlist is deployed.'
    )
  }
  return `Push failed (${putStatus}/${postStatus})`
}

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `dev_${crypto.randomUUID()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function getLocalDeviceId(): string {
  return deviceId()
}

/**
 * Lightweight remote check — prefers Worker `?meta=1`, falls back to envelope top-level fields.
 * Does not decrypt. Returns null when store is empty (404).
 */
export async function fetchRemoteMeta(
  url: string,
): Promise<RemoteSyncMeta | null> {
  const remote = normalizeSyncRemoteUrl(url)
  let metaUrl = remote
  try {
    const u = new URL(remote)
    u.searchParams.set('meta', '1')
    metaUrl = u.toString()
  } catch {
    metaUrl = remote.includes('?') ? `${remote}&meta=1` : `${remote}?meta=1`
  }

  let res = await fetch(metaUrl)
  // Older workers ignore ?meta=1 and return the full envelope — still usable
  if (res.status === 404) return null
  if (!res.ok && metaUrl !== remote) {
    res = await fetch(remote)
    if (res.status === 404) return null
  }
  if (!res.ok) throw new Error(`Remote check failed (${res.status})`)

  const data = (await res.json()) as Record<string, unknown>
  if (typeof data.exportedAt !== 'string') return null
  return {
    exportedAt: data.exportedAt,
    deviceId: typeof data.deviceId === 'string' ? data.deviceId : '',
    checksum: typeof data.checksum === 'string' ? data.checksum : undefined,
    encryptedBytes: metaByteEstimate(data, res, { envelopeResponse: metaUrl === remote }),
  }
}

export function allConflictsResolved(
  conflicts: SyncConflict[],
  resolutions: Record<string, ConflictChoice>,
): boolean {
  return conflicts.every((c) => Boolean(resolutions[conflictKey(c)]))
}

export async function buildEnvelope(
  passphrase: string,
  opts?: { includeFullArchive?: boolean; includeDocumentBlobs?: boolean },
): Promise<SyncEnvelope> {
  setSessionSyncPassphrase(passphrase)
  const portfolios = listPortfolios()
  const activePortfolioId = getActivePortfolioId()
  const plainMap: Record<string, Record<string, unknown>> = {}
  const blobs: Record<string, EncryptedBlob> = {}
  const portfolioData: PortfolioData[] = []

  for (const p of portfolios) {
    // Debounced savePortfolio is 300ms — flush so the envelope is not stale
    flushSave(p.id)
    const data = loadPortfolio(p.id)
    portfolioData.push(data)
    const shape = toStorageShape(data)
    plainMap[p.id] = shape
    blobs[p.id] = await encryptJson(shape, passphrase)
  }

  const includeFull = opts?.includeFullArchive !== false
  let fullArchive: EncryptedBlob | undefined
  let archivePlain: unknown
  if (includeFull) {
    archivePlain = captureFullWorkspace()
    fullArchive = await encryptJson(archivePlain, passphrase)
  }

  const includeDocs = opts?.includeDocumentBlobs !== false
  let documentBlobsEnc: EncryptedBlob | undefined
  let documentBlobsPlain: DocumentBlobPayload[] | null = null
  let documentBlobsSkipped: number[] | undefined
  if (includeDocs) {
    try {
      const { collectBlobIdsFromPortfolios } = await import('../../storage/blobIds')
      const { exportDocumentBlobs } = await import('../../storage/documentBlobStore')
      const ids = collectBlobIdsFromPortfolios(portfolioData)
      const exported = await exportDocumentBlobs(ids)
      documentBlobsPlain = exported.payloads
      documentBlobsSkipped = exported.skipped.length > 0 ? exported.skipped : undefined
      if (exported.payloads.length > 0) {
        documentBlobsEnc = await encryptJson(exported.payloads, passphrase)
      }
    } catch {
      /* blob export is best-effort */
    }
  }

  const hasDocs = Boolean(documentBlobsEnc)
  const version: 1 | 2 | 3 = hasDocs ? 3 : includeFull ? 2 : 1

  const canonical = JSON.stringify({
    portfolios,
    activePortfolioId,
    plainMap,
    ...(includeFull ? { archive: archivePlain ?? null } : {}),
    ...(hasDocs ? { documentBlobs: documentBlobsPlain } : {}),
  })

  return {
    v: version,
    app: 'mydsp',
    exportedAt: new Date().toISOString(),
    deviceId: deviceId(),
    portfolios,
    activePortfolioId,
    blobs,
    fullArchive,
    documentBlobs: documentBlobsEnc,
    documentBlobsSkipped,
    checksum: await checksum(canonical),
  }
}

type BookHoldingHashes = Record<string, Partial<Record<string, Record<string, string>>>>

function loadLastBookHoldingHashes(): BookHoldingHashes | null {
  try {
    const raw = localStorage.getItem(BOOK_HASH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookHoldingHashes
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** After Mini absorb or PUT, remember this book so extras-only dirty is not treated as a holding fight. */
export function stampLastBookHoldingHashes(): void {
  if (!isBookDevice()) return
  const ids: BookHoldingHashes = {}
  for (const p of listPortfolios()) {
    const data = loadPortfolio(p.id)
    const cols: Record<string, Record<string, string>> = {}
    for (const collection of COLLECTIONS) {
      const map: Record<string, string> = {}
      for (const row of (data[collection] as { id: number }[] | undefined) ?? []) {
        map[String(row.id)] = stableHash(row)
      }
      cols[collection] = map
    }
    ids[p.id] = cols
  }
  try {
    localStorage.setItem(BOOK_HASH_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
  stampLastBookScalarHashes()
  stampLastBookRegistryNames()
}

type BookScalarHashes = Record<string, Partial<Record<(typeof BOOK_SCALAR_FIELDS)[number], string>>>

function loadLastBookScalarHashes(): BookScalarHashes | null {
  try {
    const raw = localStorage.getItem(BOOK_SCALAR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookScalarHashes
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function stampLastBookScalarHashes(): void {
  if (!isBookDevice()) return
  const ids: BookScalarHashes = {}
  for (const p of listPortfolios()) {
    const data = loadPortfolio(p.id)
    const fields: BookScalarHashes[string] = {}
    for (const key of BOOK_SCALAR_FIELDS) {
      fields[key] = stableHash(data[key])
    }
    ids[p.id] = fields
  }
  try {
    localStorage.setItem(BOOK_SCALAR_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
}

function lastKnownBookIds(): string[] {
  const names = loadLastBookRegistryNames()
  if (names && Object.keys(names).length > 0) return Object.keys(names)
  const hashes = loadLastBookHoldingHashes()
  if (hashes && Object.keys(hashes).length > 0) return Object.keys(hashes)
  return Object.keys(loadSyncConfig().lastPulledHoldingIds ?? {})
}

function loadLastBookRegistryNames(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(BOOK_REGISTRY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function stampLastBookRegistryNames(): void {
  if (!isBookDevice()) return
  const names: Record<string, string> = {}
  for (const p of listPortfolios()) names[p.id] = p.name
  try {
    localStorage.setItem(BOOK_REGISTRY_KEY, JSON.stringify(names))
  } catch {
    /* quota */
  }
}

function holdingsMatchStamp(baseline: BookHoldingHashes | null): boolean {
  if (!baseline) return false
  const list = listPortfolios()
  const baseIds = Object.keys(baseline)
  if (list.length !== baseIds.length) return false
  for (const p of list) {
    const cols = baseline[p.id]
    if (!cols) return false
    const data = loadPortfolio(p.id)
    for (const collection of COLLECTIONS) {
      const rows = (data[collection] as { id: number }[] | undefined) ?? []
      const stamped = cols[collection] ?? {}
      if (rows.length !== Object.keys(stamped).length) return false
      for (const row of rows) {
        if (stamped[String(row.id)] !== stableHash(row)) return false
      }
    }
  }
  return true
}

function scalarsMatchStamp(stamp: BookScalarHashes | null): boolean {
  if (!stamp) return false
  const list = listPortfolios()
  if (list.length !== Object.keys(stamp).length) return false
  for (const p of list) {
    const stamped = stamp[p.id]
    if (!stamped) return false
    const data = loadPortfolio(p.id)
    for (const key of BOOK_SCALAR_FIELDS) {
      if (stamped[key] !== stableHash(data[key])) return false
    }
  }
  return true
}

function registryMatchStamp(stamped: Record<string, string> | null): boolean {
  if (!stamped) return false
  const list = listPortfolios()
  if (list.length !== Object.keys(stamped).length) return false
  for (const p of list) {
    if (stamped[p.id] !== p.name) return false
  }
  return true
}

/** True when Mini’s holdings still match the last absorbed/PUT book (extras-only dirty). */
export function bookHoldingsMatchLastStamp(): boolean {
  return holdingsMatchStamp(loadLastBookHoldingHashes())
}

/**
 * Satellite local book/scalars/names differ from the last Unlock/pull stamp.
 * In-memory `dirty` is lost on reload — this is what keeps an unpushed qty.
 * No stamp yet (first Unlock) is not diverged, so leftovers still REPLACE.
 */
export function satelliteBookDivergedFromLastPull(): boolean {
  if (isBookDevice()) return false
  const hashes = loadLastPulledHoldingHashes()
  const scalars = loadLastPulledScalarHashes()
  const names = loadLastPulledRegistryNames()
  if (!hashes && !scalars && !names) {
    // 1.2.163 Unlock stamped lastPulledHoldingIds only. An unpushed qty
    // would REPLACE back to Mini on the first 1.2.164 Unlock without this.
    const pulledIds = loadSyncConfig().lastPulledHoldingIds
    return Boolean(pulledIds && Object.keys(pulledIds).length > 0)
  }
  if (hashes && !holdingsMatchStamp(hashes)) return true
  if (scalars && !scalarsMatchStamp(scalars)) return true
  if (names && !registryMatchStamp(names)) return true
  return false
}

function currentSatelliteExtrasFingerprint(): unknown {
  const yt = exportYoutubeForBackup()
  const news = exportNewsForBackup()
  const mk = exportMarketsForBackup()
  return {
    youtube: {
      channels: (yt.channels ?? []).map((c) => c.channelId).sort(),
      deleted: (yt.deletedChannels ?? []).map((d) => d.channelId).sort(),
    },
    news: {
      tags: (news.tags ?? []).map((t) => t.tag).sort(),
      deleted: (news.deletedTags ?? []).map((d) => d.tag).sort(),
    },
    markets: {
      tickers: (mk.tickers ?? []).map((t) => `${t.kind}:${t.symbol}`).sort(),
      deleted: (mk.deletedTickers ?? []).map((d) => d.key).sort(),
    },
  }
}

/** After extras apply on a satellite — lists only, not quotes / videos / seenAt. */
export function stampLastPulledExtrasHash(): void {
  if (isBookDevice()) return
  try {
    localStorage.setItem(PULLED_EXTRAS_KEY, stableHash(currentSatelliteExtrasFingerprint()))
  } catch {
    /* quota */
  }
}

/**
 * Satellite YouTube / News / Markets lists differ from the last pull stamp.
 * Reload drops in-memory dirty — this is what still flushes an unpushed channel.
 * No extras apply yet (first Unlock, no lastWorkspaceExtrasSyncAt) is not
 * diverged, so leftover 8 channels still REPLACE. A 1.2.163 satellite already
 * stamped extras time but has no list hash — treat as diverged so an unpushed
 * channel still flushes on the first 1.2.164 Unlock.
 */
export function satelliteExtrasDivergedFromLastPull(): boolean {
  if (isBookDevice()) return false
  try {
    const raw = localStorage.getItem(PULLED_EXTRAS_KEY)
    if (!raw) return Boolean(loadSyncConfig().lastWorkspaceExtrasSyncAt)
    return raw !== stableHash(currentSatelliteExtrasFingerprint())
  } catch {
    return false
  }
}

export function satelliteLocalStateDivergedFromLastPull(): boolean {
  return satelliteBookDivergedFromLastPull() || satelliteExtrasDivergedFromLastPull()
}

function conflictRowSide(
  c: SyncConflict,
  preview: MergePreview,
): 'mini' | 'satellite' | 'both' | 'unknown' {
  const baseline = loadLastBookHoldingHashes()
  const baseHash = baseline?.[c.portfolioId]?.[c.collection]?.[String(c.id)]
  const plan = preview.portfolios.find((p) => p.portfolioId === c.portfolioId)
  const locArr = plan?.local?.[c.collection as ConflictCollection] as { id: number }[] | undefined
  const remArr = plan?.remote?.[c.collection as ConflictCollection] as { id: number }[] | undefined
  const loc = locArr?.find((row) => row.id === c.id)
  const rem = remArr?.find((row) => row.id === c.id)
  if (!loc || !rem || !baseHash) return 'unknown'
  const miniChanged = stableHash(loc) !== baseHash
  const satChanged = stableHash(rem) !== baseHash
  if (miniChanged && satChanged) return 'both'
  if (satChanged) return 'satellite'
  if (miniChanged) return 'mini'
  return 'unknown'
}

/**
 * Mini (book) unions YouTube / News / Markets from the cloud before any PUT,
 * and takes satellite holding size/qty changes when Mini has not edited the
 * same rows. A MacBook / iPhone / iPad extras or book push must not be wiped
 * by Mini boot, Backup, or Sync. Empty cloud (404) is a no-op so Mini can
 * still seed. Same-device last writer skips the download.
 * Network / decrypt failures throw — never push a stale extras list or Mini
 * qty over a newer satellite envelope.
 * Returns `parked` only when Mini and the satellite both changed the same
 * rows from Mini’s last book stamp — extras still apply; the PUT is skipped.
 * Extras-only Mini dirty (holdings still match the stamp) still
 * `applyRemoteAsBook` so a satellite qty / delete is not parked and Mini’s
 * new channel still PUTs. After that REPLACE, overlay Mini-only new books,
 * Mini deletes / renames, and Mini-edited scalars (staking / FIRE / budgets)
 * so a MacBook size change never wipes a Mini Kids create or staking edit.
 */
export async function absorbRemoteWorkspaceExtrasBeforePush(
  url: string,
  passphrase: string,
): Promise<boolean | 'parked'> {
  if (!isBookDevice()) return false
  const remote = normalizeSyncRemoteUrl(url)
  let meta: RemoteSyncMeta | null
  try {
    meta = await fetchRemoteMeta(remote)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Remote check failed'
    throw new Error(`Could not check cloud extras before push: ${msg}`)
  }
  if (!meta) return false
  if (meta.deviceId && meta.deviceId === getLocalDeviceId()) return false
  const preview = await previewPull(remote, passphrase)

  let wasDirty = false
  try {
    const { isLocalSyncDirty } = await import('./autoSyncService')
    wasDirty = isLocalSyncDirty()
  } catch {
    /* cycle import during isolated tests */
  }

  const extrasOnly = !wasDirty || bookHoldingsMatchLastStamp()
  const metasBefore = listPortfolios()
  const createdBooks = snapshotMiniCreatedBooks()
  const booksBefore = metasBefore.map((p) => ({ id: p.id, data: loadPortfolio(p.id) }))

  const takeSatelliteBookKeepMiniRegistry = async () => {
    await applyRemoteAsBook(preview)
    overlayMiniBookAfterRemoteReplace(createdBooks, metasBefore, booksBefore)
    await refreshMiniMarksAfterAbsorb()
    stampLastBookHoldingHashes()
    return true as const
  }

  if (extrasOnly) {
    // Mini has not edited holdings — take the satellite book as-is so a
    // deleted SOL / changed qty / new ETH is not unioned or parked.
    return takeSatelliteBookKeepMiniRegistry()
  }

  if (preview.conflicts.length > 0) {
    const sides = preview.conflicts.map((c) => conflictRowSide(c, preview))
    if (sides.some((s) => s === 'both' || s === 'unknown')) {
      await applyWorkspaceExtrasFromPreview(preview)
      return 'parked'
    }
    if (sides.every((s) => s === 'satellite')) {
      return takeSatelliteBookKeepMiniRegistry()
    }
    const resolutions: Record<string, ConflictChoice> = {}
    for (const c of preview.conflicts) {
      resolutions[conflictKey(c)] = conflictRowSide(c, preview) === 'satellite' ? 'remote' : 'local'
    }
    await applyMergePreview(preview, resolutions)
    dropUneditedRowsDeletedOnRemote(booksBefore, preview)
    dropMiniDeletedHoldings(booksBefore)
    overlayMiniLiveMarks(booksBefore)
    await refreshMiniMarksAfterAbsorb()
    stampLastBookHoldingHashes()
    return true
  }

  await applyMergePreview(preview, {})
  dropUneditedRowsDeletedOnRemote(booksBefore, preview)
  dropMiniDeletedHoldings(booksBefore)
  overlayMiniLiveMarks(booksBefore)
  await refreshMiniMarksAfterAbsorb()
  stampLastBookHoldingHashes()
  return true
}

export async function pushSync(url: string, passphrase: string): Promise<SyncPushResult> {
  if (isDraftWorkerPreview()) {
    throw new Error(
      'This draft preview will not push over Mini. Use https://main-mydspv1.dave-perry.workers.dev or Live.',
    )
  }
  setSessionSyncPassphrase(passphrase)
  const remote = normalizeSyncRemoteUrl(url)
  if (isBookDevice()) {
    const absorbed = await absorbRemoteWorkspaceExtrasBeforePush(remote, passphrase)
    if (absorbed === 'parked') {
      return {
        exportedAt: loadSyncConfig().lastRemoteExportedAt ?? new Date().toISOString(),
        bytes: 0,
      }
    }
  }
  const envelope = await buildEnvelope(passphrase, { includeFullArchive: true })
  const body = JSON.stringify(envelope)
  const bytes = estimateSyncPayloadBytes(body)
  const res = await fetch(remote, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    // Some hosts only allow POST
    const res2 = await fetch(remote, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res2.ok) throw new Error(pushFailureMessage(url, res.status, res2.status))
  }
  rememberSyncPayloadStats({
    lastRemoteExportedAt: envelope.exportedAt,
    lastRemoteBlobBytes: bytes,
    lastPushBytes: bytes,
  })
  stampLastBookHoldingHashes()
  return { exportedAt: envelope.exportedAt, bytes }
}

async function decryptEnvelope(
  envelope: SyncEnvelope,
  passphrase: string,
  opts?: { verifyChecksum?: boolean },
): Promise<{
  remoteByPortfolio: Map<string, PortfolioData>
  documentBlobs?: DocumentBlobPayload[]
  workspaceExtras?: MergePreview['workspaceExtras']
}> {
  if (envelope.app !== 'mydsp') throw new Error('Not a MyDSP sync file')
  if (envelope.v !== 1 && envelope.v !== 2 && envelope.v !== 3) {
    throw new Error('Invalid sync envelope')
  }

  const plainMap: Record<string, Record<string, unknown>> = {}
  const remoteByPortfolio = new Map<string, PortfolioData>()
  for (const meta of envelope.portfolios) {
    const blob = envelope.blobs[meta.id]
    if (!blob) continue
    const remoteShape = await decryptJson<Record<string, unknown>>(blob, passphrase)
    plainMap[meta.id] = remoteShape
    remoteByPortfolio.set(meta.id, normalizePortfolio(remoteShape))
  }

  let archivePlain: unknown = null
  if (envelope.fullArchive) {
    archivePlain = await decryptJson(envelope.fullArchive, passphrase)
  }

  let documentBlobsPlain: DocumentBlobPayload[] | undefined
  if (envelope.documentBlobs) {
    documentBlobsPlain = await decryptJson<DocumentBlobPayload[]>(envelope.documentBlobs, passphrase)
  }

  if (opts?.verifyChecksum !== false && envelope.checksum) {
    const canonical =
      envelope.v === 3
        ? JSON.stringify({
            portfolios: envelope.portfolios,
            activePortfolioId: envelope.activePortfolioId,
            plainMap,
            archive: archivePlain,
            documentBlobs: documentBlobsPlain ?? null,
          })
        : envelope.v === 2
          ? JSON.stringify({
              portfolios: envelope.portfolios,
              activePortfolioId: envelope.activePortfolioId,
              plainMap,
              archive: archivePlain,
            })
          : JSON.stringify({
              portfolios: envelope.portfolios,
              activePortfolioId: envelope.activePortfolioId,
              plainMap,
            })
    const expected = await checksum(canonical)
    if (expected !== envelope.checksum) throw new Error('Checksum mismatch')
  }

  let workspaceExtras: MergePreview['workspaceExtras'] | undefined
  if (archivePlain && typeof archivePlain === 'object') {
    const a = archivePlain as Record<string, unknown>
    const extras: NonNullable<MergePreview['workspaceExtras']> = {}
    if (a.navLayout != null) extras.navLayout = a.navLayout
    if (a.markets != null) extras.markets = a.markets
    if (a.marketQuotes != null) extras.marketQuotes = a.marketQuotes
    if (a.fxRates != null) extras.fxRates = a.fxRates
    if (a.news != null) extras.news = a.news
    if (a.newsArticles != null) extras.newsArticles = a.newsArticles
    if (a.youtube != null) extras.youtube = a.youtube
    if (a.youtubeVideos != null) extras.youtubeVideos = a.youtubeVideos
    if (a.isaRemaining != null) extras.isaRemaining = a.isaRemaining
    if (a.priceAlertThresholds != null) extras.priceAlertThresholds = a.priceAlertThresholds
    if (a.compareWeekSnapshot != null) extras.compareWeekSnapshot = a.compareWeekSnapshot
    if (a.digestHighlights != null) extras.digestHighlights = a.digestHighlights
    if (a.compareSelection != null) extras.compareSelection = a.compareSelection
    if (a.recurringSort != null) extras.recurringSort = a.recurringSort
    if (a.holdingsDrift != null) extras.holdingsDrift = a.holdingsDrift
    if (a.portfolioConcentration != null) extras.portfolioConcentration = a.portfolioConcentration
    if (a.spendingFilters != null) extras.spendingFilters = a.spendingFilters
    if (a.newsFilter != null) extras.newsFilter = a.newsFilter
    if (a.todosQuickFilter != null) extras.todosQuickFilter = a.todosQuickFilter
    if (a.jobsFilter != null) extras.jobsFilter = a.jobsFilter
    if (a.bottomNavSlots != null) extras.bottomNavSlots = a.bottomNavSlots
    if (a.todayLayout != null) extras.todayLayout = a.todayLayout
    if (a.hubLayout != null) extras.hubLayout = a.hubLayout
    if (a.launchPath != null) extras.launchPath = a.launchPath
    if (a.uiPanels != null) extras.uiPanels = a.uiPanels
    if (a.settingsSections != null) extras.settingsSections = a.settingsSections
    if (a.marketsTagYield != null) extras.marketsTagYield = a.marketsTagYield
    if (a.settingsRecentJumps != null) extras.settingsRecentJumps = a.settingsRecentJumps
    if (a.taxYear != null) extras.taxYear = a.taxYear
    if (a.journalFilter != null) extras.journalFilter = a.journalFilter
    if (a.nwSparkWindow != null) extras.nwSparkWindow = a.nwSparkWindow
    if (a.webhookUrl != null) extras.webhookUrl = a.webhookUrl
    if (a.achievementsSeen != null) extras.achievementsSeen = a.achievementsSeen
    if (a.gettingStartedDismissed != null) extras.gettingStartedDismissed = a.gettingStartedDismissed
    if (a.merchantRuleSuggestionDismiss != null) extras.merchantRuleSuggestionDismiss = a.merchantRuleSuggestionDismiss
    if (a.whatArrivedDismiss != null) extras.whatArrivedDismiss = a.whatArrivedDismiss
    if (a.todosSort != null) extras.todosSort = a.todosSort
    if (a.jobsView != null) extras.jobsView = a.jobsView
    if (a.liabilitiesRag != null) extras.liabilitiesRag = a.liabilitiesRag
    if (a.reviewMonth != null) extras.reviewMonth = a.reviewMonth
    if (a.glassMode != null) extras.glassMode = a.glassMode
    if (a.largeText != null) extras.largeText = a.largeText
    if (a.themePref != null) extras.themePref = a.themePref
    if (a.a11yPrefs != null) extras.a11yPrefs = a.a11yPrefs
    if (a.notificationSettings != null) extras.notificationSettings = a.notificationSettings
    if (Object.keys(extras).length > 0) workspaceExtras = extras
  }

  return { remoteByPortfolio, documentBlobs: documentBlobsPlain, workspaceExtras }
}

function buildMergePreview(
  source: 'pull' | 'import',
  envelope: SyncEnvelope,
  remoteByPortfolio: Map<string, PortfolioData>,
  documentBlobs?: DocumentBlobPayload[],
  workspaceExtras?: MergePreview['workspaceExtras'],
): MergePreview {
  const portfolios: MergePreview['portfolios'] = []
  const conflicts: SyncConflict[] = []
  const localList = listPortfolios()

  for (const meta of envelope.portfolios) {
    const remote = remoteByPortfolio.get(meta.id)
    if (!remote) continue

    // Prefer matching local id; else same display name (avoids Mum×2 after multi-device sync)
    const mappedId = resolveLocalPortfolioId(meta)
    const targetId = mappedId ?? meta.id
    const key = `dfc_data_v3${targetId === 'default' ? '' : `_${targetId}`}`
    const existed = localStorage.getItem(key) !== null || Boolean(mappedId)

    if (!existed) {
      portfolios.push({
        portfolioId: targetId,
        isNew: true,
        local: null,
        remote,
        conflicts: [],
      })
      continue
    }

    let local: PortfolioData
    try {
      local = loadPortfolio(targetId)
    } catch {
      portfolios.push({
        portfolioId: targetId,
        isNew: true,
        local: null,
        remote,
        conflicts: [],
      })
      continue
    }
    const found = detectConflicts(targetId, local, remote)
    conflicts.push(...found)
    portfolios.push({
      portfolioId: targetId,
      isNew: false,
      local,
      remote,
      conflicts: found,
    })
  }

  // Registry: keep local names unique when combining with remote metadata
  const registryPortfolios = mergeRegistryUnique(localList, envelope.portfolios)
  const remoteRegistry = envelope.portfolios.map((meta) => {
    const mappedId = resolveLocalPortfolioId(meta) ?? meta.id
    return { ...meta, id: mappedId }
  })
  const remoteHadDuplicateNames =
    hasDuplicatePortfolioNames(envelope.portfolios) ||
    envelope.portfolios.length > MAX_PORTFOLIOS

  return {
    source,
    portfolios,
    registryPortfolios,
    remoteRegistry,
    activePortfolioId: envelope.activePortfolioId,
    documentBlobs,
    documentBlobsSkipped: envelope.documentBlobsSkipped,
    conflicts,
    remoteHadDuplicateNames,
    workspaceExtras,
  }
}

/** Union registries without duplicate display names (case-insensitive). */
function mergeRegistryUnique(local: PortfolioMeta[], remote: PortfolioMeta[]): PortfolioMeta[] {
  // Never seed from a dirty local list — collapse name dupes first.
  const combined: PortfolioMeta[] = []
  const ids = new Set<string>()
  const names = new Set<string>()

  for (const p of local) {
    if (ids.has(p.id)) continue
    const key = portfolioNameKey(p.name)
    if (key && names.has(key)) continue
    combined.push(p)
    ids.add(p.id)
    if (key) names.add(key)
  }

  for (const p of remote) {
    if (ids.has(p.id)) continue
    const key = portfolioNameKey(p.name)
    if (key && names.has(key)) continue
    combined.push(p)
    ids.add(p.id)
    if (key) names.add(key)
  }
  return combined
}

export async function previewPull(url: string, passphrase: string): Promise<MergePreview> {
  const remote = normalizeSyncRemoteUrl(url)
  const res = await fetch(remote)
  if (!res.ok) throw new Error(`Pull failed (${res.status})`)
  setSessionSyncPassphrase(passphrase)
  const text = await res.text()
  const bytes = responseContentLength(res) ?? estimateSyncPayloadBytes(text)
  const envelope = JSON.parse(text) as SyncEnvelope
  // Do not stamp lastRemoteExportedAt until apply succeeds — otherwise a
  // failed apply makes interval/focus skip the same envelope forever.
  rememberSyncPayloadStats({
    lastRemoteBlobBytes: bytes,
    lastPullBytes: bytes,
  })
  const { remoteByPortfolio, documentBlobs, workspaceExtras } = await decryptEnvelope(
    envelope,
    passphrase,
    {
      verifyChecksum: true,
    },
  )
  return buildMergePreview('pull', envelope, remoteByPortfolio, documentBlobs, workspaceExtras)
}

export async function previewImport(file: File, passphrase: string): Promise<MergePreview> {
  const text = await file.text()
  const envelope = JSON.parse(text) as SyncEnvelope
  setSessionSyncPassphrase(passphrase)
  // Import files may be older / missing checksum — verify when present
  const { remoteByPortfolio, documentBlobs, workspaceExtras } = await decryptEnvelope(
    envelope,
    passphrase,
    {
      verifyChecksum:
        Boolean(envelope.checksum) && (envelope.v === 1 || envelope.v === 2 || envelope.v === 3),
    },
  )
  return buildMergePreview('import', envelope, remoteByPortfolio, documentBlobs, workspaceExtras)
}

/** Apply Markets / News / YouTube / prefs extras without touching portfolios.
 * Safe to call when portfolio conflicts are parked — media must still sync
 * across web, tablet, and mobile.
 */
export async function applyWorkspaceExtrasFromPreview(
  preview: MergePreview,
): Promise<void> {
  const extrasDiverged = satelliteExtrasDivergedFromLastPull()
  const shouldStampMediaSync = Boolean(
    preview.workspaceExtras?.markets != null ||
      preview.workspaceExtras?.marketQuotes != null ||
      preview.workspaceExtras?.fxRates != null ||
      preview.workspaceExtras?.news != null ||
      preview.workspaceExtras?.newsArticles != null ||
      preview.workspaceExtras?.youtube != null ||
      preview.workspaceExtras?.youtubeVideos != null ||
      preview.workspaceExtras?.navLayout != null,
  )
  if (preview.workspaceExtras?.navLayout != null) {
    importNavLayoutFromBackup(preview.workspaceExtras.navLayout)
  }
  if (preview.workspaceExtras?.bottomNavSlots != null) {
    const { importBottomNavSlotsFromBackup } = await import('../../storage/bottomNavSlots')
    importBottomNavSlotsFromBackup(preview.workspaceExtras.bottomNavSlots)
  }
  if (preview.workspaceExtras?.todayLayout != null) {
    const { importTodayLayoutFromBackup } = await import('../../storage/todayLayoutStore')
    importTodayLayoutFromBackup(preview.workspaceExtras.todayLayout)
  }
  if (preview.workspaceExtras?.hubLayout != null) {
    const { importHubLayoutFromBackup } = await import('../../storage/hubLayoutStore')
    importHubLayoutFromBackup(preview.workspaceExtras.hubLayout)
  }
  const replaceLeftovers = satelliteShouldReplaceExtrasOnImport()
  if (preview.workspaceExtras?.markets != null) {
    importMarketsFromBackup(preview.workspaceExtras.markets, { replace: replaceLeftovers })
  }
  if (
    preview.workspaceExtras?.marketQuotes != null &&
    shouldImportSyncedMarketQuotes(isBookDevice())
  ) {
    importMarketQuotesFromBackup(preview.workspaceExtras.marketQuotes)
  }
  if (
    preview.workspaceExtras?.fxRates != null &&
    shouldImportSyncedMarketQuotes(isBookDevice())
  ) {
    importFxRatesFromBackup(preview.workspaceExtras.fxRates)
  }
  if (preview.workspaceExtras?.news != null) {
    importNewsFromBackup(preview.workspaceExtras.news, { replace: replaceLeftovers })
  }
  if (preview.workspaceExtras?.newsArticles != null) {
    importNewsArticlesFromBackup(preview.workspaceExtras.newsArticles, {
      replace: replaceLeftovers,
    })
  }
  if (preview.workspaceExtras?.youtube != null) {
    importYoutubeFromBackup(preview.workspaceExtras.youtube, { replace: replaceLeftovers })
  }
  if (preview.workspaceExtras?.youtubeVideos != null) {
    importYoutubeVideosFromBackup(preview.workspaceExtras.youtubeVideos, { replace: replaceLeftovers })
  }
  if (preview.workspaceExtras?.isaRemaining != null) {
    importIsaRemainingFromBackup(preview.workspaceExtras.isaRemaining)
  }
  if (preview.workspaceExtras?.priceAlertThresholds != null) {
    importPriceAlertThresholdsFromBackup(preview.workspaceExtras.priceAlertThresholds)
  }
  if (preview.workspaceExtras?.compareWeekSnapshot != null) {
    const { importCompareWeekSnapshotFromBackup } = await import(
      '../../domain/compareWeekSnapshot'
    )
    importCompareWeekSnapshotFromBackup(preview.workspaceExtras.compareWeekSnapshot)
  }
  if (preview.workspaceExtras?.digestHighlights != null) {
    const { importDigestHighlightsFromBackup } = await import(
      '../../domain/digestHighlightsPrefs'
    )
    importDigestHighlightsFromBackup(preview.workspaceExtras.digestHighlights)
  }
  if (preview.workspaceExtras?.compareSelection != null) {
    const { importCompareSelectionFromBackup } = await import(
      '../../domain/compareSelectionPrefs'
    )
    importCompareSelectionFromBackup(preview.workspaceExtras.compareSelection)
  }
  if (preview.workspaceExtras?.recurringSort != null) {
    const { importRecurringSortFromBackup } = await import('../../domain/recurringSortPrefs')
    importRecurringSortFromBackup(preview.workspaceExtras.recurringSort)
  }
  if (preview.workspaceExtras?.holdingsDrift != null) {
    const { importHoldingsDriftFromBackup } = await import('../../domain/holdingsDrift')
    importHoldingsDriftFromBackup(preview.workspaceExtras.holdingsDrift)
  }
  if (preview.workspaceExtras?.portfolioConcentration != null) {
    const { importPortfolioConcentrationFromBackup } = await import(
      '../../domain/portfolioConcentration'
    )
    importPortfolioConcentrationFromBackup(preview.workspaceExtras.portfolioConcentration)
  }
  if (preview.workspaceExtras?.spendingFilters != null) {
    const { importSpendingFiltersFromBackup } = await import('../../domain/spendingFilterPrefs')
    importSpendingFiltersFromBackup(preview.workspaceExtras.spendingFilters)
  }
  if (preview.workspaceExtras?.newsFilter != null) {
    const { importNewsFilterFromBackup } = await import('../../domain/newsFilterPrefs')
    importNewsFilterFromBackup(preview.workspaceExtras.newsFilter)
  }
  if (preview.workspaceExtras?.todosQuickFilter != null) {
    const { importTodosQuickFilterFromBackup } = await import('../../domain/todosQuickFilterPrefs')
    importTodosQuickFilterFromBackup(preview.workspaceExtras.todosQuickFilter)
  }
  if (preview.workspaceExtras?.jobsFilter != null) {
    const { importJobsFilterFromBackup } = await import('../../domain/jobsFilterPrefs')
    importJobsFilterFromBackup(preview.workspaceExtras.jobsFilter)
  }
  if (preview.workspaceExtras?.launchPath != null) {
    const { importLaunchPathFromBackup } = await import('../../storage/launchPathStore')
    importLaunchPathFromBackup(preview.workspaceExtras.launchPath)
  }
  if (preview.workspaceExtras?.uiPanels != null) {
    const { importUiPanelsFromBackup } = await import('../../storage/uiPanelsStore')
    importUiPanelsFromBackup(preview.workspaceExtras.uiPanels)
  }
  if (preview.workspaceExtras?.settingsSections != null) {
    const { importSettingsSectionsFromBackup } = await import('../../storage/settingsSectionsStore')
    importSettingsSectionsFromBackup(preview.workspaceExtras.settingsSections)
  }
  if (preview.workspaceExtras?.marketsTagYield != null) {
    const { importMarketsTagYieldFromBackup } = await import('../../domain/marketsTagYieldPref')
    importMarketsTagYieldFromBackup(preview.workspaceExtras.marketsTagYield)
  }
  if (preview.workspaceExtras?.settingsRecentJumps != null) {
    const { importSettingsRecentJumpsFromBackup } = await import('../../domain/settingsSearch')
    importSettingsRecentJumpsFromBackup(preview.workspaceExtras.settingsRecentJumps)
  }
  if (preview.workspaceExtras?.taxYear != null) {
    const { importTaxYearFromBackup } = await import('../../domain/taxYearPref')
    importTaxYearFromBackup(preview.workspaceExtras.taxYear)
  }
  if (preview.workspaceExtras?.journalFilter != null) {
    const { importJournalFilterFromBackup } = await import('../../domain/journalFilterPref')
    importJournalFilterFromBackup(preview.workspaceExtras.journalFilter)
  }
  if (preview.workspaceExtras?.nwSparkWindow != null) {
    const { importNwSparkWindowFromBackup } = await import('../../domain/nwSparkWindowPref')
    importNwSparkWindowFromBackup(preview.workspaceExtras.nwSparkWindow)
  }
  if (preview.workspaceExtras?.webhookUrl != null) {
    const { importWebhookUrlFromBackup } = await import('../../domain/webhookUrlPref')
    importWebhookUrlFromBackup(preview.workspaceExtras.webhookUrl)
  }
  if (preview.workspaceExtras?.achievementsSeen != null) {
    const { importAchievementsSeenFromBackup } = await import('../../domain/achievementsSeenPref')
    importAchievementsSeenFromBackup(preview.workspaceExtras.achievementsSeen)
  }
  if (preview.workspaceExtras?.gettingStartedDismissed != null) {
    const { importGettingStartedDismissedFromBackup } = await import(
      '../../domain/gettingStartedDismissedPref'
    )
    importGettingStartedDismissedFromBackup(preview.workspaceExtras.gettingStartedDismissed)
  }
  if (preview.workspaceExtras?.merchantRuleSuggestionDismiss != null) {
    const { importMerchantRuleSuggestionDismissFromBackup } = await import(
      '../../domain/merchantRuleSuggestionDismissPref'
    )
    importMerchantRuleSuggestionDismissFromBackup(preview.workspaceExtras.merchantRuleSuggestionDismiss)
  }
  if (preview.workspaceExtras?.whatArrivedDismiss != null) {
    const { importWhatArrivedDismissFromBackup } = await import('../../domain/whatArrivedDismissPref')
    importWhatArrivedDismissFromBackup(preview.workspaceExtras.whatArrivedDismiss)
  }
  if (preview.workspaceExtras?.todosSort != null) {
    const { importTodosSortFromBackup } = await import('../../domain/todosSortPrefs')
    importTodosSortFromBackup(preview.workspaceExtras.todosSort)
  }
  if (preview.workspaceExtras?.jobsView != null) {
    const { importJobsViewFromBackup } = await import('../../domain/jobsViewPrefs')
    importJobsViewFromBackup(preview.workspaceExtras.jobsView)
  }
  if (preview.workspaceExtras?.liabilitiesRag != null) {
    const { importLiabilitiesRagFromBackup } = await import('../../domain/liabilitiesRagPref')
    importLiabilitiesRagFromBackup(preview.workspaceExtras.liabilitiesRag)
  }
  if (preview.workspaceExtras?.reviewMonth != null) {
    const { importReviewMonthFromBackup } = await import('../../domain/reviewMonthPref')
    importReviewMonthFromBackup(preview.workspaceExtras.reviewMonth)
  }
  if (preview.workspaceExtras?.glassMode != null) {
    const { importGlassModeFromBackup } = await import('../../domain/glassModePref')
    importGlassModeFromBackup(preview.workspaceExtras.glassMode)
  }
  if (preview.workspaceExtras?.largeText != null) {
    const { importLargeTextFromBackup } = await import('../../domain/largeTextPref')
    importLargeTextFromBackup(preview.workspaceExtras.largeText)
  }
  if (preview.workspaceExtras?.themePref != null) {
    const { importThemePrefFromBackup } = await import('../../domain/themePref')
    importThemePrefFromBackup(preview.workspaceExtras.themePref)
  }
  if (preview.workspaceExtras?.a11yPrefs != null) {
    const { importA11yPrefsFromBackup } = await import('../../domain/a11yPrefsPref')
    importA11yPrefsFromBackup(preview.workspaceExtras.a11yPrefs)
  }
  if (preview.workspaceExtras?.notificationSettings != null) {
    const { importNotificationSettingsFromBackup } = await import(
      '../../domain/notificationSettingsPref'
    )
    importNotificationSettingsFromBackup(preview.workspaceExtras.notificationSettings)
  }
  if (shouldStampMediaSync) {
    rememberSyncPayloadStats({ lastWorkspaceExtrasSyncAt: new Date().toISOString() })
    stampLastPulledExtrasHash()
  }
  // Reload drops in-memory dirty. If this satellite already had a list stamp
  // and local YouTube / News / Markets differed, keep a flush so Mini absorb
  // still gets the channel. First Unlock (no stamp) must not mark leftover
  // DAVID / 8 local channels dirty.
  if (extrasDiverged) {
    try {
      const { markLocalDataChanged } = await import('./autoSyncService')
      markLocalDataChanged()
    } catch {
      /* cycle import during isolated tests */
    }
  }
}

/**
 * Satellite REPLACE: write Mini’s portfolios as this device’s book.
 * Does not union/merge leftover holdings (local-first pickById would keep £2,811 DAVID).
 * Local-only leftover portfolios are dropped. YouTube/News extras still apply.
 */
export async function applyRemoteAsBook(
  preview: MergePreview,
  opts?: { stampHoldings?: boolean },
): Promise<{ merged: number; conflicts: SyncConflict[]; removedDupes: number }> {
  const localIds = listPortfolios().map((p) => p.id)
  const keepIds = new Set<string>()
  let merged = 0

  for (const plan of preview.portfolios) {
    savePortfolioImmediate(plan.remote, plan.portfolioId)
    keepIds.add(plan.portfolioId)
    merged++
  }

  const registry = (preview.remoteRegistry ?? preview.registryPortfolios).filter((p) =>
    keepIds.has(p.id),
  )
  localStorage.setItem(STORAGE.PORTFOLIOS, JSON.stringify(registry))

  for (const id of localIds) {
    if (keepIds.has(id)) continue
    try {
      flushSave(id)
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(STORAGE.dataKey(id))
    } catch {
      /* ignore */
    }
  }

  const { removed } = dedupePortfoliosByName()
  if (preview.activePortfolioId) {
    const ids = new Set(listPortfolios().map((p) => p.id))
    if (ids.has(preview.activePortfolioId)) {
      setActivePortfolioId(preview.activePortfolioId)
    } else {
      const remapped = preview.portfolios.find((p) => p.portfolioId)?.portfolioId
      if (remapped && ids.has(remapped)) setActivePortfolioId(remapped)
    }
  }

  if (preview.documentBlobs && preview.documentBlobs.length > 0) {
    const { importDocumentBlobs } = await import('../../storage/documentBlobStore')
    await importDocumentBlobs(preview.documentBlobs)
  }

  await applyWorkspaceExtrasFromPreview(preview)
  applyFamilyHoldingsToNamedBooks()

  if (opts?.stampHoldings !== false) stampLastPulledHoldings()

  return { merged, conflicts: preview.conflicts, removedDupes: removed.length }
}

/**
 * After a satellite REPLACE, restore this device’s dirty book rows:
 * qty edits, newly added holdings, and deletes. Remote-only ids (Mini
 * added while this device was editing) stay so pull-then-push does not
 * revert Mini. Then upload that mix — never Mini’s older book alone.
 */
export function stampLastPulledHoldings(): void {
  const ids: NonNullable<SyncConfig['lastPulledHoldingIds']> = {}
  for (const p of listPortfolios()) {
    const data = loadPortfolio(p.id)
    const cols: Record<string, number[]> = {}
    for (const collection of COLLECTIONS) {
      cols[collection] = ((data[collection] as { id: number }[] | undefined) ?? []).map(
        (row) => row.id,
      )
    }
    ids[p.id] = cols
  }
  saveSyncConfig({ ...loadSyncConfig(), lastPulledHoldingIds: ids })
  stampLastPulledScalarHashes()
  stampLastPulledHoldingHashes()
  stampLastPulledRegistryNames()
}

function loadLastPulledScalarHashes(): BookScalarHashes | null {
  try {
    const raw = localStorage.getItem(PULLED_SCALAR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookScalarHashes
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function stampLastPulledScalarHashes(): void {
  const ids: BookScalarHashes = {}
  for (const p of listPortfolios()) {
    const data = loadPortfolio(p.id)
    const fields: BookScalarHashes[string] = {}
    for (const key of BOOK_SCALAR_FIELDS) {
      fields[key] = stableHash(data[key])
    }
    ids[p.id] = fields
  }
  try {
    localStorage.setItem(PULLED_SCALAR_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
}

function loadLastPulledHoldingHashes(): BookHoldingHashes | null {
  try {
    const raw = localStorage.getItem(PULLED_HASH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookHoldingHashes
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function stampLastPulledHoldingHashes(): void {
  const ids: BookHoldingHashes = {}
  for (const p of listPortfolios()) {
    const data = loadPortfolio(p.id)
    const cols: Record<string, Record<string, string>> = {}
    for (const collection of COLLECTIONS) {
      const map: Record<string, string> = {}
      for (const row of (data[collection] as { id: number }[] | undefined) ?? []) {
        map[String(row.id)] = stableHash(row)
      }
      cols[collection] = map
    }
    ids[p.id] = cols
  }
  try {
    localStorage.setItem(PULLED_HASH_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
}

function loadLastPulledRegistryNames(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(PULLED_REGISTRY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function stampLastPulledRegistryNames(): void {
  const names: Record<string, string> = {}
  for (const p of listPortfolios()) names[p.id] = p.name
  try {
    localStorage.setItem(PULLED_REGISTRY_KEY, JSON.stringify(names))
  } catch {
    /* quota */
  }
}

export function snapshotSatelliteCreatedBooks(): Array<{
  meta: PortfolioMeta
  data: PortfolioData
}> {
  const pulled = loadSyncConfig().lastPulledHoldingIds ?? {}
  return listPortfolios()
    .filter((p) => !pulled[p.id])
    .map((p) => ({ meta: p, data: loadPortfolio(p.id) }))
}

/** After REPLACE, drop books this satellite deleted (still in last-pulled). */
export function dropSatelliteDeletedBooks(localIdsBefore: string[]): void {
  const pulled = loadSyncConfig().lastPulledHoldingIds ?? {}
  const have = new Set(localIdsBefore)
  for (const id of Object.keys(pulled)) {
    if (id === 'default' || have.has(id)) continue
    if (listPortfolios().some((p) => p.id === id)) {
      try {
        deletePortfolio(id)
      } catch {
        /* default / last book */
      }
    }
  }
}

/** After REPLACE, put back local portfolio names this satellite edited. */
export function restoreSatelliteRenamedBooks(before: PortfolioMeta[]): void {
  if (before.length === 0) return
  const byId = new Map(before.map((p) => [p.id, p]))
  const list = listPortfolios()
  let changed = false
  const next = list.map((p) => {
    const prev = byId.get(p.id)
    if (!prev || prev.name === p.name) return p
    changed = true
    return { ...p, name: prev.name }
  })
  if (changed) localStorage.setItem(STORAGE.PORTFOLIOS, JSON.stringify(next))
}

/**
 * After Mini absorb REPLACE, keep a Mini rename (Kids → Children) without
 * undoing a satellite rename Mini never made.
 */
export function restoreMiniRenamedBooks(before: PortfolioMeta[]): void {
  if (before.length === 0) return
  const stamped = loadLastBookRegistryNames()
  if (!stamped) return
  const byId = new Map(before.map((p) => [p.id, p]))
  const list = listPortfolios()
  let changed = false
  const next = list.map((p) => {
    const prev = byId.get(p.id)
    if (!prev || prev.name === p.name) return p
    const lastName = stamped[p.id]
    if (!lastName || prev.name === lastName) return p
    changed = true
    return { ...p, name: prev.name }
  })
  if (changed) localStorage.setItem(STORAGE.PORTFOLIOS, JSON.stringify(next))
}

export function restoreSatelliteCreatedBooks(
  created: Array<{ meta: PortfolioMeta; data: PortfolioData }>,
): void {
  if (created.length === 0) return
  const list = listPortfolios()
  const have = new Set(list.map((p) => p.id))
  const next = [...list]
  for (const book of created) {
    if (have.has(book.meta.id)) continue
    next.push(book.meta)
    savePortfolioImmediate(book.data, book.meta.id)
    have.add(book.meta.id)
  }
  if (next.length !== list.length) {
    localStorage.setItem(STORAGE.PORTFOLIOS, JSON.stringify(next))
  }
}

/** Mini-only books since the last absorb/PUT stamp (Kids created on the book). */
export function snapshotMiniCreatedBooks(): Array<{
  meta: PortfolioMeta
  data: PortfolioData
}> {
  const known = new Set(lastKnownBookIds())
  return listPortfolios()
    .filter((p) => !known.has(p.id))
    .map((p) => ({ meta: p, data: loadPortfolio(p.id) }))
}

/** After Mini absorb REPLACE, drop books Mini deleted (still in the last stamp). */
export function dropMiniDeletedBooks(localIdsBefore: string[]): void {
  const known = lastKnownBookIds()
  const have = new Set(localIdsBefore)
  for (const id of known) {
    if (id === 'default' || have.has(id)) continue
    if (listPortfolios().some((p) => p.id === id)) {
      try {
        deletePortfolio(id)
      } catch {
        /* default / last book */
      }
    }
  }
}

/**
 * After Mini absorb REPLACE, put back staking / FIRE / budgets Mini edited
 * vs the last stamp. Satellite qty still wins (COLLECTIONS came from remote).
 */
function overlayNonCollectionFields(
  before: Array<{ id: string; data: PortfolioData }>,
  stamp: BookScalarHashes | null,
): void {
  if (!stamp) return
  for (const { id, data } of before) {
    if (!listPortfolios().some((p) => p.id === id)) continue
    const stamped = stamp[id]
    if (!stamped) continue
    let next = loadPortfolio(id)
    let changed = false
    for (const key of BOOK_SCALAR_FIELDS) {
      const prevHash = stamped[key]
      if (prevHash === undefined) continue
      if (stableHash(data[key]) === prevHash) continue
      next = { ...next, [key]: data[key] }
      changed = true
    }
    if (changed) savePortfolioImmediate(next, id)
  }
}

export function overlayMiniNonCollectionFields(
  before: Array<{ id: string; data: PortfolioData }>,
): void {
  overlayNonCollectionFields(before, loadLastBookScalarHashes())
}

/** After satellite dirty REPLACE, keep staking / FIRE this device edited vs last pull. */
export function overlaySatelliteNonCollectionFields(
  before: Array<{ id: string; data: PortfolioData }>,
): void {
  const stamp = loadLastPulledScalarHashes()
  if (!stamp) {
    // 1.2.163 had no pulled scalar hashes. REPLACE would wipe an unpushed
    // iPad staking / FIRE reward, then push Mini’s empty list.
    for (const { id, data } of before) {
      if (!listPortfolios().some((p) => p.id === id)) continue
      let next = loadPortfolio(id)
      let changed = false
      for (const key of BOOK_SCALAR_FIELDS) {
        if (stableHash(data[key]) === stableHash(next[key])) continue
        next = { ...next, [key]: data[key] }
        changed = true
      }
      if (changed) savePortfolioImmediate(next, id)
    }
    return
  }
  overlayNonCollectionFields(before, stamp)
}

/**
 * After Mini absorb REPLACE / merge, keep Mini’s live crypto `price` and
 * equity `livePrice` on rows Mini already had. Satellite qty / cost still
 * win. New satellite-only rows keep the remote mark until live refresh.
 */
/**
 * applyMergePreview is local-first pickById — a satellite SOL delete is
 * not a same-id conflict and would be unioned back. Drop rows Mini has
 * not edited vs the last stamp that are gone from remote.
 */
export function dropUneditedRowsDeletedOnRemote(
  before: Array<{ id: string; data: PortfolioData }>,
  preview: MergePreview,
): void {
  const stamp = loadLastBookHoldingHashes()
  if (!stamp) return
  for (const plan of preview.portfolios) {
    const stamped = stamp[plan.portfolioId]
    if (!stamped) continue
    if (!listPortfolios().some((p) => p.id === plan.portfolioId)) continue
    let next = loadPortfolio(plan.portfolioId)
    let changed = false
    const beforeData = before.find((b) => b.id === plan.portfolioId)?.data
    for (const collection of COLLECTIONS) {
      const remIds = new Set(
        ((plan.remote[collection] as { id: number }[] | undefined) ?? []).map((row) => row.id),
      )
      const prevRows = (beforeData?.[collection] as { id: number }[] | undefined) ?? []
      const rows = ((next[collection] as { id: number }[] | undefined) ?? []).filter((row) => {
        if (remIds.has(row.id)) return true
        const stampHash = stamped[collection]?.[String(row.id)]
        if (!stampHash) return true
        const prev = prevRows.find((r) => r.id === row.id)
        if (prev && stableHash(prev) !== stampHash) return true
        changed = true
        return false
      })
      next = { ...next, [collection]: rows }
    }
    if (changed) savePortfolioImmediate(next, plan.portfolioId)
  }
}

/**
 * REPLACE / local-first merge can put back a SOL Mini already deleted
 * (in the last stamp, gone from Mini before absorb). Drop those ids.
 * Satellite-only new rows are not in the stamp and stay.
 */
export function dropMiniDeletedHoldings(
  before: Array<{ id: string; data: PortfolioData }>,
): void {
  const stamp = loadLastBookHoldingHashes()
  if (!stamp) return
  for (const { id, data } of before) {
    const stamped = stamp[id]
    if (!stamped) continue
    if (!listPortfolios().some((p) => p.id === id)) continue
    let next = loadPortfolio(id)
    let changed = false
    for (const collection of COLLECTIONS) {
      const beforeIds = new Set(
        ((data[collection] as { id: number }[] | undefined) ?? []).map((row) => row.id),
      )
      const deleted = new Set(
        Object.keys(stamped[collection] ?? {})
          .map((key) => Number(key))
          .filter((rowId) => !Number.isNaN(rowId) && !beforeIds.has(rowId)),
      )
      if (deleted.size === 0) continue
      const rows = ((next[collection] as { id: number }[] | undefined) ?? []).filter((row) => {
        if (!deleted.has(row.id)) return true
        changed = true
        return false
      })
      next = { ...next, [collection]: rows }
    }
    if (changed) savePortfolioImmediate(next, id)
  }
}

export function overlayMiniLiveMarks(
  before: Array<{ id: string; data: PortfolioData }>,
): void {
  for (const { id, data } of before) {
    if (!listPortfolios().some((p) => p.id === id)) continue
    let next = loadPortfolio(id)
    let changed = false
    const prevCrypto = new Map((data.crypto ?? []).map((h) => [h.id, h]))
    const prevEq = new Map((data.equities ?? []).map((h) => [h.id, h]))
    const crypto = (next.crypto ?? []).map((h) => {
      const prev = prevCrypto.get(h.id)
      if (!prev || prev.price === h.price) return h
      changed = true
      return { ...h, price: prev.price }
    })
    const equities = (next.equities ?? []).map((h) => {
      const prev = prevEq.get(h.id)
      if (!prev || prev.livePrice === h.livePrice) return h
      changed = true
      return { ...h, livePrice: prev.livePrice }
    })
    if (changed) savePortfolioImmediate({ ...next, crypto, equities }, id)
  }
}

async function refreshMiniMarksAfterAbsorb(): Promise<void> {
  try {
    const { refreshLiveMarksAfterUnlock } = await import('../marketsQuotes')
    await refreshLiveMarksAfterUnlock()
  } catch {
    /* live marks must not fail absorb */
  }
}

/** Mini absorb REPLACE must not wipe Mini registry ops or edited scalars. */
export function overlayMiniBookAfterRemoteReplace(
  created: Array<{ meta: PortfolioMeta; data: PortfolioData }>,
  metasBefore: PortfolioMeta[],
  booksBefore: Array<{ id: string; data: PortfolioData }>,
): void {
  restoreSatelliteCreatedBooks(created)
  dropMiniDeletedBooks(metasBefore.map((p) => p.id))
  restoreMiniRenamedBooks(metasBefore)
  overlayMiniNonCollectionFields(booksBefore)
  dropMiniDeletedHoldings(booksBefore)
  overlayMiniLiveMarks(booksBefore)
}

/** After satellite REPLACE, restore this device’s unpushed book vs last pull. */
export function overlaySatelliteBookAfterRemoteReplace(
  preview: MergePreview,
  created: Array<{ meta: PortfolioMeta; data: PortfolioData }>,
  metasBefore: PortfolioMeta[],
  booksBefore: Array<{ id: string; data: PortfolioData }>,
): void {
  overlayDirtyLocalHoldings(preview)
  restoreSatelliteCreatedBooks(created)
  dropSatelliteDeletedBooks(metasBefore.map((p) => p.id))
  restoreSatelliteRenamedBooks(metasBefore)
  overlaySatelliteNonCollectionFields(booksBefore)
}

export function overlayDirtyLocalHoldings(preview: MergePreview): void {
  const lastPulled = loadSyncConfig().lastPulledHoldingIds ?? {}
  for (const plan of preview.portfolios) {
    if (!plan.local) continue
    let next = loadPortfolio(plan.portfolioId)
    let changed = false
    const pulled = lastPulled[plan.portfolioId] ?? {}
    for (const collection of COLLECTIONS) {
      const locArr = (plan.local[collection] as { id: number }[] | undefined) ?? []
      const remArr = (plan.remote[collection] as { id: number }[] | undefined) ?? []
      const locIds = new Set(locArr.map((row) => row.id))
      const remIds = new Set(remArr.map((row) => row.id))
      const known = new Set(pulled[collection] ?? [])
      // Keep local qty / satellite-only adds. Drop rows Mini deleted
      // (present on last pull, gone from remote) so pull-then-push
      // does not resurrect SOL.
      const locKept = locArr.filter((row) => remIds.has(row.id) || !known.has(row.id))
      const remOnly = remArr.filter((row) => !locIds.has(row.id) && !known.has(row.id))
      next = { ...next, [collection]: [...locKept, ...remOnly] }
      changed = true
    }
    if (changed) savePortfolioImmediate(next, plan.portfolioId)
  }
}

/** Persist a reviewed merge plan. Uses resolutions for same-id conflicts. */
export async function applyMergePreview(
  preview: MergePreview,
  resolutions: Record<string, ConflictChoice> = {},
): Promise<{ merged: number; conflicts: SyncConflict[]; removedDupes: number }> {
  let merged = 0
  for (const plan of preview.portfolios) {
    if (plan.isNew || !plan.local) {
      savePortfolioImmediate(plan.remote, plan.portfolioId)
      merged++
      continue
    }
    const scoped: Record<string, ConflictChoice> = {}
    for (const c of plan.conflicts) {
      const k = conflictKey(c)
      if (resolutions[k]) scoped[k] = resolutions[k]
    }
    const next = mergeWithResolutions(plan.local, plan.remote, scoped, plan.portfolioId)
    savePortfolioImmediate(next, plan.portfolioId)
    merged++
  }

  // preview.registryPortfolios is already name-deduped vs local
  localStorage.setItem('fcc_portfolios', JSON.stringify(preview.registryPortfolios))
  const { removed } = dedupePortfoliosByName()
  if (preview.activePortfolioId) {
    const ids = new Set(listPortfolios().map((p) => p.id))
    if (ids.has(preview.activePortfolioId)) {
      setActivePortfolioId(preview.activePortfolioId)
    }
  }

  if (preview.documentBlobs && preview.documentBlobs.length > 0) {
    const { importDocumentBlobs } = await import('../../storage/documentBlobStore')
    await importDocumentBlobs(preview.documentBlobs)
  }

  await applyWorkspaceExtrasFromPreview(preview)
  applyFamilyHoldingsToNamedBooks()

  return { merged, conflicts: preview.conflicts, removedDupes: removed.length }
}

/**
 * Advanced / conflict / file apply: satellites REPLACE Mini’s book (never union leftovers).
 * Mini (book) still reviews and unions via applyMergePreview.
 */
export async function applyReviewedPull(
  preview: MergePreview,
  resolutions: Record<string, ConflictChoice> = {},
): Promise<{ merged: number; conflicts: SyncConflict[]; removedDupes: number }> {
  if (!isBookDevice()) {
    const result = await applyRemoteAsBook(preview)
    try {
      const { refreshLiveMarksAfterUnlock } = await import('../marketsQuotes')
      await refreshLiveMarksAfterUnlock()
    } catch {
      /* live marks must not fail the replace */
    }
    return result
  }
  return applyMergePreview(preview, resolutions)
}

/**
 * Pull remote envelope. Review-first: when conflicts exist and are not fully
 * resolved, returns conflicts without writing. Otherwise applies the merge.
 */
export async function pullAndMerge(
  url: string,
  passphrase: string,
  resolutions: Record<string, ConflictChoice> = {},
): Promise<{ merged: number; conflicts: SyncConflict[]; preview?: MergePreview }> {
  const preview = await previewPull(url, passphrase)
  if (
    isBookDevice() &&
    preview.conflicts.length > 0 &&
    !allConflictsResolved(preview.conflicts, resolutions)
  ) {
    // Portfolio conflicts must not block YouTube / News / Markets extras
    await applyWorkspaceExtrasFromPreview(preview)
    return { merged: 0, conflicts: preview.conflicts, preview }
  }
  const result = await applyReviewedPull(preview, resolutions)
  return { ...result, preview }
}

/**
 * Import encrypted file. Review-first: same as pullAndMerge.
 */
export async function importEncryptedFile(
  file: File,
  passphrase: string,
  resolutions: Record<string, ConflictChoice> = {},
): Promise<{ merged: number; conflicts: SyncConflict[]; preview?: MergePreview }> {
  const preview = await previewImport(file, passphrase)
  if (
    isBookDevice() &&
    preview.conflicts.length > 0 &&
    !allConflictsResolved(preview.conflicts, resolutions)
  ) {
    await applyWorkspaceExtrasFromPreview(preview)
    return { merged: 0, conflicts: preview.conflicts, preview }
  }
  const result = await applyReviewedPull(preview, resolutions)
  return { ...result, preview }
}

/** Download encrypted envelope as a file (no remote needed). */
export async function downloadEncryptedBackup(passphrase: string): Promise<void> {
  const envelope = await buildEnvelope(passphrase)
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mydsp-sync-${new Date().toISOString().slice(0, 10)}.enc.json`
  a.click()
  URL.revokeObjectURL(url)
}
