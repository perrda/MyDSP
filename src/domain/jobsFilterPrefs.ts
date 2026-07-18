/** Jobs filter (incl. Needs follow-up chip) — syncs via fullArchive (LWW by updatedAt). */

import type { JobFilterBy } from './job-types'

export const JOBS_FILTER_KEY = 'mydsp_jobs_filter_v1'
export const JOBS_FILTER_META_KEY = 'mydsp_jobs_filter_meta_v1'

const ALLOWED: ReadonlySet<JobFilterBy> = new Set([
  'all',
  'active',
  'wishlist',
  'applied',
  'interviewing',
  'offers',
  'rejected',
  'high-priority',
  'remote',
  'no-response',
  'follow-up',
])

export type JobsFilterBackup = {
  filterBy: JobFilterBy
  updatedAt: string
}

function normalize(raw: string | null | undefined): JobFilterBy {
  if (raw && ALLOWED.has(raw as JobFilterBy)) return raw as JobFilterBy
  return 'active'
}

export function loadJobsFilter(): JobFilterBy {
  try {
    return normalize(localStorage.getItem(JOBS_FILTER_KEY))
  } catch {
    return 'active'
  }
}

export function saveJobsFilter(
  filterBy: JobFilterBy,
  opts?: { markDirty?: boolean },
): void {
  const nextFilter = normalize(filterBy)
  const next: JobsFilterBackup = {
    filterBy: nextFilter,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(JOBS_FILTER_KEY, nextFilter)
    localStorage.setItem(JOBS_FILTER_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportJobsFilterForBackup(): JobsFilterBackup | null {
  try {
    const metaRaw = localStorage.getItem(JOBS_FILTER_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as JobsFilterBackup
      return {
        filterBy: normalize(parsed.filterBy),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { filterBy: loadJobsFilter(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importJobsFilterFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as JobsFilterBackup
  const local = exportJobsFilterForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const filterBy = normalize(typeof remote.filterBy === 'string' ? remote.filterBy : 'active')
  try {
    localStorage.setItem(JOBS_FILTER_KEY, filterBy)
    localStorage.setItem(
      JOBS_FILTER_META_KEY,
      JSON.stringify({
        filterBy,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
