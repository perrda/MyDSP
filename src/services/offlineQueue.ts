/** Persist failed quote refresh / sync push until online. */

export type OfflineJobType = 'quote_refresh' | 'sync_push'

export interface OfflineJob {
  id: string
  type: OfflineJobType
  createdAt: string
  /** For sync_push: remoteUrl (passphrase never stored). */
  remoteUrl?: string
  note?: string
}

const KEY = 'mydsp_offline_queue'

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
  }
  const next = [...queue, job]
  save(next)
  window.dispatchEvent(new CustomEvent('mydsp-offline-queue'))
  return next
}

export function removeOfflineJob(id: string): OfflineJob[] {
  const next = loadOfflineQueue().filter((j) => j.id !== id)
  save(next)
  window.dispatchEvent(new CustomEvent('mydsp-offline-queue'))
  return next
}

export function clearOfflineQueue(): OfflineJob[] {
  save([])
  window.dispatchEvent(new CustomEvent('mydsp-offline-queue'))
  return []
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
