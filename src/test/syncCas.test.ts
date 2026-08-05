import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isValidSyncEnvelopeShape,
  parseCasConflictResponse,
  resolveCasDecision,
  SyncCasConflictError,
} from '../services/sync/syncCas'

const workerSrc = () =>
  readFileSync(resolve(__dirname, '../../sync-endpoint/worker.js'), 'utf8')

describe('sync CAS (optimistic concurrency)', () => {
  it('accepts first write and matching base', () => {
    expect(resolveCasDecision(null, 'a')).toBe('accept')
    expect(resolveCasDecision(undefined, null)).toBe('accept')
    expect(resolveCasDecision('2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z')).toBe(
      'accept',
    )
  })

  it('conflicts when base mismatches stored exportedAt', () => {
    expect(resolveCasDecision('remote-v1', 'local-stale')).toBe('conflict')
  })

  it('accepts legacy clients that omit base, and force overwrite', () => {
    expect(resolveCasDecision('remote-v1', null)).toBe('accept')
    expect(resolveCasDecision('remote-v1', '')).toBe('accept')
    expect(resolveCasDecision('remote-v1', 'stale', true)).toBe('accept')
  })

  it('validates envelope shape', () => {
    expect(
      isValidSyncEnvelopeShape({
        app: 'mydsp',
        v: 2,
        exportedAt: '2026-08-05T12:00:00.000Z',
        deviceId: 'dev_1',
        portfolios: [],
        blobs: {},
      }),
    ).toBe(true)
    expect(isValidSyncEnvelopeShape({ app: 'other', v: 2 })).toBe(false)
    expect(isValidSyncEnvelopeShape({ app: 'mydsp', v: 9, exportedAt: 'x', deviceId: 'd', portfolios: [], blobs: {} })).toBe(
      false,
    )
    expect(
      isValidSyncEnvelopeShape({
        app: 'mydsp',
        v: 1,
        exportedAt: 'x',
        deviceId: 'd',
        portfolios: [],
        blobs: [],
      }),
    ).toBe(false)
  })

  it('parses 409 conflict bodies', () => {
    const err = parseCasConflictResponse(
      409,
      JSON.stringify({
        error: 'conflict',
        exportedAt: '2026-08-05T10:00:00.000Z',
        deviceId: 'dev_other',
        checksum: 'abc',
      }),
    )
    expect(err).toBeInstanceOf(SyncCasConflictError)
    expect(err?.remoteExportedAt).toBe('2026-08-05T10:00:00.000Z')
    expect(err?.remoteDeviceId).toBe('dev_other')
    expect(parseCasConflictResponse(400, '{}')).toBeNull()
  })

  it('Worker implements CAS headers, 409, and envelope validation', () => {
    const src = workerSrc()
    expect(src).toMatch(/X-MyDSP-Base-ExportedAt/)
    expect(src).toMatch(/X-MyDSP-Force/)
    expect(src).toMatch(/status:\s*409|json\(\s*409/)
    expect(src).toMatch(/isValidSyncEnvelopeShape|invalid_envelope/)
    expect(src).toMatch(/encryptedBytes/)
    expect(src).toMatch(/resolveCasDecision/)
  })

  it('client pushSync sends base header and handles CAS', () => {
    const svc = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(svc).toMatch(/X-MyDSP-Base-ExportedAt/)
    expect(svc).toMatch(/parseCasConflictResponse/)
    expect(svc).toMatch(/PushSyncOptions/)
    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/isSyncCasConflictError/)
    expect(auto).toMatch(/casRetried/)
  })
})
