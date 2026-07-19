/** Persist expand/collapse for page filter panels (defaults collapsed). Syncs LWW. */

const KEY = 'mydsp_ui_panels_v1'
const META_KEY = 'mydsp_ui_panels_meta_v1'

type OpenMap = Record<string, boolean>
type Listener = () => void

export type UiPanelsBackup = {
  panels: OpenMap
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
          panels: map,
          updatedAt: opts?.updatedAt || new Date().toISOString(),
        }),
      )
    } else if (opts.updatedAt) {
      localStorage.setItem(
        META_KEY,
        JSON.stringify({
          panels: map,
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

/** Panels default collapsed so list content stays above the fold. */
export function isUiPanelOpen(id: string): boolean {
  return openMap[id] === true
}

/** Nullable read for panels that need an explicit default-open first paint. */
export function getUiPanelOpenState(id: string): boolean | null {
  return Object.prototype.hasOwnProperty.call(openMap, id) ? openMap[id] === true : null
}

export function setUiPanelOpen(
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

export function subscribeUiPanels(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function exportUiPanelsForBackup(): UiPanelsBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as UiPanelsBackup
      if (parsed && typeof parsed.panels === 'object' && parsed.panels) {
        return {
          panels: { ...parsed.panels },
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const panels = read()
    if (Object.keys(panels).length === 0) return null
    return { panels, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importUiPanelsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as UiPanelsBackup
  if (!remote.panels || typeof remote.panels !== 'object') return
  const local = exportUiPanelsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const next: OpenMap = {}
  for (const [k, v] of Object.entries(remote.panels)) {
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
export function _resetUiPanelsForTests(): void {
  openMap = {}
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(META_KEY)
  } catch {
    /* ignore */
  }
  emit()
}
