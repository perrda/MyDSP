/** Encrypted sync push/pull — optional remote URL + passphrase. */

import { normalizePortfolio, toStorageShape } from '../../domain/normalize'
import type { PortfolioData, PortfolioMeta } from '../../domain/types'
import { captureFullWorkspace } from '../../storage/backupStore'
import {
  getActivePortfolioId,
  listPortfolios,
  loadPortfolio,
  resolveLocalPortfolioId,
  savePortfolioImmediate,
  setActivePortfolioId,
  dedupePortfoliosByName,
  portfolioNameKey,
} from '../../storage/portfolioStore'
import { checksum, decryptJson, encryptJson, type EncryptedBlob } from './crypto'
import { setSessionSyncPassphrase } from './sessionPassphrase'
import {
  conflictKey,
  detectConflicts,
  mergeWithResolutions,
  type ConflictChoice,
  type SyncConflict,
} from './conflicts'
import type { DocumentBlobPayload } from '../../storage/documentBlobStore'

const CONFIG_KEY = 'mydsp_sync_config'
const DEVICE_KEY = 'mydsp_device_id'

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
   * When auto-pull finds same-id conflicts, prefer remote (other device).
   * Default true. Set false to pause and review in Settings.
   */
  autoResolveConflicts?: boolean
  lastSyncAt?: string
  lastSyncError?: string
  /** Portfolios merged on the last successful pull */
  lastMergeCount?: number
  /** Last applied remote envelope exportedAt (skip re-pull of same blob) */
  lastRemoteExportedAt?: string
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
  activePortfolioId?: string
  documentBlobs?: DocumentBlobPayload[]
  documentBlobsSkipped?: number[]
  conflicts: SyncConflict[]
}

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { remoteUrl: '', enabled: false }
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return {
      remoteUrl: normalizeSyncRemoteUrl(
        typeof parsed.remoteUrl === 'string' ? parsed.remoteUrl : '',
      ),
      enabled: Boolean(parsed.enabled),
      rememberPassphrase: Boolean(parsed.rememberPassphrase),
      autoResolveConflicts:
        parsed.autoResolveConflicts === undefined ? true : Boolean(parsed.autoResolveConflicts),
      lastSyncAt: parsed.lastSyncAt,
      lastSyncError: parsed.lastSyncError,
      lastMergeCount:
        typeof parsed.lastMergeCount === 'number' ? parsed.lastMergeCount : undefined,
      lastRemoteExportedAt:
        typeof parsed.lastRemoteExportedAt === 'string' ? parsed.lastRemoteExportedAt : undefined,
    }
  } catch {
    return { remoteUrl: '', enabled: false }
  }
}

export function saveSyncConfig(cfg: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

/**
 * Ensure Remote URL is absolute https. Without a scheme, browsers treat it as a
 * path on the app host → Push hits mydspv1…/mydsp-sync… and returns 405.
 */
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
    return 'Push unauthorized (401) — check SYNC_KEY matches ?key= in the Remote URL.'
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
): Promise<{ exportedAt: string; deviceId: string; checksum?: string } | null> {
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

export async function pushSync(url: string, passphrase: string): Promise<void> {
  setSessionSyncPassphrase(passphrase)
  const remote = normalizeSyncRemoteUrl(url)
  const envelope = await buildEnvelope(passphrase, { includeFullArchive: true })
  const res = await fetch(remote, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  if (!res.ok) {
    // Some hosts only allow POST
    const res2 = await fetch(remote, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    })
    if (!res2.ok) throw new Error(pushFailureMessage(url, res.status, res2.status))
  }
}

async function decryptEnvelope(
  envelope: SyncEnvelope,
  passphrase: string,
  opts?: { verifyChecksum?: boolean },
): Promise<{
  remoteByPortfolio: Map<string, PortfolioData>
  documentBlobs?: DocumentBlobPayload[]
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

  return { remoteByPortfolio, documentBlobs: documentBlobsPlain }
}

function buildMergePreview(
  source: 'pull' | 'import',
  envelope: SyncEnvelope,
  remoteByPortfolio: Map<string, PortfolioData>,
  documentBlobs?: DocumentBlobPayload[],
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

  return {
    source,
    portfolios,
    registryPortfolios,
    activePortfolioId: envelope.activePortfolioId,
    documentBlobs,
    documentBlobsSkipped: envelope.documentBlobsSkipped,
    conflicts,
  }
}

/** Union registries without duplicate display names (case-insensitive). */
function mergeRegistryUnique(local: PortfolioMeta[], remote: PortfolioMeta[]): PortfolioMeta[] {
  const combined = [...local]
  const ids = new Set(local.map((p) => p.id))
  const names = new Set(local.map((p) => portfolioNameKey(p.name)))

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
  const envelope = (await res.json()) as SyncEnvelope
  const { remoteByPortfolio, documentBlobs } = await decryptEnvelope(envelope, passphrase, {
    verifyChecksum: true,
  })
  return buildMergePreview('pull', envelope, remoteByPortfolio, documentBlobs)
}

export async function previewImport(file: File, passphrase: string): Promise<MergePreview> {
  const text = await file.text()
  const envelope = JSON.parse(text) as SyncEnvelope
  setSessionSyncPassphrase(passphrase)
  // Import files may be older / missing checksum — verify when present
  const { remoteByPortfolio, documentBlobs } = await decryptEnvelope(envelope, passphrase, {
    verifyChecksum: Boolean(envelope.checksum) && (envelope.v === 1 || envelope.v === 2 || envelope.v === 3),
  })
  return buildMergePreview('import', envelope, remoteByPortfolio, documentBlobs)
}

/** Persist a reviewed merge plan. Uses resolutions for same-id conflicts. */
export async function applyMergePreview(
  preview: MergePreview,
  resolutions: Record<string, ConflictChoice> = {},
): Promise<{ merged: number; conflicts: SyncConflict[] }> {
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
    const next = mergeWithResolutions(plan.local, plan.remote, scoped)
    savePortfolioImmediate(next, plan.portfolioId)
    merged++
  }

  // preview.registryPortfolios is already name-deduped vs local
  localStorage.setItem('fcc_portfolios', JSON.stringify(preview.registryPortfolios))
  dedupePortfoliosByName()
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

  return { merged, conflicts: preview.conflicts }
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
  if (preview.conflicts.length > 0 && !allConflictsResolved(preview.conflicts, resolutions)) {
    return { merged: 0, conflicts: preview.conflicts, preview }
  }
  const result = await applyMergePreview(preview, resolutions)
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
  if (preview.conflicts.length > 0 && !allConflictsResolved(preview.conflicts, resolutions)) {
    return { merged: 0, conflicts: preview.conflicts, preview }
  }
  const result = await applyMergePreview(preview, resolutions)
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
