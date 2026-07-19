/** Jobs viewMode + list sort — syncs via fullArchive (LWW by updatedAt). */

import type { JobSortBy } from './job-types'

export const JOBS_VIEW_KEY = 'mydsp_jobs_view_v1'
export const JOBS_VIEW_META_KEY = 'mydsp_jobs_view_meta_v1'

export type JobsViewMode = 'kanban' | 'list' | 'analytics'

const ALLOWED_VIEW: ReadonlySet<JobsViewMode> = new Set(['kanban', 'list', 'analytics'])
const ALLOWED_SORT: ReadonlySet<JobSortBy> = new Set([
  'applied-desc',
  'applied-asc',
  'deadline-asc',
  'salary-desc',
  'rating-desc',
  'updated-desc',
  'company-asc',
])

export type JobsViewBackup = {
  viewMode: JobsViewMode
  sortBy: JobSortBy
  updatedAt: string
}

function normalizeView(raw: string | null | undefined): JobsViewMode {
  if (raw && ALLOWED_VIEW.has(raw as JobsViewMode)) return raw as JobsViewMode
  return 'kanban'
}

function normalizeSort(raw: string | null | undefined): JobSortBy {
  if (raw && ALLOWED_SORT.has(raw as JobSortBy)) return raw as JobSortBy
  return 'updated-desc'
}

export function loadJobsView(): { viewMode: JobsViewMode; sortBy: JobSortBy } {
  try {
    const raw = localStorage.getItem(JOBS_VIEW_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<JobsViewBackup>
      return {
        viewMode: normalizeView(parsed.viewMode),
        sortBy: normalizeSort(parsed.sortBy),
      }
    }
  } catch {
    /* ignore */
  }
  return { viewMode: 'kanban', sortBy: 'updated-desc' }
}

export function saveJobsView(
  next: { viewMode?: JobsViewMode; sortBy?: JobSortBy },
  opts?: { markDirty?: boolean },
): void {
  const current = loadJobsView()
  const viewMode = normalizeView(next.viewMode ?? current.viewMode)
  const sortBy = normalizeSort(next.sortBy ?? current.sortBy)
  const payload: JobsViewBackup = {
    viewMode,
    sortBy,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(JOBS_VIEW_KEY, JSON.stringify({ viewMode, sortBy }))
    localStorage.setItem(JOBS_VIEW_META_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportJobsViewForBackup(): JobsViewBackup | null {
  try {
    const metaRaw = localStorage.getItem(JOBS_VIEW_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as JobsViewBackup
      return {
        viewMode: normalizeView(parsed.viewMode),
        sortBy: normalizeSort(parsed.sortBy),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    const loaded = loadJobsView()
    return { ...loaded, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importJobsViewFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as JobsViewBackup
  const local = exportJobsViewForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const viewMode = normalizeView(typeof remote.viewMode === 'string' ? remote.viewMode : 'kanban')
  const sortBy = normalizeSort(typeof remote.sortBy === 'string' ? remote.sortBy : 'updated-desc')
  try {
    localStorage.setItem(JOBS_VIEW_KEY, JSON.stringify({ viewMode, sortBy }))
    localStorage.setItem(
      JOBS_VIEW_META_KEY,
      JSON.stringify({
        viewMode,
        sortBy,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
