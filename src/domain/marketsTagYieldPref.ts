/**
 * Toggle to show Markets tag chips + Yield % sort.
 * Syncs via fullArchive (LWW by updatedAt). Default false (quieter chrome).
 */

const KEY = 'mydsp_markets_show_tag_yield_v1'
const META_KEY = 'mydsp_markets_show_tag_yield_meta_v1'

export type MarketsTagYieldBackup = {
  show: boolean
  updatedAt: string
}

export function loadShowMarketsTagYieldChips(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveShowMarketsTagYieldChips(
  show: boolean,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, show ? '1' : '0')
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ show, updatedAt }))
    }
    window.dispatchEvent(new CustomEvent('mydsp-markets-tag-yield'))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function subscribeShowMarketsTagYieldChips(onChange: () => void): () => void {
  const handler = () => onChange()
  window.addEventListener('mydsp-markets-tag-yield', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('mydsp-markets-tag-yield', handler)
    window.removeEventListener('storage', handler)
  }
}

export function exportMarketsTagYieldForBackup(): MarketsTagYieldBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as MarketsTagYieldBackup
      return {
        show: Boolean(parsed.show),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    if (localStorage.getItem(KEY) == null) return null
    return { show: loadShowMarketsTagYieldChips(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importMarketsTagYieldFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as MarketsTagYieldBackup
  const local = exportMarketsTagYieldForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const show = Boolean(remote.show)
  try {
    localStorage.setItem(KEY, show ? '1' : '0')
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        show,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
    window.dispatchEvent(new CustomEvent('mydsp-markets-tag-yield'))
  } catch {
    /* ignore */
  }
}
