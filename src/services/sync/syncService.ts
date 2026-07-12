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
import { mergePortfolio } from './merge'

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
  /** v1 = portfolios only; v2 also carries encrypted full-workspace archive */
  v: 1 | 2
  app: 'mydsp'
  exportedAt: string
  deviceId: string
  portfolios: PortfolioMeta[]
  activePortfolioId: string
  /** portfolioId → encrypted blob of storage shape */
  blobs: Record<string, EncryptedBlob>
  /** Encrypted captureFullWorkspace() snapshot (all portfolios + registry). */
  fullArchive?: EncryptedBlob
  checksum: string
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

export async function buildEnvelope(
  passphrase: string,
  opts?: { includeFullArchive?: boolean },
): Promise<SyncEnvelope> {
  setSessionSyncPassphrase(passphrase)
  const portfolios = listPortfolios()
  const activePortfolioId = getActivePortfolioId()
  const plainMap: Record<string, Record<string, unknown>> = {}
  const blobs: Record<string, EncryptedBlob> = {}

  for (const p of portfolios) {
    const data = loadPortfolio(p.id)
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

  const canonical = JSON.stringify({
    portfolios,
    activePortfolioId,
    plainMap,
    archive: archivePlain ?? null,
  })
  return {
    v: includeFull ? 2 : 1,
    app: 'mydsp',
    exportedAt: new Date().toISOString(),
    deviceId: deviceId(),
    portfolios,
    activePortfolioId,
    blobs,
    fullArchive,
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

export async function pullAndMerge(
  url: string,
  passphrase: string,
  resolutions: Record<string, ConflictChoice> = {},
): Promise<{ merged: number; conflicts: SyncConflict[] }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pull failed (${res.status})`)
  setSessionSyncPassphrase(passphrase)
  const envelope = (await res.json()) as SyncEnvelope
  if (envelope.app !== 'mydsp' || (envelope.v !== 1 && envelope.v !== 2)) {
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

  const canonical =
    envelope.v === 2
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

  let merged = 0
  const conflicts: SyncConflict[] = []
  for (const meta of envelope.portfolios) {
    const remote = remoteByPortfolio.get(meta.id)
    if (!remote) continue
    let local: PortfolioData
    try {
      local = loadPortfolio(meta.id)
    } catch {
      local = remote
    }
    const key = `dfc_data_v3${meta.id === 'default' ? '' : `_${meta.id}`}`
    const existed = localStorage.getItem(key) !== null
    if (!existed) {
      savePortfolioImmediate(remote, meta.id)
      merged++
      continue
    }
    const found = detectConflicts(meta.id, local, remote)
    conflicts.push(...found)
    const scoped: Record<string, ConflictChoice> = {}
    for (const c of found) {
      const k = conflictKey(c)
      if (resolutions[k]) scoped[k] = resolutions[k]
    }
    const next =
      Object.keys(scoped).length > 0 || found.length === 0
        ? mergeWithResolutions(local, remote, scoped)
        : mergeWithResolutions(local, remote, {})
    savePortfolioImmediate(next, meta.id)
    merged++
  }

  const existing = listPortfolios()
  const ids = new Set(existing.map((p) => p.id))
  const combined = [...existing]
  for (const p of envelope.portfolios) {
    if (!ids.has(p.id)) combined.push(p)
  }
  localStorage.setItem('fcc_portfolios', JSON.stringify(combined))
  if (envelope.activePortfolioId) setActivePortfolioId(envelope.activePortfolioId)

  return { merged, conflicts }
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

export async function importEncryptedFile(
  file: File,
  passphrase: string,
): Promise<{ merged: number }> {
  const text = await file.text()
  const envelope = JSON.parse(text) as SyncEnvelope
  if (envelope.app !== 'mydsp') throw new Error('Not a MyDSP sync file')

  let merged = 0
  for (const meta of envelope.portfolios) {
    const blob = envelope.blobs[meta.id]
    if (!blob) continue
    const remoteShape = await decryptJson<Record<string, unknown>>(blob, passphrase)
    const remote = normalizePortfolio(remoteShape)
    const key = `dfc_data_v3${meta.id === 'default' ? '' : `_${meta.id}`}`
    const existed = localStorage.getItem(key) !== null
    const local = existed ? loadPortfolio(meta.id) : remote
    const next = existed ? mergePortfolio(local, remote) : remote
    savePortfolioImmediate(next, meta.id)
    merged++
  }
  const existing = listPortfolios()
  const ids = new Set(existing.map((p) => p.id))
  const combined = [...existing]
  for (const p of envelope.portfolios) {
    if (!ids.has(p.id)) combined.push(p)
  }
  localStorage.setItem('fcc_portfolios', JSON.stringify(combined))
  return { merged }
}
