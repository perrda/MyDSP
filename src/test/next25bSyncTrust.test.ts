import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checksum } from '../services/sync/crypto'
import { scorePassphraseStrength } from '../services/sync/passphraseStrength'
import { appendSyncActivity, loadSyncActivity } from '../services/sync/syncActivity'
import {
  isAutoSyncPaused,
  pauseAutoSync,
  resumeAutoSync,
} from '../services/sync/autoSyncService'
import { loadSyncConfig, saveSyncConfig } from '../services/sync/syncService'
import {
  computeFullBackupChecksum,
  parseFullBackupFile,
  type FullBackupRecord,
} from '../storage/backupStore'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('next25b sync / backup trust', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('1: AutoSyncStatus tracks lastPullMs/lastPushMs; Dashboard syncLine shows latency', () => {
    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/lastPullMs/)
    expect(auto).toMatch(/lastPushMs/)
    expect(auto).toMatch(/Date\.now\(\) - pullStarted/)
    expect(auto).toMatch(/Date\.now\(\) - pushStarted/)

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/Synced · \$\{formatSyncLatencyMs/)
    expect(dash).toMatch(/pull/)
    expect(dash).toMatch(/getLastSyncLatencyKind/)
  })

  it('2: full backup checksum verifies on restore; included in payload', async () => {
    const record: FullBackupRecord = {
      id: 'bk_test',
      createdAt: '2026-07-15T12:00:00.000Z',
      appVersion: '1.2.41',
      label: 'Test',
      source: 'manual',
      portfolioCount: 1,
      activePortfolioId: 'default',
      portfolios: [{ id: 'default', name: 'Default', createdAt: '2026-01-01T00:00:00.000Z' }],
      blobs: { default: { version: 1, crypto: [], equities: [] } },
    }
    const sum = await computeFullBackupChecksum(record)
    expect(sum).toMatch(/^[0-9a-f]{32}$/)
    expect(sum).toBe(await checksum(JSON.stringify({
      portfolios: record.portfolios,
      activePortfolioId: record.activePortfolioId,
      blobs: record.blobs,
      markets: null,
      news: null,
      youtube: null,
      navLayout: null,
      documentBlobs: null,
    })))

    const withSum = { ...record, checksum: sum }
    const store = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(store).toMatch(/checksum mismatch/)
    expect(store).toMatch(/computeFullBackupChecksum/)
    expect(store).toMatch(/record\.checksum/)

    const parsed = parseFullBackupFile({
      kind: 'mydsp-full-backup',
      exportDate: record.createdAt,
      appVersion: record.appVersion,
      label: record.label,
      activePortfolioId: record.activePortfolioId,
      portfolios: record.portfolios,
      blobs: record.blobs,
      checksum: sum,
    })
    expect(parsed?.checksum).toBe(sum)

    const bad = { ...withSum, checksum: '0'.repeat(32) }
    expect(await computeFullBackupChecksum(bad)).not.toBe(bad.checksum)
  })

  it('3: passphrase strength meter scores length/variety', () => {
    expect(scorePassphraseStrength('').label).toBe('Empty')
    expect(scorePassphraseStrength('short').score).toBeLessThan(2)
    expect(scorePassphraseStrength('longenough').score).toBeGreaterThanOrEqual(1)
    const strong = scorePassphraseStrength('LongEnough!9x')
    expect(strong.score).toBeGreaterThanOrEqual(3)
    expect(strong.label).toMatch(/Good|Strong/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/passphrase-strength/)
    expect(settings).toMatch(/scorePassphraseStrength/)
  })

  it('4: sync activity records deviceHint; Settings shows it', () => {
    appendSyncActivity({
      source: 'push',
      message: 'Pushed',
      deviceHint: 'dev_abc123xyz',
    })
    const list = loadSyncActivity()
    expect(list[0].deviceHint).toBe('dev_abc123xyz')

    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/deviceHint:\s*meta\.deviceId/)
    expect(auto).toMatch(/deviceHint:\s*getLocalDeviceId\(\)/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/e\.deviceHint/)
  })

  it('5: pausedUntil gates auto-sync; Pause 1 hour / Resume wired', () => {
    saveSyncConfig({ remoteUrl: 'https://example.workers.dev', enabled: true })
    expect(isAutoSyncPaused()).toBe(false)
    pauseAutoSync(3_600_000)
    expect(isAutoSyncPaused()).toBe(true)
    expect(loadSyncConfig().pausedUntil).toBeTruthy()
    resumeAutoSync()
    expect(isAutoSyncPaused()).toBe(false)
    expect(loadSyncConfig().pausedUntil).toBeUndefined()

    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/isAutoSyncPaused/)
    expect(auto).toMatch(/pausedUntil/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Pause 1 hour/)
    expect(settings).toMatch(/Resume/)

    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/Pause 1 hour/)
    expect(sheet).toMatch(/pauseAutoSync/)
  })

  it('package version is 1.2.41', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.41')
  })
})
