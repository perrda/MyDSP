import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { normalizePortfolio, toStorageShape } from '../domain/normalize'
import type { PortfolioData, PortfolioMeta } from '../domain/types'
import { STORAGE } from './keys'

export const MAX_PORTFOLIOS = 6
export const DAVID_PORTFOLIO_NAME = 'David'
export const FAMILY_PORTFOLIO_NAMES = [
  'Mum',
  'Andrew',
  'Thomas',
  'Rebecca',
  'James King',
] as const

const DEFAULT_META: PortfolioMeta = {
  id: 'default',
  name: DAVID_PORTFOLIO_NAME,
  createdAt: new Date().toISOString(),
}

/** Unique id — Date.now() alone collides when creating several portfolios in one loop. */
function newPortfolioId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Per-portfolio debounce timers — avoids dropping edits across portfolios. */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
/** Latest unsaved snapshot per portfolio (written on flush). */
const pendingWrites = new Map<string, PortfolioData>()

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function listPortfolios(): PortfolioMeta[] {
  const list = readJson<PortfolioMeta[]>(STORAGE.PORTFOLIOS)
  if (list && list.length > 0) return list
  return [{ ...DEFAULT_META }]
}

export function getActivePortfolioId(): string {
  return localStorage.getItem(STORAGE.ACTIVE) || 'default'
}

export function setActivePortfolioId(id: string): void {
  localStorage.setItem(STORAGE.ACTIVE, id)
}

export function ensurePortfolioRegistry(): PortfolioMeta[] {
  const list = listPortfolios()
  if (!localStorage.getItem(STORAGE.PORTFOLIOS)) {
    writeJson(STORAGE.PORTFOLIOS, list)
  }
  return list
}

export function loadPortfolio(portfolioId = getActivePortfolioId()): PortfolioData {
  ensurePortfolioRegistry()
  const key = STORAGE.dataKey(portfolioId)
  const raw = readJson<unknown>(key)

  if (raw) {
    return normalizePortfolio(raw)
  }

  // First run for David (default): seed sample so Overview isn't blank.
  // Additional portfolios start empty.
  if (portfolioId === 'default') {
    const sample = createSamplePortfolio()
    savePortfolioImmediate(sample, portfolioId)
    localStorage.setItem(STORAGE.BOOTSTRAPPED, '1')
    return sample
  }

  const empty = createEmptyPortfolio()
  savePortfolioImmediate(empty, portfolioId)
  return empty
}

export function savePortfolioImmediate(
  data: PortfolioData,
  portfolioId = getActivePortfolioId(),
): void {
  const timer = saveTimers.get(portfolioId)
  if (timer) {
    clearTimeout(timer)
    saveTimers.delete(portfolioId)
  }
  pendingWrites.delete(portfolioId)
  const key = STORAGE.dataKey(portfolioId)
  writeJson(key, toStorageShape(data))
}

/** Flush any pending debounced save for a portfolio (writes immediately). */
export function flushSave(portfolioId = getActivePortfolioId()): void {
  const timer = saveTimers.get(portfolioId)
  if (timer) {
    clearTimeout(timer)
    saveTimers.delete(portfolioId)
  }
  const pending = pendingWrites.get(portfolioId)
  if (pending) {
    pendingWrites.delete(portfolioId)
    const key = STORAGE.dataKey(portfolioId)
    writeJson(key, toStorageShape(pending))
  }
}

/** Debounced save (300ms), keyed by portfolio id. */
export function savePortfolio(
  data: PortfolioData,
  portfolioId = getActivePortfolioId(),
): void {
  pendingWrites.set(portfolioId, data)
  const existing = saveTimers.get(portfolioId)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    savePortfolioImmediate(data, portfolioId)
  }, 300)
  saveTimers.set(portfolioId, timer)
}

export function canCreatePortfolio(): boolean {
  return listPortfolios().length < MAX_PORTFOLIOS
}

export function createPortfolio(
  name: string,
  opts?: { empty?: boolean },
): PortfolioMeta {
  const list = listPortfolios()
  if (list.length >= MAX_PORTFOLIOS) {
    throw new Error(`Maximum of ${MAX_PORTFOLIOS} portfolios (David + up to 5 others).`)
  }
  const id = newPortfolioId()
  const meta: PortfolioMeta = { id, name: name.trim(), createdAt: new Date().toISOString() }
  list.push(meta)
  writeJson(STORAGE.PORTFOLIOS, list)
  const seed = opts?.empty === false ? createSamplePortfolio() : createEmptyPortfolio()
  savePortfolioImmediate(seed, id)
  return meta
}

/**
 * Fix registries where several family portfolios share one id (same Date.now() ms).
 * First occurrence keeps the shared blob; later duplicates get a new id + empty data.
 */
export function repairDuplicatePortfolioIds(): boolean {
  const list = listPortfolios()
  const seen = new Set<string>()
  let changed = false
  const next: PortfolioMeta[] = []

  for (const p of list) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      next.push(p)
      continue
    }
    changed = true
    let newId = newPortfolioId()
    while (seen.has(newId) || next.some((x) => x.id === newId)) {
      newId = newPortfolioId()
    }
    seen.add(newId)
    savePortfolioImmediate(createEmptyPortfolio(), newId)
    next.push({ ...p, id: newId })
  }

  if (changed) {
    writeJson(STORAGE.PORTFOLIOS, next)
    const active = getActivePortfolioId()
    if (!next.some((p) => p.id === active)) {
      setActivePortfolioId('default')
    }
  }
  return changed
}

export function renamePortfolio(id: string, name: string): void {
  const list = listPortfolios().map((p) => (p.id === id ? { ...p, name: name.trim() } : p))
  writeJson(STORAGE.PORTFOLIOS, list)
}

export function deletePortfolio(id: string): void {
  if (id === 'default') return
  flushSave(id)
  const list = listPortfolios().filter((p) => p.id !== id)
  writeJson(STORAGE.PORTFOLIOS, list)
  localStorage.removeItem(STORAGE.dataKey(id))
  if (getActivePortfolioId() === id) setActivePortfolioId('default')
}

export function duplicatePortfolio(id: string, name: string): PortfolioMeta {
  if (!canCreatePortfolio()) {
    throw new Error(`Maximum of ${MAX_PORTFOLIOS} portfolios reached.`)
  }
  flushSave(id)
  const source = loadPortfolio(id)
  const meta = createPortfolio(name, { empty: true })
  savePortfolioImmediate(source, meta.id)
  return meta
}

/**
 * Idempotent: ensure default is “David” and family portfolios exist (empty).
 * Respects MAX_PORTFOLIOS (David + up to 5). Also repairs duplicate portfolio ids.
 */
export function bootstrapFamilyPortfolios(): { renamed: boolean; created: string[] } {
  ensurePortfolioRegistry()
  repairDuplicatePortfolioIds()
  let list = listPortfolios()
  let renamed = false

  const david = list.find((p) => p.id === 'default')
  // Migrate old “David Portfolio” label (and any other default name) to “David”.
  if (david && david.name !== DAVID_PORTFOLIO_NAME) {
    renamePortfolio('default', DAVID_PORTFOLIO_NAME)
    renamed = true
    list = listPortfolios()
  }

  const existingNames = new Set(list.map((p) => p.name.toLowerCase()))
  const created: string[] = []
  for (const name of FAMILY_PORTFOLIO_NAMES) {
    if (existingNames.has(name.toLowerCase())) continue
    if (!canCreatePortfolio()) break
    createPortfolio(name, { empty: true })
    created.push(name)
    existingNames.add(name.toLowerCase())
  }

  // Second pass in case createPortfolio somehow collided (shouldn't after unique ids).
  repairDuplicatePortfolioIds()

  return { renamed, created }
}

export function hasFccData(): boolean {
  return localStorage.getItem(STORAGE.DATA) !== null
}

export function importRawPortfolio(
  raw: unknown,
  portfolioId = getActivePortfolioId(),
): PortfolioData {
  const data = normalizePortfolio(raw)
  flushSave(portfolioId)
  savePortfolioImmediate(data, portfolioId)
  return data
}

export function exportRawPortfolio(
  portfolioId = getActivePortfolioId(),
): Record<string, unknown> {
  flushSave(portfolioId)
  const data = loadPortfolio(portfolioId)
  const ver = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
  return {
    version: `mydsp-${ver}`,
    exportDate: new Date().toISOString(),
    source: 'MyDSP',
    data: toStorageShape(data),
  }
}
