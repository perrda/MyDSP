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
): Promise<FullBackupMeta> {
  const snap = captureFullWorkspace()
  const createdAt = new Date().toISOString()
  const id = `bk_${createdAt.replace(/[:.]/g, '-')}_${Math.random().toString(36).slice(2, 6)}`
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
  }
  await putBackup(record)
  await pruneOldBackups()
  try {
    localStorage.setItem(LAST_BACKUP_KEY, createdAt.slice(0, 10))
  } catch {
    /* ignore */
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

/** Replace entire workspace from a backup record. */
export function restoreFullWorkspace(record: FullBackupRecord): void {
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
