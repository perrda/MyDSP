import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  estimateSyncPayloadBytes,
  formatRemoteBlobAge,
  formatSyncPayloadBytes,
} from '../services/sync/syncService'
import { summarizeSyncHighlights } from '../services/sync/syncHighlights'

describe('next25e sync / security (1-5)', () => {
  it('1: SyncStatusChip is status-only (tap Settings; no long-press sync)', () => {
    const chip = readFileSync(resolve(__dirname, '../components/SyncStatusChip.tsx'), 'utf8')
    expect(chip).not.toMatch(/LONG_PRESS_MS/)
    expect(chip).not.toMatch(/forceSyncNow/)
    expect(chip).not.toMatch(/Long-press to sync now/)
    expect(chip).toMatch(/Tap to open Settings/)
    expect(chip).toMatch(/Unlock sync/)

    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/<SyncStatusChip \/>/)
    expect(shell).toMatch(/<SyncStatusChip compact \/>/)
  })

  it('2: successful auto-sync merge toasts what arrived from syncHighlights', () => {
    expect(
      summarizeSyncHighlights({
        todoItems: [1, 2],
        jobApplications: [7],
      }),
    ).toBe("2 To Do's · 1 job application")

    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/summarizeSyncHighlights/)
    expect(auto).toMatch(/title:\s*'What arrived'/)
    expect(auto).toMatch(/setSyncHighlights\(highlights\)/)
  })

  it('3: Sync health exposes remote blob age and encrypted payload size estimates', () => {
    expect(estimateSyncPayloadBytes('abc')).toBe(3)
    expect(formatSyncPayloadBytes(1536)).toBe('1.5 KB')
    expect(formatRemoteBlobAge('2026-07-16T00:00:00.000Z', Date.parse('2026-07-16T02:00:00.000Z'))).toBe(
      '2h old',
    )

    const service = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(service).toMatch(/lastRemoteBlobBytes/)
    expect(service).toMatch(/lastPullBytes/)
    expect(service).toMatch(/lastPushBytes/)
    expect(service).toMatch(/content-length/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Remote blob:/)
    expect(settings).toMatch(/formatRemoteBlobAge/)
    expect(settings).toMatch(/formatSyncPayloadBytes/)
  })

  it('4: Settings has a passphrase rotate wizard that re-encrypts and pushes', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/passphrase-rotate-wizard/)
    expect(settings).toMatch(/Rotate sync passphrase/)
    expect(settings).toMatch(/New passphrase/)
    expect(settings).toMatch(/pushSync\(syncCfg\.remoteUrl, rotatePass\)/)
    expect(settings).toMatch(/remote now uses the new passphrase after successful push/)
    expect(settings).toMatch(/setSessionSyncPassphrase\(rotatePass/)
  })

  it('5: SyncConflictSheet supports keep-all local/remote and applies via merge APIs', () => {
    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/Keep all local/)
    expect(sheet).toMatch(/Keep all remote/)
    expect(sheet).toMatch(/applyMergePreview/)
    expect(sheet).toMatch(/clearPendingAutoSyncConflicts/)
    expect(sheet).toMatch(/conflictKey/)
    expect(sheet).toMatch(/bulkChoice/)
  })
})
