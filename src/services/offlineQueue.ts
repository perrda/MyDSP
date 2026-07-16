/** Offline queue with cancel + exponential backoff metadata. */

export type OfflineJobType = 'quote_refresh' | 'sync_push'

export interface OfflineJob {
  id: string
  type: OfflineJobType
  createdAt: string
  /** For sync_push: remoteUrl (passphrase never stored). */
  remoteUrl?: string
  note?: string
  /** Failed flush attempts (for backoff). */
  attempts?: number
  /** ISO time when a retry is allowed. */
  nextRetryAt?: string
}

const KEY = 'mydsp_offline_queue'
const MAX_ATTEMPTS = 6

export function loadOfflineQueue(): OfflineJob[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (j): j is OfflineJob =>
        !!j &&
        typeof j === 'object' &&
        typeof (j as OfflineJob).id === 'string' &&
        ((j as OfflineJob).type === 'quote_refresh' || (j as OfflineJob).type === 'sync_push'),
    )
  } catch {
    return []
  }
}

function save(queue: OfflineJob[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue.slice(-50)))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('mydsp-offline-queue'))
  } catch {
    /* ignore */
  }
}

export function enqueueOfflineJob(
  type: OfflineJobType,
  extra?: { remoteUrl?: string; note?: string },
): OfflineJob[] {
  const queue = loadOfflineQueue()
  if (type === 'quote_refresh' && queue.some((j) => j.type === 'quote_refresh')) {
    return queue
  }
  if (
    type === 'sync_push' &&
    extra?.remoteUrl &&
    queue.some((j) => j.type === 'sync_push' && j.remoteUrl === extra.remoteUrl)
  ) {
    return queue
  }
  const job: OfflineJob = {
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    createdAt: new Date().toISOString(),
    remoteUrl: extra?.remoteUrl,
    note: extra?.note,
    attempts: 0,
  }
  const next = [...queue, job]
  save(next)
  return next
}

export function removeOfflineJob(id: string): OfflineJob[] {
  const next = loadOfflineQueue().filter((j) => j.id !== id)
  save(next)
  return next
}

export function clearOfflineQueue(): OfflineJob[] {
  save([])
  return []
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** Backoff delay in ms after N failed attempts: 2s, 4s, 8s … capped at ~5 min. */
export function offlineBackoffMs(attempts: number): number {
  const n = Math.max(0, Math.min(attempts, MAX_ATTEMPTS))
  return Math.min(5 * 60_000, 2000 * 2 ** n)
}

export function markOfflineJobFailed(id: string, note?: string): OfflineJob[] {
  const queue = loadOfflineQueue()
  const next = queue.map((j) => {
    if (j.id !== id) return j
    const attempts = (j.attempts ?? 0) + 1
    return {
      ...j,
      attempts,
      nextRetryAt: new Date(Date.now() + offlineBackoffMs(attempts)).toISOString(),
      note: note ?? j.note,
    }
  })
  save(next)
  return next
}

export function isOfflineJobReady(job: OfflineJob, now = Date.now()): boolean {
  if (!job.nextRetryAt) return true
  const t = new Date(job.nextRetryAt).getTime()
  return !Number.isFinite(t) || t <= now
}

export function jobsReadyToFlush(queue = loadOfflineQueue(), now = Date.now()): OfflineJob[] {
  return queue.filter((j) => isOfflineJobReady(j, now))
}

/** Clear backoff so a job can be retried immediately. */
export function retryOfflineJobNow(id: string): OfflineJob[] {
  const queue = loadOfflineQueue()
  const next = queue.map((j) => {
    if (j.id !== id) return j
    return { ...j, nextRetryAt: undefined, note: j.note }
  })
  save(next)
  return next
}

/** Age of the oldest queued job in ms (0 if empty). */
export function oldestOfflineJobAgeMs(queue = loadOfflineQueue(), now = Date.now()): number {
  if (queue.length === 0) return 0
  let oldest = now
  for (const j of queue) {
    const t = new Date(j.createdAt).getTime()
    if (Number.isFinite(t) && t < oldest) oldest = t
  }
  return Math.max(0, now - oldest)
}

export function formatOfflineJobAge(ms: number): string {
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`
  if (ms < 86_400_000) return `${Math.max(1, Math.round(ms / 3_600_000))}h ago`
  return `${Math.max(1, Math.round(ms / 86_400_000))}d ago`
}
