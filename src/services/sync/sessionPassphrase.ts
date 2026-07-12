/** In-memory sync passphrase for this browser tab (never written to disk). */

let sessionPassphrase: string | null = null

export function setSessionSyncPassphrase(passphrase: string): void {
  const p = passphrase.trim()
  sessionPassphrase = p.length >= 8 ? p : null
}

export function getSessionSyncPassphrase(): string | null {
  return sessionPassphrase
}

export function clearSessionSyncPassphrase(): void {
  sessionPassphrase = null
}

export function hasSessionSyncPassphrase(): boolean {
  return Boolean(sessionPassphrase && sessionPassphrase.length >= 8)
}
