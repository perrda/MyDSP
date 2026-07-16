/** PIN + auto-lock security (FCC-compatible localStorage keys). */

const SECURITY_KEY = 'fcc_security'
const BIOMETRIC_KEY = 'fcc_biometric_cred'
const LOCKOUT_KEY = 'mydsp_pin_lockout'
const SALT = 'fcc_secure_salt_2026_v2'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000

export interface SecurityState {
  pinEnabled: boolean
  pinHash: string
  autoLockMinutes: number
  biometricEnabled: boolean
}

const DEFAULT_SECURITY: SecurityState = {
  pinEnabled: false,
  pinHash: '',
  autoLockMinutes: 5,
  biometricEnabled: false,
}

/** Allowed biometric unlock timeouts (Immediate / 1m / 5m / 15m). */
export const UNLOCK_TIMEOUT_MINUTES = [0, 1, 5, 15] as const

function clampUnlockMinutes(n: number): number {
  if (UNLOCK_TIMEOUT_MINUTES.includes(n as (typeof UNLOCK_TIMEOUT_MINUTES)[number])) return n
  // Legacy 30 → 15; anything else → default 5
  if (n >= 15) return 15
  if (n >= 5) return 5
  if (n >= 1) return 1
  return 0
}

export function loadSecurity(): SecurityState {
  try {
    const raw = localStorage.getItem(SECURITY_KEY)
    if (!raw) return { ...DEFAULT_SECURITY }
    const parsed = JSON.parse(raw) as Partial<SecurityState>
    return {
      pinEnabled: Boolean(parsed.pinEnabled),
      pinHash: typeof parsed.pinHash === 'string' ? parsed.pinHash : '',
      autoLockMinutes: clampUnlockMinutes(
        typeof parsed.autoLockMinutes === 'number' ? parsed.autoLockMinutes : 5,
      ),
      biometricEnabled: Boolean(parsed.biometricEnabled),
    }
  } catch {
    return { ...DEFAULT_SECURITY }
  }
}

export function saveSecurity(state: SecurityState): void {
  localStorage.setItem(SECURITY_KEY, JSON.stringify(state))
}

async function sha256Hash(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + SALT)
  const buf = await crypto.subtle.digest('SHA-256', data)
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256_${hex.slice(0, 32)}`
}

function fallbackHash(pin: string): string {
  let h = 5381
  const s = pin + SALT
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return `h_${(h >>> 0).toString(16)}`
}

export async function hashPin(pin: string): Promise<string> {
  try {
    return await sha256Hash(pin)
  } catch {
    return fallbackHash(pin)
  }
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!hash) return false
  if (!/^\d{4}$/.test(pin)) return false
  const a = await hashPin(pin)
  if (a === hash) return true
  // Legacy fallback compare
  return fallbackHash(pin) === hash
}

function readLockout(): { attempts: number; lockoutUntil: number } {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY)
    if (!raw) return { attempts: 0, lockoutUntil: 0 }
    const parsed = JSON.parse(raw) as { attempts?: number; lockoutUntil?: number }
    return {
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      lockoutUntil: typeof parsed.lockoutUntil === 'number' ? parsed.lockoutUntil : 0,
    }
  } catch {
    return { attempts: 0, lockoutUntil: 0 }
  }
}

function writeLockout(attempts: number, lockoutUntil: number): void {
  try {
    sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify({ attempts, lockoutUntil }))
  } catch {
    /* private mode — in-memory only this session */
  }
}

export function getLockoutRemaining(): number {
  const { lockoutUntil } = readLockout()
  return Math.max(0, lockoutUntil - Date.now())
}

export function recordFailedAttempt(): { locked: boolean; remainingMs: number } {
  const state = readLockout()
  let attempts = state.attempts + 1
  let lockoutUntil = state.lockoutUntil
  if (attempts >= MAX_ATTEMPTS) {
    lockoutUntil = Date.now() + LOCKOUT_MS
    attempts = 0
    writeLockout(attempts, lockoutUntil)
    return { locked: true, remainingMs: LOCKOUT_MS }
  }
  writeLockout(attempts, lockoutUntil)
  return { locked: false, remainingMs: getLockoutRemaining() }
}

export function clearAttempts(): void {
  writeLockout(0, 0)
}

export function loadBiometricCred(): string | null {
  return localStorage.getItem(BIOMETRIC_KEY)
}

export function saveBiometricCred(rawIdBase64: string): void {
  localStorage.setItem(BIOMETRIC_KEY, rawIdBase64)
}

export function clearBiometricCred(): void {
  localStorage.removeItem(BIOMETRIC_KEY)
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

/** True when WebAuthn platform authenticators are available (HTTPS / secure context). */
export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    typeof window.PublicKeyCredential === 'function'
  )
}

/**
 * Friendly label for the platform authenticator.
 * iPhone/iPad Safari → Face ID; older Touch ID devices → Touch ID.
 */
export function getBiometricLabel(): string {
  if (typeof navigator === 'undefined') return 'Biometrics'
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    // iPhone X+ / recent iPad → Face ID; older → Touch ID. UA alone is imperfect;
    // Face ID is the dominant unlock method on current App Store devices.
    return 'Face ID'
  }
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Touch ID'
  if (/Windows/i.test(ua)) return 'Windows Hello'
  if (/Android/i.test(ua)) return 'Biometrics'
  return 'Biometrics'
}

export async function registerBiometric(): Promise<boolean> {
  if (!isBiometricSupported()) return false
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))
    // localhost / 127.0.0.1: omit rp.id so the browser uses the effective domain
    const host = window.location.hostname
    const rpId = host === 'localhost' || host === '127.0.0.1' ? undefined : host
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: rpId ? { name: 'MyDSP', id: rpId } : { name: 'MyDSP' },
        user: { id: userId, name: 'mydsp-user', displayName: 'MyDSP' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
    if (!cred) return false
    saveBiometricCred(bufferToBase64(cred.rawId))
    return true
  } catch {
    return false
  }
}

export async function triggerBiometric(): Promise<boolean> {
  if (!isBiometricSupported()) return false
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const stored = loadBiometricCred()

  // Prefer the registered platform credential (iPhone / iPad Face ID).
  if (stored) {
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              type: 'public-key',
              id: base64ToBuffer(stored),
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      })
      if (assertion) return true
    } catch {
      /* fall through to discoverable / bare platform prompt */
    }
  }

  // Fallback: let the platform pick a discoverable credential (helps after
  // credential id mismatch across A2HS vs Safari tabs on the same host).
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return Boolean(assertion)
  } catch {
    return false
  }
}
