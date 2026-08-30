/**
 * Auth + origin-lock tests for mydsp-sync worker.
 * Run with: cd sync-endpoint && node --test worker.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { isOriginAllowed } from './worker.js'

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
    async put() {
      return undefined
    },
  },
}

const LIVE = 'https://mydspv1.dave-perry.workers.dev'
const PREVIEW = 'https://score-abc-mydspv1.dave-perry.workers.dev'
const LOCAL = 'http://localhost:5173'
const LOOPBACK = 'http://127.0.0.1:4173'

test('isOriginAllowed: live SPA origin', () => {
  assert.equal(isOriginAllowed(LIVE), true)
})

test('isOriginAllowed: localhost any port, http only', () => {
  assert.equal(isOriginAllowed('http://localhost'), true)
  assert.equal(isOriginAllowed('http://localhost:5173'), true)
  assert.equal(isOriginAllowed('http://localhost:4173'), true)
  assert.equal(isOriginAllowed('http://127.0.0.1'), true)
  assert.equal(isOriginAllowed('http://127.0.0.1:3000'), true)
  assert.equal(isOriginAllowed('https://localhost:5173'), false)
  assert.equal(isOriginAllowed('https://127.0.0.1:5173'), false)
})

test('isOriginAllowed: Designer preview hosts *-mydspv1', () => {
  assert.equal(isOriginAllowed(PREVIEW), true)
  assert.equal(isOriginAllowed('https://foo-mydspv1.dave-perry.workers.dev'), true)
  assert.equal(isOriginAllowed('http://foo-mydspv1.dave-perry.workers.dev'), false)
  assert.equal(isOriginAllowed('https://evil.example-mydspv1.dave-perry.workers.dev'), false)
  assert.equal(isOriginAllowed('https://mydspv1.dave-perry.workers.dev.evil.example'), false)
})

test('isOriginAllowed: rejects other origins', () => {
  assert.equal(isOriginAllowed(''), false)
  assert.equal(isOriginAllowed(null), false)
  assert.equal(isOriginAllowed('https://evil.example'), false)
  assert.equal(isOriginAllowed('https://perrda.github.io'), false)
  assert.equal(isOriginAllowed('http://192.168.1.20:5173'), false)
  assert.equal(isOriginAllowed('https://mydsp-sync.dave-perry.workers.dev'), false)
})

test('GET / without Origin or key returns 401', async () => {
  const req = new Request('https://test.workers.dev/')
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
  assert.equal(await res.text(), 'Unauthorized')
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'null')
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

test('GET / from live Origin succeeds without client key', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { Origin: LIVE },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), LIVE)
  assert.equal(res.headers.get('Vary'), 'Origin')
})

test('GET / from localhost Origin succeeds without client key', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { Origin: LOCAL },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), LOCAL)
})

test('GET / from 127.0.0.1 Origin succeeds without client key', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { Origin: LOOPBACK },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), LOOPBACK)
})

test('GET / from preview Origin succeeds without client key', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { Origin: PREVIEW },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), PREVIEW)
})

test('PUT from live Origin succeeds without client key', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'PUT',
    headers: { Origin: LIVE },
    body: JSON.stringify({ test: 'data' }),
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), LIVE)
})

test('GET / from unknown Origin without key returns 401 and CORS null', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { Origin: 'https://evil.example' },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 401)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'null')
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

test('Missing access-key env returns 500', async () => {
  const req = new Request('https://test.workers.dev/')
  const res = await worker.fetch(req, { STORE: mockEnv.STORE })
  assert.equal(res.status, 500)
  assert.equal(await res.text(), 'Server misconfigured')
})

test('Missing access-key env still 500 for allowlisted Origin', async () => {
  const req = new Request('https://test.workers.dev/', {
    headers: { Origin: LIVE },
  })
  const res = await worker.fetch(req, { STORE: mockEnv.STORE })
  assert.equal(res.status, 500)
})

test('OPTIONS preflight echoes live Origin and skips auth', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'OPTIONS',
    headers: { Origin: LIVE },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), LIVE)
})

test('OPTIONS preflight for unknown Origin echoes null', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'null')
})

test('CORS never uses wildcard *', async () => {
  const req = new Request('https://test.workers.dev/', {
    method: 'OPTIONS',
    headers: { Origin: LIVE },
  })
  const res = await worker.fetch(req, mockEnv)
  assert.notEqual(res.headers.get('Access-Control-Allow-Origin'), '*')
})
