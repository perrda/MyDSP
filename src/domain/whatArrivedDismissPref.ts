/** Today “What arrived” dismiss fingerprint — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_what_arrived_dismissed_fp'
const META_KEY = 'mydsp_what_arrived_dismissed_fp_meta_v1'

export type WhatArrivedDismissBackup = {
  fingerprint: string
  updatedAt: string
}

export function loadWhatArrivedDismissPref(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    return typeof raw === 'string' && raw ? raw : null
  } catch {
    return null
  }
}

export function saveWhatArrivedDismissPref(
  fingerprint: string,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const next = typeof fingerprint === 'string' ? fingerprint : ''
  if (!next) return
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, next)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ fingerprint: next, updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportWhatArrivedDismissForBackup(): WhatArrivedDismissBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as WhatArrivedDismissBackup
      if (parsed && typeof parsed.fingerprint === 'string' && parsed.fingerprint) {
        return {
          fingerprint: parsed.fingerprint,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const fingerprint = localStorage.getItem(KEY)
    if (typeof fingerprint === 'string' && fingerprint) {
      return { fingerprint, updatedAt: new Date(0).toISOString() }
    }
    return null
  } catch {
    return null
  }
}

export function importWhatArrivedDismissFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as WhatArrivedDismissBackup
  if (typeof remote.fingerprint !== 'string' || !remote.fingerprint) return
  const local = exportWhatArrivedDismissForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(KEY, remote.fingerprint)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        fingerprint: remote.fingerprint,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
