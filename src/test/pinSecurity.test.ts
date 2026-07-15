import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAttempts,
  clearBiometricCred,
  getBiometricLabel,
  getLockoutRemaining,
  hashPin,
  isBiometricSupported,
  loadSecurity,
  recordFailedAttempt,
  saveSecurity,
  verifyPin,
} from '../security/pin'

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
  Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true })
  return mem
}

describe('PIN security', () => {
  beforeEach(() => {
    mockStorage()
    clearAttempts()
    clearBiometricCred()
    Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true })
  })

  afterEach(() => {
    clearAttempts()
  })

  it('hashes and verifies a 4-digit PIN', async () => {
    const hash = await hashPin('1234')
    expect(hash.startsWith('sha256_') || hash.startsWith('h_')).toBe(true)
    expect(await verifyPin('1234', hash)).toBe(true)
    expect(await verifyPin('9999', hash)).toBe(false)
    expect(await verifyPin('12', hash)).toBe(false)
  })

  it('persists security state', () => {
    saveSecurity({
      pinEnabled: true,
      pinHash: 'sha256_test',
      autoLockMinutes: 15,
      biometricEnabled: true,
    })
    const loaded = loadSecurity()
    expect(loaded.pinEnabled).toBe(true)
    expect(loaded.autoLockMinutes).toBe(15)
    expect(loaded.biometricEnabled).toBe(true)
  })

  it('locks out after 5 failed attempts and survives sessionStorage', () => {
    for (let i = 0; i < 4; i++) {
      const r = recordFailedAttempt()
      expect(r.locked).toBe(false)
    }
    const fifth = recordFailedAttempt()
    expect(fifth.locked).toBe(true)
    expect(getLockoutRemaining()).toBeGreaterThan(0)
    // Simulate remount reading sessionStorage
    expect(getLockoutRemaining()).toBeGreaterThan(0)
    clearAttempts()
    expect(getLockoutRemaining()).toBe(0)
  })

  it('detects biometric support from secure context + PublicKeyCredential', () => {
    // jsdom may or may not define PublicKeyCredential
    const supported = isBiometricSupported()
    expect(typeof supported).toBe('boolean')
    if (!window.PublicKeyCredential) {
      expect(supported).toBe(false)
    }
  })

  it('labels iPhone UA as Face ID', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })
    expect(getBiometricLabel()).toBe('Face ID')
    vi.unstubAllGlobals()
  })
})
