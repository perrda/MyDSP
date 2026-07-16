import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  defaultDeviceNickname,
  DEVICE_NICKNAME_KEY,
  getLocalDeviceHint,
  loadDeviceNickname,
  saveDeviceNickname,
  shortDeviceId,
} from '../services/sync/deviceNickname'
import {
  buildSyncSetupText,
  copySyncSetupUrl,
  downloadSyncSetupUrl,
} from '../services/sync/syncSetupExport'
import {
  armPauseAutoResumeIfNeeded,
  flashSyncResumeCountdownToast,
  flashSyncResumedToast,
  isAutoSyncPaused,
  pauseAutoSync,
  resumeAutoSync,
} from '../services/sync/autoSyncService'
import { loadSyncConfig, saveSyncConfig } from '../services/sync/syncService'
import { loadSecurity, saveSecurity, UNLOCK_TIMEOUT_MINUTES } from '../security/pin'

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

describe('next25c sync / security', () => {
  beforeEach(() => {
    mockLocalStorage()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1: Dry-run pull button calls previewPull without applyMergePreview', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Dry-run pull/)
    expect(settings).toMatch(/Dry-run pull \(nothing written\)/)
    expect(settings).toMatch(/Need remote URL and passphrase for dry-run/)
    // Dry-run branch stages preview only — no apply call between dry-run flash and button label
    const marker = 'Need remote URL and passphrase for dry-run'
    const start = settings.indexOf(marker)
    const end = settings.indexOf('>Dry-run pull<', start) >= 0
      ? settings.indexOf('>Dry-run pull<', start)
      : settings.indexOf('Dry-run pull', start + marker.length)
    const dryHandler = settings.slice(start, end)
    expect(dryHandler).toMatch(/previewPull/)
    expect(dryHandler).not.toMatch(/applyMergePreview\(/)
  })

  it('2: device nickname persists and is used as deviceHint', () => {
    expect(shortDeviceId('dev_abcdefghij')).toBe('abcdefgh')
    expect(defaultDeviceNickname()).toMatch(/^[a-z0-9_-]{1,8}$/i)

    saveDeviceNickname('iPhone Dave')
    expect(loadDeviceNickname()).toBe('iPhone Dave')
    expect(localStorage.getItem(DEVICE_NICKNAME_KEY)).toBe('iPhone Dave')
    expect(getLocalDeviceHint()).toBe('iPhone Dave')

    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/getLocalDeviceHint/)
    expect(auto).toMatch(/deviceHint:\s*getLocalDeviceHint\(\)/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Device nickname/)
    expect(settings).toMatch(/saveDeviceNickname/)

    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/loadDeviceNickname/)
    expect(sheet).toMatch(/This device:/)
  })

  it('3: biometric unlock timeout Immediate/1/5/15 wired to SecurityProvider', () => {
    expect([...UNLOCK_TIMEOUT_MINUTES]).toEqual([0, 1, 5, 15])
    saveSecurity({
      pinEnabled: true,
      pinHash: 'x',
      autoLockMinutes: 30,
      biometricEnabled: false,
    })
    // clamp legacy 30 → 15 on load
    expect(loadSecurity().autoLockMinutes).toBe(15)

    saveSecurity({
      pinEnabled: true,
      pinHash: 'x',
      autoLockMinutes: 0,
      biometricEnabled: true,
    })
    expect(loadSecurity().autoLockMinutes).toBe(0)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Biometric unlock timeout/)
    expect(settings).toMatch(/Immediate/)
    expect(settings).toMatch(/15 min/)

    const sec = readFileSync(resolve(__dirname, '../components/SecurityProvider.tsx'), 'utf8')
    expect(sec).toMatch(/autoLockMinutes/)
    expect(sec).toMatch(/visibilityState === 'hidden'/)
    expect(sec).toMatch(/setLocked\(true\)/)
  })

  it('4: sync setup URL export never includes passphrase', async () => {
    const url = 'https://mydsp-sync.example.workers.dev?key=abc'
    const text = buildSyncSetupText(url)
    expect(text).toMatch(/Remote URL only/)
    expect(text).toContain(url)
    expect(text.toLowerCase()).not.toMatch(/passphrase:\s*\S+/)
    expect(text).toMatch(/enter your passphrase separately/i)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Copy setup URL/)
    expect(settings).toMatch(/downloadSyncSetupUrl/)
    expect(settings).toMatch(/drawSyncSetupCard/)
    expect(settings).toMatch(/sync-setup-url-card/)
    expect(settings).not.toMatch(/downloadSyncSetupUrl\(syncPass/)

    // download helper creates a blob with URL only
    const createEl = vi.spyOn(document, 'createElement')
    const click = vi.fn()
    createEl.mockReturnValue({
      href: '',
      download: '',
      click,
    } as unknown as HTMLElement)
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: revoke })
    downloadSyncSetupUrl(url)
    expect(click).toHaveBeenCalled()
    createEl.mockRestore()
    vi.unstubAllGlobals()

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) },
    })
    expect(await copySyncSetupUrl(url)).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url)
  })

  it('5: pause auto-resumes with Sync resumed toast; countdown on last 60s', () => {
    saveSyncConfig({ remoteUrl: 'https://example.workers.dev', enabled: true })
    const toasts: string[] = []
    window.addEventListener('mydsp-toast', ((ev: Event) => {
      const d = (ev as CustomEvent<{ title?: string }>).detail
      if (d?.title) toasts.push(d.title)
    }) as EventListener)

    expect(isAutoSyncPaused()).toBe(false)
    pauseAutoSync(3_000)
    expect(isAutoSyncPaused()).toBe(true)
    expect(loadSyncConfig().pausedUntil).toBeTruthy()

    // Short pause triggers countdown immediately
    expect(toasts.some((t) => t.startsWith('Sync resumes in'))).toBe(true)

    vi.advanceTimersByTime(3_100)
    expect(isAutoSyncPaused()).toBe(false)
    expect(toasts).toContain('Sync resumed')

    // Manual resume also toasts
    toasts.length = 0
    pauseAutoSync(60_000)
    resumeAutoSync({ toast: true })
    expect(toasts).toContain('Sync resumed')
    expect(loadSyncConfig().pausedUntil).toBeUndefined()

    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/flashSyncResumedToast/)
    expect(auto).toMatch(/flashSyncResumeCountdownToast/)
    expect(auto).toMatch(/armPauseAutoResumeIfNeeded/)
    expect(auto).toMatch(/schedulePauseAutoResume/)

    const toastProv = readFileSync(resolve(__dirname, '../components/ToastProvider.tsx'), 'utf8')
    expect(toastProv).toMatch(/mydsp-toast/)

    // smoke the helpers
    flashSyncResumedToast()
    flashSyncResumeCountdownToast(60)
    armPauseAutoResumeIfNeeded()
  })

  it('package version is 1.2.47', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.76')
  })
})
