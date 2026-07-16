import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  formatOfflineJobAge,
  oldestOfflineJobAgeMs,
  retryOfflineJobNow,
  enqueueOfflineJob,
  clearOfflineQueue,
  markOfflineJobFailed,
  isOfflineJobReady,
  loadOfflineQueue,
} from '../services/offlineQueue'
import {
  clearSessionSyncPassphrase,
  getRememberPassphraseMode,
  hasRememberedSyncPassphrase,
  setSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'

function mockStorage() {
  const mem = new Map<string, string>()
  const store = {
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
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
  return mem
}

describe('next25d sync / security (1–5)', () => {
  beforeEach(() => {
    mockStorage()
    clearOfflineQueue()
    clearSessionSyncPassphrase()
  })

  afterEach(() => {
    clearOfflineQueue()
    clearSessionSyncPassphrase()
  })

  it('1: Disable PIN uses PinConfirmModal (no window.prompt)', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/PinConfirmModal/)
    expect(settings).toMatch(/disablePinOpen/)
    expect(settings).not.toMatch(/window\.prompt\('Enter your current 4-digit PIN/)
    const modal = readFileSync(resolve(__dirname, '../components/PinConfirmModal.tsx'), 'utf8')
    expect(modal).toMatch(/Confirm with PIN|Disable PIN/)
  })

  it('2: sync activity filter this device vs others', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/syncActivityFilter/)
    expect(settings).toMatch(/This device/)
    expect(settings).toMatch(/getLocalDeviceHint/)
  })

  it('3: SyncConflictSheet can copy summary', () => {
    const src = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(src).toMatch(/Copy summary/)
    expect(src).toMatch(/buildConflictSummaryText/)
  })

  it('4: offline queue age + Retry now', () => {
    enqueueOfflineJob('sync_push', { remoteUrl: 'https://example.com/sync' })
    const q = loadOfflineQueue()
    expect(oldestOfflineJobAgeMs(q)).toBeGreaterThanOrEqual(0)
    expect(formatOfflineJobAge(120_000)).toMatch(/2m/)
    markOfflineJobFailed(q[0]!.id, 'fail')
    expect(isOfflineJobReady(loadOfflineQueue()[0]!)).toBe(false)
    retryOfflineJobNow(q[0]!.id)
    expect(isOfflineJobReady(loadOfflineQueue()[0]!)).toBe(true)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Retry now/)
    expect(settings).toMatch(/oldestOfflineJobAgeMs|formatOfflineJobAge/)
  })

  it('5: passphrase remember mode 7d / forever', () => {
    setSessionSyncPassphrase('secure-pass-phrase', { remember: true, rememberMode: '7d' })
    expect(hasRememberedSyncPassphrase()).toBe(true)
    expect(getRememberPassphraseMode()).toBe('7d')
    setSessionSyncPassphrase('secure-pass-phrase', { remember: true, rememberMode: 'forever' })
    expect(getRememberPassphraseMode()).toBe('forever')
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Remember for/)
    expect(settings).toMatch(/rememberMode/)
  })
})
