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

/** User-facing message when create/rename would collide. */
export const PORTFOLIO_NAME_EXISTS_MSG = 'This portfolio name already exists.'

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

/** Optional hook — auto-sync marks dirty after local writes. */
let onPortfolioDataChanged: (() => void) | null = null

export function setOnPortfolioDataChanged(cb: (() => void) | null): void {
  onPortfolioDataChanged = cb
}

function notifyDataChanged(): void {
  try {
    onPortfolioDataChanged?.()
  } catch {
    /* ignore */
  }
}

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
  let list = readRawPortfolioList()
  if (list.length === 0) return [{ ...DEFAULT_META }]
  if (hasDuplicatePortfolioNames(list) || list.length > MAX_PORTFOLIOS) {
    dedupePortfoliosByName()
    list = readRawPortfolioList()
  }
  return list.length > 0 ? list : [{ ...DEFAULT_META }]
}

function readRawPortfolioList(): PortfolioMeta[] {
  const list = readJson<PortfolioMeta[]>(STORAGE.PORTFOLIOS)
  return Array.isArray(list) ? list : []
}

export function normalizePortfolioName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function portfolioNameKey(name: string): string {
  return normalizePortfolioName(name).toLowerCase()
}

export function hasDuplicatePortfolioNames(list: PortfolioMeta[] = readRawPortfolioList()): boolean {
  const seen = new Set<string>()
  for (const p of list) {
    const key = portfolioNameKey(p.name) || p.id
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

/** True if another portfolio already uses this name (case-insensitive). */
export function isPortfolioNameTaken(name: string, exceptId?: string): boolean {
  const key = portfolioNameKey(name)
  if (!key) return false
  return readRawPortfolioList().some((p) => p.id !== exceptId && portfolioNameKey(p.name) === key)
}

function portfolioDataWeight(portfolioId: string): number {
  try {
    const raw = localStorage.getItem(STORAGE.dataKey(portfolioId))
    if (!raw) return 0
    return raw.length
  } catch {
    return 0
  }
}

/**
 * Collapse duplicate display names (case-insensitive). Keeps one entry per name:
 * prefer `default`, then the heaviest data blob, then earliest createdAt.
 * Caps at MAX_PORTFOLIOS. Removes orphaned storage keys for discarded ids.
 */
export function dedupePortfoliosByName(): { removed: string[]; kept: number } {
  const list = readRawPortfolioList()
  if (list.length === 0) {
    writeJson(STORAGE.PORTFOLIOS, [{ ...DEFAULT_META }])
    return { removed: [], kept: 1 }
  }

  const byName = new Map<string, PortfolioMeta[]>()
  for (const p of list) {
    const key = portfolioNameKey(p.name) || p.id
    const group = byName.get(key) ?? []
    group.push(p)
    byName.set(key, group)
  }

  const kept: PortfolioMeta[] = []
  const removed: string[] = []

  for (const group of byName.values()) {
    if (group.length === 1) {
      kept.push(group[0])
      continue
    }
    const ranked = [...group].sort((a, b) => {
      if (a.id === 'default') return -1
      if (b.id === 'default') return 1
      const dw = portfolioDataWeight(b.id) - portfolioDataWeight(a.id)
      if (dw !== 0) return dw
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    })
    kept.push(ranked[0])
    for (const dup of ranked.slice(1)) {
      removed.push(dup.id)
    }
  }

  // Preserve a stable order: default first, then remaining in prior order
  const order = list.map((p) => p.id)
  kept.sort((a, b) => {
    if (a.id === 'default') return -1
    if (b.id === 'default') return 1
    return order.indexOf(a.id) - order.indexOf(b.id)
  })

  // Hard cap — prefer David + canonical family names, then earliest others
  const familyKeys = new Set(
    [DAVID_PORTFOLIO_NAME, ...FAMILY_PORTFOLIO_NAMES].map((n) => portfolioNameKey(n)),
  )
  while (kept.length > MAX_PORTFOLIOS) {
    const idx = [...kept]
      .map((p, i) => ({ p, i }))
      .reverse()
      .find(({ p }) => p.id !== 'default' && !familyKeys.has(portfolioNameKey(p.name)))
      ?.i
    const dropAt =
      idx ??
      [...kept]
        .map((p, i) => ({ p, i }))
        .reverse()
        .find(({ p }) => p.id !== 'default')?.i
    if (dropAt == null) break
    removed.push(kept[dropAt].id)
    kept.splice(dropAt, 1)
  }

  const changed =
    removed.length > 0 ||
    kept.length !== list.length ||
    kept.some((p, i) => p.id !== list[i]?.id)

  if (changed) {
    // Write clean registry first so UI heals even if blob cleanup fails
    writeJson(STORAGE.PORTFOLIOS, kept)
    const active = getActivePortfolioId()
    if (!kept.some((p) => p.id === active)) {
      setActivePortfolioId('default')
    }
    for (const id of removed) {
      if (id === 'default') continue
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
    try {
      window.dispatchEvent(
        new CustomEvent('mydsp-portfolios-deduped', {
          detail: { removed: removed.length, kept: kept.length },
        }),
      )
    } catch {
      /* ignore */
    }
  }

  return { removed, kept: kept.length }
}

/** Resolve a remote registry entry onto a local id when names match. */
export function resolveLocalPortfolioId(meta: Pick<PortfolioMeta, 'id' | 'name'>): string | null {
  const list = readRawPortfolioList()
  if (list.some((p) => p.id === meta.id)) return meta.id
  const key = portfolioNameKey(meta.name)
  if (!key) return null
  const byName = list.find((p) => portfolioNameKey(p.name) === key)
  return byName?.id ?? null
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
  notifyDataChanged()
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
    notifyDataChanged()
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
  const trimmed = normalizePortfolioName(name)
  if (!trimmed) {
    throw new Error('Portfolio name is required.')
  }
  if (isPortfolioNameTaken(trimmed)) {
    throw new Error(PORTFOLIO_NAME_EXISTS_MSG)
  }
  const list = listPortfolios()
  if (list.length >= MAX_PORTFOLIOS) {
    throw new Error(`Maximum of ${MAX_PORTFOLIOS} portfolios (David + up to 5 others).`)
  }
  const id = newPortfolioId()
  const meta: PortfolioMeta = { id, name: trimmed, createdAt: new Date().toISOString() }
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
  const trimmed = normalizePortfolioName(name)
  if (!trimmed) {
    throw new Error('Portfolio name is required.')
  }
  if (isPortfolioNameTaken(trimmed, id)) {
    throw new Error(PORTFOLIO_NAME_EXISTS_MSG)
  }
  const list = listPortfolios().map((p) => (p.id === id ? { ...p, name: trimmed } : p))
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
 * Respects MAX_PORTFOLIOS (David + up to 5). Repairs duplicate ids and names.
 */
export function bootstrapFamilyPortfolios(): { renamed: boolean; created: string[]; removedDupes: string[] } {
  // Dedupe from raw storage first so removedDupes is accurate (listPortfolios also auto-heals).
  const { removed } = dedupePortfoliosByName()
  if (!localStorage.getItem(STORAGE.PORTFOLIOS)) {
    writeJson(STORAGE.PORTFOLIOS, [{ ...DEFAULT_META }])
  }
  repairDuplicatePortfolioIds()
  let list = listPortfolios()
  let renamed = false

  const david = list.find((p) => p.id === 'default')
  // Migrate old “David Portfolio” label (and any other default name) to “David”.
  if (david && david.name !== DAVID_PORTFOLIO_NAME) {
    // If another “David” exists, rename the duplicate away first so default can be David
    if (isPortfolioNameTaken(DAVID_PORTFOLIO_NAME, 'default')) {
      const clash = list.find(
        (p) => p.id !== 'default' && portfolioNameKey(p.name) === portfolioNameKey(DAVID_PORTFOLIO_NAME),
      )
      if (clash) {
        let candidate = `${clash.name} (copy)`
        let n = 2
        while (isPortfolioNameTaken(candidate, clash.id)) {
          candidate = `${clash.name} (${n++})`
        }
        renamePortfolio(clash.id, candidate)
      }
    }
    renamePortfolio('default', DAVID_PORTFOLIO_NAME)
    renamed = true
    list = listPortfolios()
  }

  const existingNames = new Set(list.map((p) => portfolioNameKey(p.name)))
  const created: string[] = []
  for (const name of FAMILY_PORTFOLIO_NAMES) {
    if (existingNames.has(portfolioNameKey(name))) continue
    if (!canCreatePortfolio()) break
    createPortfolio(name, { empty: true })
    created.push(name)
    existingNames.add(portfolioNameKey(name))
  }

  // Final hygiene
  repairDuplicatePortfolioIds()
  const again = dedupePortfoliosByName()

  return { renamed, created, removedDupes: [...removed, ...again.removed] }
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
