/**
 * Basic auth tests for mydsp-sync worker.
 * Run with: cd sync-endpoint && node --test worker.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from './worker.js'

const mockEnv = {
  SYNC_KEY: 'test-secret-key',
  STORE: {
    async get(key) {
      if (key === 'envelope') {
        return JSON.stringify({
          exportedAt: '2026-08-14T10:00:00Z',
          deviceId: 'test-device',
          checksum: 'abc123',
          portfolio: [],
        })
      }
      return null
    },
    async put(key, value) {
      return undefined
    },
  },
}

test('GET / without auth returns 401', async () => {
  const req = new Request('https://test.workers.dev/')
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
  const body = await res.text()
  assert.equal(body, 'Unauthorized')
})

test('GET / with wrong key returns 401', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { 'X-MyDSP-Key': 'wrong-key' },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
})

test('GET / with valid header auth returns 200', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { 'X-MyDSP-Key': 'test-secret-key' },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.portfolio)
})

test('GET /?key=secret with query param auth returns 200', async () => {
  const req = new Request('https://test.workers.dev/?key=test-secret-key')
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
})

test('GET /?meta=1 without auth returns 401', async () => {
  const req = new Request('https://test.workers.dev/?meta=1')
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
})

test('GET /?meta=1 with auth returns metadata only', async () => {
  const req = new Request('https://test.workers.dev/?meta=1', {
    headers: { 'X-MyDSP-Key': 'test-secret-key' },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.exportedAt, '2026-08-14T10:00:00Z')
  assert.equal(data.deviceId, 'test-device')
  assert.equal(data.checksum, 'abc123')
  assert.equal(data.portfolio, undefined)
})

test('PUT without auth returns 401', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'PUT',
    body: JSON.stringify({ test: 'data' }),
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
})

test('PUT with auth stores data', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'PUT',
    headers: { 'X-MyDSP-Key': 'test-secret-key' },
    body: JSON.stringify({ test: 'data' }),
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
})

test('POST without auth returns 401', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'POST',
    body: JSON.stringify({ test: 'data' }),
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
})

test('Missing SYNC_KEY env returns 500', async () => {
  const req = new Request('https://test.workers.dev/')
  const res = await worker.fetch(req, { STORE: mockEnv.STORE })
  assert.equal(res.status, 500)
  const body = await res.text()
  assert.equal(body, 'Server misconfigured')
})

test('OPTIONS request bypasses auth (CORS preflight)', async () => {
  const req = new Request('https://test.workers.dev/', { method: 'OPTIONS' })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 204)
})
