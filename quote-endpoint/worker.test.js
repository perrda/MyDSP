/**
 * Origin allowlist + CORS tests for mydsp-quote worker.
 * Run with: cd quote-endpoint && node --test worker.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { isOriginAllowed } from './worker.js'

test('localhost Vite ports are allowed', () => {
  assert.equal(isOriginAllowed('http://localhost:5173'), true)
  assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true)
})

test('four-octet 10.x LAN is allowed', () => {
  assert.equal(isOriginAllowed('http://10.0.0.1:5173'), true)
})

test('unknown origin is rejected', () => {
  assert.equal(isOriginAllowed('https://evil.example'), false)
})

test('GET / identity echoes allowed Origin (smoke ping)', async () => {
  const req = new Request('https://mydsp-quote.workers.dev/', {
    headers: { Origin: 'https://mydspv1.dave-perry.workers.dev' },
  })
  const res = await worker.fetch(req)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://mydspv1.dave-perry.workers.dev')
  const body = await res.json()
  assert.equal(body.service, 'mydsp-quote')
})

test('GET / identity does not echo a foreign Origin', async () => {
  const req = new Request('https://mydsp-quote.workers.dev/', {
    headers: { Origin: 'https://evil.example' },
  })
  const res = await worker.fetch(req)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'null')
})
