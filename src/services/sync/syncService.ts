/** Encrypted sync push/pull — optional remote URL + passphrase. */

import { normalizePortfolio, toStorageShape } from '../../domain/normalize'
import type { PortfolioData, PortfolioMeta } from '../../domain/types'
import { captureFullWorkspace } from '../../storage/backupStore'
import {
  getActivePortfolioId,
  listPortfolios,
  loadPortfolio,
  savePortfolioImmediate,
  setActivePortfolioId,
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
  enabled: boolean
  lastSyncAt?: string
  lastSyncError?: string
  /** Portfolios merged on the last successful pull */
  lastMergeCount?: number
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
      remoteUrl: typeof parsed.remoteUrl === 'string' ? parsed.remoteUrl : '',
      enabled: Boolean(parsed.enabled),
      lastSyncAt: parsed.lastSyncAt,
      lastSyncError: parsed.lastSyncError,
      lastMergeCount:
        typeof parsed.lastMergeCount === 'number' ? parsed.lastMergeCount : undefined,
    }
  } catch {
    return { remoteUrl: '', enabled: false }
  }
}

export function saveSyncConfig(cfg: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `dev_${crypto.randomUUID()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
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
  const envelope = await buildEnvelope(passphrase, { includeFullArchive: true })
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  if (!res.ok) {
    // Some hosts only allow POST
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    })
    if (!res2.ok) throw new Error(`Push failed (${res.status}/${res2.status})`)
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

  for (const meta of envelope.portfolios) {
    const remote = remoteByPortfolio.get(meta.id)
    if (!remote) continue
    const key = `dfc_data_v3${meta.id === 'default' ? '' : `_${meta.id}`}`
    const existed = localStorage.getItem(key) !== null
    if (!existed) {
      portfolios.push({
        portfolioId: meta.id,
        isNew: true,
        local: null,
        remote,
        conflicts: [],
      })
      continue
    }
    let local: PortfolioData
    try {
      local = loadPortfolio(meta.id)
    } catch {
      portfolios.push({
        portfolioId: meta.id,
        isNew: true,
        local: null,
        remote,
        conflicts: [],
      })
      continue
    }
    const found = detectConflicts(meta.id, local, remote)
    conflicts.push(...found)
    portfolios.push({
      portfolioId: meta.id,
      isNew: false,
      local,
      remote,
      conflicts: found,
    })
  }

  return {
    source,
    portfolios,
    registryPortfolios: envelope.portfolios,
    activePortfolioId: envelope.activePortfolioId,
    documentBlobs,
    documentBlobsSkipped: envelope.documentBlobsSkipped,
    conflicts,
  }
}

export async function previewPull(url: string, passphrase: string): Promise<MergePreview> {
  const res = await fetch(url)
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

  const existing = listPortfolios()
  const ids = new Set(existing.map((p) => p.id))
  const combined = [...existing]
  for (const p of preview.registryPortfolios) {
    if (!ids.has(p.id)) combined.push(p)
  }
  localStorage.setItem('fcc_portfolios', JSON.stringify(combined))
  if (preview.activePortfolioId) setActivePortfolioId(preview.activePortfolioId)

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
