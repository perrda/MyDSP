const KEY = 'mydsp_settings_sections_v1'

type OpenMap = Record<string, boolean>

type Listener = () => void

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

function write(map: OpenMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
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

export function setSettingsSectionOpen(id: string, open: boolean): void {
  if (openMap[id] === open) return
  openMap = { ...openMap, [id]: open }
  write(openMap)
  emit()
}

export function openSettingsSection(id: string): void {
  setSettingsSectionOpen(id, true)
}

export function setAllSettingsSectionsOpen(ids: string[], open: boolean): void {
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
  write(openMap)
  emit()
}

export function subscribeSettingsSections(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test helper */
export function _resetSettingsSectionsForTests(): void {
  openMap = {}
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  emit()
}
