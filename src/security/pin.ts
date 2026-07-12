/** PIN + auto-lock security (FCC-compatible localStorage keys). */

const SECURITY_KEY = 'fcc_security'
const BIOMETRIC_KEY = 'fcc_biometric_cred'
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

export function loadSecurity(): SecurityState {
  try {
    const raw = localStorage.getItem(SECURITY_KEY)
    if (!raw) return { ...DEFAULT_SECURITY }
    const parsed = JSON.parse(raw) as Partial<SecurityState>
    return {
      pinEnabled: Boolean(parsed.pinEnabled),
      pinHash: typeof parsed.pinHash === 'string' ? parsed.pinHash : '',
      autoLockMinutes:
        typeof parsed.autoLockMinutes === 'number' ? parsed.autoLockMinutes : 5,
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
  const a = await hashPin(pin)
  if (a === hash) return true
  // Legacy fallback compare
  return fallbackHash(pin) === hash
}

let attempts = 0
let lockoutUntil = 0

export function getLockoutRemaining(): number {
  return Math.max(0, lockoutUntil - Date.now())
}

export function recordFailedAttempt(): { locked: boolean; remainingMs: number } {
  attempts++
  if (attempts >= MAX_ATTEMPTS) {
    lockoutUntil = Date.now() + LOCKOUT_MS
    attempts = 0
    return { locked: true, remainingMs: LOCKOUT_MS }
  }
  return { locked: false, remainingMs: getLockoutRemaining() }
}

export function clearAttempts(): void {
  attempts = 0
  lockoutUntil = 0
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

export async function registerBiometric(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'MyDSP', id: window.location.hostname },
      user: { id: userId, name: 'mydsp-user', displayName: 'MyDSP' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null
  if (!cred) return false
  saveBiometricCred(bufferToBase64(cred.rawId))
  return true
}

export async function triggerBiometric(): Promise<boolean> {
  const stored = loadBiometricCred()
  if (!stored || !window.PublicKeyCredential) return false
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { type: 'public-key', id: base64ToBuffer(stored), transports: ['internal'] },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return Boolean(assertion)
  } catch {
    return false
  }
}
