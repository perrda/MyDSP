/** Persist expand/collapse for Settings sections (defaults collapsed). Syncs LWW. */

const KEY = 'mydsp_settings_sections_v1'
const META_KEY = 'mydsp_settings_sections_meta_v1'

type OpenMap = Record<string, boolean>
type Listener = () => void

export type SettingsSectionsBackup = {
  sections: OpenMap
  updatedAt: string
}

const listeners = new Set<Listener>()

function read(): OpenMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: OpenMap = {}
    for (const [k, v] of Object.entries(parsed as OpenMap)) {
      if (typeof v === 'boolean') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function write(map: OpenMap, opts?: { fromSync?: boolean; updatedAt?: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
    if (!opts?.fromSync) {
      localStorage.setItem(
        META_KEY,
        JSON.stringify({
          sections: map,
          updatedAt: opts?.updatedAt || new Date().toISOString(),
        }),
      )
    } else if (opts.updatedAt) {
      localStorage.setItem(
        META_KEY,
        JSON.stringify({
          sections: map,
          updatedAt: opts.updatedAt,
        }),
      )
    }
  } catch {
    /* ignore */
  }
}

let openMap: OpenMap = read()

function emit() {
  for (const l of listeners) l()
}

/** Sections default collapsed so the full Settings list is scannable. */
export function isSettingsSectionOpen(id: string): boolean {
  return openMap[id] === true
}

export function setSettingsSectionOpen(
  id: string,
  open: boolean,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  if (openMap[id] === open) return
  openMap = { ...openMap, [id]: open }
  write(openMap, { fromSync: opts?.fromSync })
  emit()
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function openSettingsSection(id: string): void {
  setSettingsSectionOpen(id, true)
}

export function setAllSettingsSectionsOpen(
  ids: string[],
  open: boolean,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  let changed = false
  const next = { ...openMap }
  for (const id of ids) {
    if (next[id] !== open) {
      next[id] = open
      changed = true
    }
  }
  if (!changed) return
  openMap = next
  write(openMap, { fromSync: opts?.fromSync })
  emit()
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function subscribeSettingsSections(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function exportSettingsSectionsForBackup(): SettingsSectionsBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as SettingsSectionsBackup
      if (parsed && typeof parsed.sections === 'object' && parsed.sections) {
        return {
          sections: { ...parsed.sections },
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const sections = read()
    if (Object.keys(sections).length === 0) return null
    return { sections, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importSettingsSectionsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as SettingsSectionsBackup
  if (!remote.sections || typeof remote.sections !== 'object') return
  const local = exportSettingsSectionsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const next: OpenMap = {}
  for (const [k, v] of Object.entries(remote.sections)) {
    if (typeof v === 'boolean') next[k] = v
  }
  openMap = next
  write(next, {
    fromSync: true,
    updatedAt: remote.updatedAt || new Date().toISOString(),
  })
  emit()
}

/** Test helper */
export function _resetSettingsSectionsForTests(): void {
  openMap = {}
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(META_KEY)
  } catch {
    /* ignore */
  }
  emit()
}
