import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  enqueueOfflineJob,
  clearOfflineQueue,
  loadOfflineQueue,
  markOfflineJobFailed,
  isOfflineJobReady,
  offlineBackoffMs,
  removeOfflineJob,
} from '../services/offlineQueue'
import { buildConflictSummaryText } from '../services/sync/conflictExport'
import type { SyncConflict } from '../services/sync/conflicts'

describe('next25 sync reliability', () => {
  beforeEach(() => {
    clearOfflineQueue()
    localStorage.clear()
  })

  it('applies exponential backoff after failed flush', () => {
    enqueueOfflineJob('sync_push', { remoteUrl: 'https://example.workers.dev' })
    const id = loadOfflineQueue()[0].id
    markOfflineJobFailed(id, 'network')
    const job = loadOfflineQueue()[0]
    expect(job.attempts).toBe(1)
    expect(job.nextRetryAt).toBeTruthy()
    expect(isOfflineJobReady(job)).toBe(false)
    expect(offlineBackoffMs(0)).toBe(2000)
    expect(offlineBackoffMs(2)).toBe(8000)
  })

  it('cancels a single offline job', () => {
    enqueueOfflineJob('quote_refresh')
    const id = loadOfflineQueue()[0].id
    removeOfflineJob(id)
    expect(loadOfflineQueue()).toHaveLength(0)
  })

  it('builds a plaintext conflict summary', () => {
    const conflicts: SyncConflict[] = [
      {
        portfolioId: 'p1',
        collection: 'crypto',
        id: 1,
        localLabel: 'BTC',
        remoteLabel: 'BTC',
        fieldDiffs: [{ field: 'qty', local: '1', remote: '2' }],
      },
    ]
    const text = buildConflictSummaryText(conflicts)
    expect(text).toMatch(/MyDSP sync conflict summary/)
    expect(text).toMatch(/qty/)
    expect(text).toMatch(/Apply merge/)
  })

  it('wires sync health dashboard, failover banner, and conflict export', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/sync-health-dashboard/)
    expect(settings).toMatch(/downloadConflictSummary/)
    expect(settings).toMatch(/markOfflineJobFailed/)
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')
    expect(app).toMatch(/QuoteFailoverBanner/)
  })
})
