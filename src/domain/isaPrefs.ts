/** ISA remaining override — syncs via fullArchive (LWW by updatedAt). */

export const ISA_REMAINING_KEY = 'mydsp_isa_remaining_gbp'
export const ISA_REMAINING_META_KEY = 'mydsp_isa_remaining_meta_v1'

export type IsaRemainingBackup = {
  remaining: string
  updatedAt: string
}

export function loadIsaRemainingDraft(): string {
  try {
    return localStorage.getItem(ISA_REMAINING_KEY) ?? ''
  } catch {
    return ''
  }
}

export function loadIsaRemainingMeta(): IsaRemainingBackup | null {
  try {
    const raw = localStorage.getItem(ISA_REMAINING_META_KEY)
    if (!raw) {
      const remaining = loadIsaRemainingDraft()
      if (!remaining) return null
      return { remaining, updatedAt: new Date(0).toISOString() }
    }
    const parsed = JSON.parse(raw) as IsaRemainingBackup
    if (!parsed || typeof parsed.remaining !== 'string') return null
    return {
      remaining: parsed.remaining,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function saveIsaRemainingDraft(remaining: string, opts?: { markDirty?: boolean }): void {
  const next: IsaRemainingBackup = {
    remaining,
    updatedAt: new Date().toISOString(),
  }
  try {
    if (remaining.trim()) localStorage.setItem(ISA_REMAINING_KEY, remaining)
    else localStorage.removeItem(ISA_REMAINING_KEY)
    localStorage.setItem(ISA_REMAINING_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportIsaRemainingForBackup(): IsaRemainingBackup | null {
  return loadIsaRemainingMeta()
}

export function importIsaRemainingFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as IsaRemainingBackup
  if (typeof remote.remaining !== 'string') return
  const local = loadIsaRemainingMeta()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    if (remote.remaining.trim()) localStorage.setItem(ISA_REMAINING_KEY, remote.remaining)
    else localStorage.removeItem(ISA_REMAINING_KEY)
    localStorage.setItem(
      ISA_REMAINING_META_KEY,
      JSON.stringify({
        remaining: remote.remaining,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
