/** Money / Plan hub tile order. Syncs through fullArchive using updatedAt LWW. */

import {
  HOUSEHOLD_DOORS,
  MONEY_DIRECTORY,
  MONEY_DOORS,
  PLAN_DOORS,
  type HubDoor,
} from '../domain/hubPages'

const KEY = 'mydsp.hub.layout.v1'
const EVENT = 'mydsp-hub-layout'

export type HubLayout = {
  moneyDoors: string[]
  moneyDirectory: string[]
  planDoors: string[]
  householdDoors: string[]
  updatedAt: string
}

export const DEFAULT_MONEY_DOOR_ORDER: readonly string[] = MONEY_DOORS.map((d) => d.to)
export const DEFAULT_MONEY_DIRECTORY_ORDER: readonly string[] = MONEY_DIRECTORY.map((d) => d.to)
export const DEFAULT_PLAN_DOOR_ORDER: readonly string[] = PLAN_DOORS.map((d) => d.to)
export const DEFAULT_HOUSEHOLD_DOOR_ORDER: readonly string[] = HOUSEHOLD_DOORS.map((d) => d.to)

const MONEY_DOOR_IDS = new Set(DEFAULT_MONEY_DOOR_ORDER)
const MONEY_DIRECTORY_IDS = new Set(DEFAULT_MONEY_DIRECTORY_ORDER)
const PLAN_DOOR_IDS = new Set(DEFAULT_PLAN_DOOR_ORDER)
const HOUSEHOLD_DOOR_IDS = new Set(DEFAULT_HOUSEHOLD_DOOR_ORDER)

function normalizeUniqueIds(raw: unknown, valid: Set<string>, fallback: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (typeof value !== 'string' || !valid.has(value) || seen.has(value)) continue
      seen.add(value)
      out.push(value)
    }
  }
  for (const id of fallback) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

function normalizeLayout(raw: unknown): HubLayout {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    moneyDoors: normalizeUniqueIds(record.moneyDoors, MONEY_DOOR_IDS, DEFAULT_MONEY_DOOR_ORDER),
    moneyDirectory: normalizeUniqueIds(
      record.moneyDirectory,
      MONEY_DIRECTORY_IDS,
      DEFAULT_MONEY_DIRECTORY_ORDER,
    ),
    planDoors: normalizeUniqueIds(record.planDoors, PLAN_DOOR_IDS, DEFAULT_PLAN_DOOR_ORDER),
    householdDoors: normalizeUniqueIds(
      record.householdDoors,
      HOUSEHOLD_DOOR_IDS,
      DEFAULT_HOUSEHOLD_DOOR_ORDER,
    ),
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
  }
}

export function orderHubDoors(catalog: readonly HubDoor[], order: readonly string[]): HubDoor[] {
  const byTo = new Map(catalog.map((d) => [d.to, d]))
  const out: HubDoor[] = []
  for (const to of order) {
    const door = byTo.get(to)
    if (!door) continue
    out.push(door)
    byTo.delete(to)
  }
  for (const door of catalog) {
    if (byTo.has(door.to)) out.push(door)
  }
  return out
}

export function loadHubLayout(): HubLayout {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeLayout(JSON.parse(raw)) : normalizeLayout(null)
  } catch {
    return normalizeLayout(null)
  }
}

export function saveHubLayout(
  patch: Partial<
    Pick<HubLayout, 'moneyDoors' | 'moneyDirectory' | 'planDoors' | 'householdDoors'>
  >,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): HubLayout {
  const current = loadHubLayout()
  const next = normalizeLayout({
    moneyDoors: patch.moneyDoors ?? current.moneyDoors,
    moneyDirectory: patch.moneyDirectory ?? current.moneyDirectory,
    planDoors: patch.planDoors ?? current.planDoors,
    householdDoors: patch.householdDoors ?? current.householdDoors,
    updatedAt: new Date().toISOString(),
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* private mode */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((module) =>
      module.markWorkspaceChangedForSync(),
    )
  }
  return next
}

export function subscribeHubLayout(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

export function exportHubLayoutForBackup(): HubLayout | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeLayout(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function importHubLayoutFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = normalizeLayout(raw)
  const local = exportHubLayoutForBackup()
  const remoteAt = Date.parse(remote.updatedAt) || 0
  const localAt = Date.parse(local?.updatedAt ?? '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(KEY, JSON.stringify(remote))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* private mode */
  }
}
