/** Sync passphrase — in-memory for the tab; optionally remembered on this device. */

const REMEMBER_KEY = 'mydsp_sync_passphrase'

let sessionPassphrase: string | null = null

function normalize(passphrase: string): string | null {
  const p = passphrase.trim()
  return p.length >= 8 ? p : null
}

/** Load remembered passphrase into memory (call on app start). */
export function hydrateSessionSyncPassphrase(): string | null {
  if (sessionPassphrase) return sessionPassphrase
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return null
    const p = normalize(raw)
    sessionPassphrase = p
    return p
  } catch {
    return null
  }
}

export function setSessionSyncPassphrase(
  passphrase: string,
  opts?: { remember?: boolean },
): void {
  const p = normalize(passphrase)
  sessionPassphrase = p
  if (opts?.remember === true && p) {
    try {
      localStorage.setItem(REMEMBER_KEY, p)
    } catch {
      /* quota / private mode */
    }
  } else if (opts?.remember === false) {
    try {
      localStorage.removeItem(REMEMBER_KEY)
    } catch {
      /* ignore */
    }
  }
}

export function getSessionSyncPassphrase(): string | null {
  if (sessionPassphrase) return sessionPassphrase
  return hydrateSessionSyncPassphrase()
}

export function clearSessionSyncPassphrase(opts?: { clearRemembered?: boolean }): void {
  sessionPassphrase = null
  if (opts?.clearRemembered !== false) {
    try {
      localStorage.removeItem(REMEMBER_KEY)
    } catch {
      /* ignore */
    }
  }
}

export function hasSessionSyncPassphrase(): boolean {
  return Boolean(getSessionSyncPassphrase())
}

export function hasRememberedSyncPassphrase(): boolean {
  try {
    return Boolean(localStorage.getItem(REMEMBER_KEY))
  } catch {
    return false
  }
}
