/** Tax year selection — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_tax_year_v1'
const META_KEY = 'mydsp_tax_year_meta_v1'

export type TaxYearBackup = {
  year: string
  updatedAt: string
}

export function loadTaxYearPref(fallback: string): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (typeof raw === 'string' && raw.trim()) return raw
  } catch {
    /* ignore */
  }
  return fallback
}

export function saveTaxYearPref(
  year: string,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const nextYear = typeof year === 'string' && year.trim() ? year.trim() : ''
  if (!nextYear) return
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, nextYear)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ year: nextYear, updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportTaxYearForBackup(): TaxYearBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as TaxYearBackup
      if (typeof parsed.year === 'string' && parsed.year.trim()) {
        return {
          year: parsed.year,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const year = localStorage.getItem(KEY)
    if (typeof year === 'string' && year.trim()) {
      return { year, updatedAt: new Date(0).toISOString() }
    }
    return null
  } catch {
    return null
  }
}

export function importTaxYearFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as TaxYearBackup
  if (typeof remote.year !== 'string' || !remote.year.trim()) return
  const local = exportTaxYearForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(KEY, remote.year)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        year: remote.year,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
