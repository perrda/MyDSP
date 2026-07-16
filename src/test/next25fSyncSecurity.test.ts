import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOfflineJobErrorText } from '../services/offlineQueue'
import {
  buildSyncDiagnosticsText,
  formatRemoteBlobAge,
  formatSyncPayloadBytes,
} from '../services/sync/syncService'

describe('next25f sync / security items 1-5', () => {
  it('1: Sync health can share diagnostics with blob age, size, and device nickname', () => {
    const text = buildSyncDiagnosticsText(
      {
        remoteUrl: 'https://example.invalid/sync',
        enabled: true,
        lastRemoteExportedAt: '2026-07-16T00:00:00.000Z',
        lastRemoteBlobBytes: 1536,
        lastPullBytes: 1024,
        lastPushBytes: 2048,
      },
      'Pixel Fold',
      Date.parse('2026-07-16T02:00:00.000Z'),
    )
    expect(formatRemoteBlobAge('2026-07-16T00:00:00.000Z', Date.parse('2026-07-16T02:00:00.000Z'))).toBe(
      '2h old',
    )
    expect(formatSyncPayloadBytes(1536)).toBe('1.5 KB')
    expect(text).toMatch(/Device nickname: Pixel Fold/)
    expect(text).toMatch(/Remote blob age: 2h old/)
    expect(text).toMatch(/Encrypted remote blob size: 1\.5 KB/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Share diagnostics/)
    expect(settings).toMatch(/shareSyncDiagnostics\(syncCfg, deviceNickname\)/)
    expect(settings).toMatch(/blob age, encrypted size, device nickname/)
  })

  it('2: Conflict sheet has Keep-all bulk apply with a 10s Undo restore', () => {
    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/Keep all local/)
    expect(sheet).toMatch(/Keep all remote/)
    expect(sheet).toMatch(/BULK_UNDO_MS = 10_000/)
    expect(sheet).toMatch(/captureMergeUndoSnapshot/)
    expect(sheet).toMatch(/restoreMergeUndoSnapshot/)
    expect(sheet).toMatch(/Undo available for 10s/)

    const service = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(service).toMatch(/MergeUndoSnapshot/)
    expect(service).toMatch(/captureMergeUndoSnapshot/)
    expect(service).toMatch(/restoreMergeUndoSnapshot/)
  })

  it('3: Offline failed jobs expose a Share error action', () => {
    const text = buildOfflineJobErrorText(
      {
        id: 'q_test',
        type: 'sync_push',
        createdAt: '2026-07-16T00:00:00.000Z',
        remoteUrl: 'https://example.invalid/sync',
        note: 'Flush failed',
        attempts: 2,
        nextRetryAt: '2026-07-16T00:05:00.000Z',
      },
      Date.parse('2026-07-16T00:10:00.000Z'),
    )
    expect(text).toMatch(/MyDSP offline job error/)
    expect(text).toMatch(/Attempts: 2/)
    expect(text).toMatch(/Error: Flush failed/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Share error/)
    expect(settings).toMatch(/shareOfflineJobError\(j\)/)
    expect(settings).toMatch(/\(j\.attempts \?\? 0\) > 0 && j\.note/)
  })

  it('4: existing 1.2.60 sync health and keep-all surfaces remain intact', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Remote blob:/)
    expect(settings).toMatch(/formatRemoteBlobAge/)
    expect(settings).toMatch(/formatSyncPayloadBytes/)

    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/applyMergePreview/)
    expect(sheet).toMatch(/clearPendingAutoSyncConflicts/)
    expect(sheet).toMatch(/bulkChoice/)
  })

  it('5: privacy mode blocks conflict summary sharing in SyncConflictSheet', () => {
    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/usePortfolio/)
    expect(sheet).toMatch(/const \{ privacy \} = usePortfolio\(\)/)
    expect(sheet).toMatch(/Privacy mode is on/)
    expect(sheet).toMatch(/share\/copy is blocked/)
    expect(sheet).toMatch(/disabled=\{privacy\}/)
    expect(sheet).toMatch(/Privacy blocks sharing/)
  })
})
