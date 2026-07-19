/** API webhook URL — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_webhook_url'
const META_KEY = 'mydsp_webhook_url_meta_v1'

export type WebhookUrlBackup = {
  url: string
  updatedAt: string
}

export function loadWebhookUrlPref(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveWebhookUrlPref(
  url: string,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const next = typeof url === 'string' ? url.trim() : ''
  const updatedAt = new Date().toISOString()
  try {
    if (next) localStorage.setItem(KEY, next)
    else localStorage.removeItem(KEY)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ url: next, updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportWebhookUrlForBackup(): WebhookUrlBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as WebhookUrlBackup
      if (parsed && typeof parsed.url === 'string') {
        return {
          url: parsed.url,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const url = localStorage.getItem(KEY)
    if (typeof url === 'string' && url.trim()) {
      return { url: url.trim(), updatedAt: new Date(0).toISOString() }
    }
    return null
  } catch {
    return null
  }
}

export function importWebhookUrlFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as WebhookUrlBackup
  if (typeof remote.url !== 'string') return
  const local = exportWebhookUrlForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const url = remote.url.trim()
  try {
    if (url) localStorage.setItem(KEY, url)
    else localStorage.removeItem(KEY)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        url,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
