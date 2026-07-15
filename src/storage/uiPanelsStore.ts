/** Persist expand/collapse for page filter panels (defaults collapsed). */

const KEY = 'mydsp_ui_panels_v1'

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

export function setUiPanelOpen(id: string, open: boolean): void {
  if (openMap[id] === open) return
  openMap = { ...openMap, [id]: open }
  write(openMap)
  emit()
}

export function subscribeUiPanels(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test helper */
export function _resetUiPanelsForTests(): void {
  openMap = {}
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  emit()
}
