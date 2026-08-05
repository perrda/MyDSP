/**
 * Optimistic concurrency for encrypted sync push.
 * Keep rules aligned with `sync-endpoint/worker.js`.
 */

export class SyncCasConflictError extends Error {
  readonly status = 409 as const
  readonly remoteExportedAt: string
  readonly remoteDeviceId?: string
  readonly remoteChecksum?: string

  constructor(opts: {
    remoteExportedAt: string
    remoteDeviceId?: string
    remoteChecksum?: string
    message?: string
  }) {
    super(
      opts.message ??
        `Remote changed (${opts.remoteExportedAt}). Pull and merge before pushing.`,
    )
    this.name = 'SyncCasConflictError'
    this.remoteExportedAt = opts.remoteExportedAt
    this.remoteDeviceId = opts.remoteDeviceId
    this.remoteChecksum = opts.remoteChecksum
  }
}

export function isSyncCasConflictError(e: unknown): e is SyncCasConflictError {
  return e instanceof SyncCasConflictError
}

/**
 * Decide whether a push may overwrite the stored envelope.
 * - Empty store → accept
 * - Force → accept
 * - No base header (legacy client) → accept (compat)
 * - base matches stored exportedAt → accept
 * - base mismatches → conflict
 */
export function resolveCasDecision(
  storedExportedAt: string | null | undefined,
  baseExportedAt: string | null | undefined,
  force = false,
): 'accept' | 'conflict' {
  if (force) return 'accept'
  if (!storedExportedAt) return 'accept'
  // Legacy clients omit base — allow write so older app builds still sync
  if (baseExportedAt == null || baseExportedAt === '') return 'accept'
  return baseExportedAt === storedExportedAt ? 'accept' : 'conflict'
}

/** Minimal envelope shape before KV write (ciphertext integrity is client-side). */
export function isValidSyncEnvelopeShape(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const e = data as Record<string, unknown>
  if (e.app !== 'mydsp') return false
  if (e.v !== 1 && e.v !== 2 && e.v !== 3) return false
  if (typeof e.exportedAt !== 'string' || !e.exportedAt.trim()) return false
  if (typeof e.deviceId !== 'string' || !e.deviceId.trim()) return false
  if (!e.blobs || typeof e.blobs !== 'object' || Array.isArray(e.blobs)) return false
  if (!Array.isArray(e.portfolios)) return false
  return true
}

export function parseCasConflictResponse(status: number, bodyText: string): SyncCasConflictError | null {
  if (status !== 409) return null
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>
    const remoteExportedAt =
      typeof data.exportedAt === 'string'
        ? data.exportedAt
        : typeof data.currentExportedAt === 'string'
          ? data.currentExportedAt
          : ''
    if (!remoteExportedAt) {
      return new SyncCasConflictError({
        remoteExportedAt: 'unknown',
        message: 'Remote changed (409). Pull and merge before pushing.',
      })
    }
    return new SyncCasConflictError({
      remoteExportedAt,
      remoteDeviceId: typeof data.deviceId === 'string' ? data.deviceId : undefined,
      remoteChecksum: typeof data.checksum === 'string' ? data.checksum : undefined,
    })
  } catch {
    return new SyncCasConflictError({
      remoteExportedAt: 'unknown',
      message: 'Remote changed (409). Pull and merge before pushing.',
    })
  }
}
