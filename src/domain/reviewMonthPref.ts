/** Monthly Review selected month (YYYY-MM) — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_review_month_v1'
const META_KEY = 'mydsp_review_month_meta_v1'

export type ReviewMonthBackup = {
  ym: string
  updatedAt: string
}

function normalize(raw: string | null | undefined, fallback: string): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw)) return raw
  return fallback
}

function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function loadReviewMonthPref(fallback = currentYm()): string {
  try {
    return normalize(localStorage.getItem(KEY), fallback)
  } catch {
    return fallback
  }
}

export function saveReviewMonthPref(
  ym: string,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const nextYm = normalize(ym, '')
  if (!nextYm) return
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, nextYm)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ ym: nextYm, updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportReviewMonthForBackup(): ReviewMonthBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as ReviewMonthBackup
      if (typeof parsed.ym === 'string' && /^\d{4}-\d{2}$/.test(parsed.ym)) {
        return {
          ym: parsed.ym,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const ym = localStorage.getItem(KEY)
    if (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym)) {
      return { ym, updatedAt: new Date(0).toISOString() }
    }
    return null
  } catch {
    return null
  }
}

export function importReviewMonthFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as ReviewMonthBackup
  if (typeof remote.ym !== 'string' || !/^\d{4}-\d{2}$/.test(remote.ym)) return
  const local = exportReviewMonthForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(KEY, remote.ym)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        ym: remote.ym,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
