/** Sync passphrase — in-memory for the tab; optionally remembered with expiry. */

const REMEMBER_KEY = 'mydsp_sync_passphrase'
const REMEMBER_META_KEY = 'mydsp_sync_passphrase_meta_v1'

export type RememberPassphraseMode = 'session' | '7d' | 'forever'

interface RememberMeta {
  mode: RememberPassphraseMode
  /** ISO expiry; null/undefined = forever */
  expiresAt?: string | null
}

let sessionPassphrase: string | null = null

function normalize(passphrase: string): string | null {
  const p = passphrase.trim()
  return p.length >= 8 ? p : null
}

function readMeta(): RememberMeta | null {
  try {
    const raw = localStorage.getItem(REMEMBER_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberMeta>
    if (!parsed || typeof parsed !== 'object') return null
    const mode =
      parsed.mode === '7d' || parsed.mode === 'forever' || parsed.mode === 'session'
        ? parsed.mode
        : 'forever'
    return {
      mode,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
    }
  } catch {
    return null
  }
}

function writeMeta(meta: RememberMeta | null): void {
  try {
    if (!meta || meta.mode === 'session') {
      localStorage.removeItem(REMEMBER_META_KEY)
      return
    }
    localStorage.setItem(REMEMBER_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

function clearRememberedStorage(): void {
  try {
    localStorage.removeItem(REMEMBER_KEY)
    localStorage.removeItem(REMEMBER_META_KEY)
  } catch {
    /* ignore */
  }
}

function isExpired(meta: RememberMeta | null): boolean {
  if (!meta?.expiresAt) return false
  const t = new Date(meta.expiresAt).getTime()
  return Number.isFinite(t) && t <= Date.now()
}

/** Load remembered passphrase into memory (call on app start). */
export function hydrateSessionSyncPassphrase(): string | null {
  if (sessionPassphrase) return sessionPassphrase
  try {
    const meta = readMeta()
    if (isExpired(meta)) {
      clearRememberedStorage()
      return null
    }
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
  opts?: { remember?: boolean; rememberMode?: RememberPassphraseMode },
): void {
  const p = normalize(passphrase)
  sessionPassphrase = p
  const mode = opts?.rememberMode ?? (opts?.remember ? 'forever' : 'session')
  const remember = opts?.remember === true || (mode !== 'session' && opts?.remember !== false)

  if (remember && p && mode !== 'session') {
    try {
      localStorage.setItem(REMEMBER_KEY, p)
      const expiresAt =
        mode === '7d' ? new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString() : null
      writeMeta({ mode, expiresAt })
    } catch {
      /* quota / private mode */
    }
  } else if (opts?.remember === false || mode === 'session') {
    clearRememberedStorage()
  }
}

export function getSessionSyncPassphrase(): string | null {
  if (sessionPassphrase) return sessionPassphrase
  return hydrateSessionSyncPassphrase()
}

export function clearSessionSyncPassphrase(opts?: { clearRemembered?: boolean }): void {
  sessionPassphrase = null
  if (opts?.clearRemembered !== false) {
    clearRememberedStorage()
  }
}

export function hasSessionSyncPassphrase(): boolean {
  return Boolean(getSessionSyncPassphrase())
}

export function hasRememberedSyncPassphrase(): boolean {
  try {
    const meta = readMeta()
    if (isExpired(meta)) {
      clearRememberedStorage()
      return false
    }
    return Boolean(localStorage.getItem(REMEMBER_KEY))
  } catch {
    return false
  }
}

export function getRememberPassphraseMode(): RememberPassphraseMode {
  if (!hasRememberedSyncPassphrase()) return 'session'
  return readMeta()?.mode ?? 'forever'
}

export function rememberPassphraseExpiresAt(): string | null {
  if (!hasRememberedSyncPassphrase()) return null
  return readMeta()?.expiresAt ?? null
}
