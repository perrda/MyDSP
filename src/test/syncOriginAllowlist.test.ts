import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import worker, { isOriginAllowed } from '../../sync-endpoint/worker.js'

const LIVE = 'https://mydspv1.dave-perry.workers.dev'
const PREVIEW = 'https://score-abc-mydspv1.dave-perry.workers.dev'

const mockEnv = {
  SYNC_KEY: 'test-secret-key',
  STORE: {
    async get() {
      return JSON.stringify({ exportedAt: '2026-08-30T00:00:00Z', deviceId: 'd', checksum: 'x' })
    },
    async put() {
      return undefined
    },
  },
}

async function corsOrigin(origin: string, method = 'OPTIONS'): Promise<string | null> {
  const res = await worker.fetch(
    new Request('https://mydsp-sync.dave-perry.workers.dev/', {
      method,
      headers: { Origin: origin },
    }),
    mockEnv,
  )
  return res.headers.get('Access-Control-Allow-Origin')
}

describe('mydsp-sync Worker origin-lock (1.2.127)', () => {
  it('isOriginAllowed: live + localhost http any port + preview hosts', () => {
    expect(isOriginAllowed(LIVE)).toBe(true)
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
    expect(isOriginAllowed('http://localhost:4173')).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:3000')).toBe(true)
    expect(isOriginAllowed(PREVIEW)).toBe(true)
    expect(isOriginAllowed('https://foo-mydspv1.dave-perry.workers.dev')).toBe(true)
  })

  it('isOriginAllowed: rejects https localhost, LAN, github.io, evil', () => {
    expect(isOriginAllowed('https://localhost:5173')).toBe(false)
    expect(isOriginAllowed('http://192.168.1.20:5173')).toBe(false)
    expect(isOriginAllowed('https://perrda.github.io')).toBe(false)
    expect(isOriginAllowed('https://evil.example')).toBe(false)
    expect(isOriginAllowed('https://mydsp-sync.dave-perry.workers.dev')).toBe(false)
  })

  it('echoes matching Origin on preflight and GET — never *', async () => {
    expect(await corsOrigin(LIVE)).toBe(LIVE)
    expect(await corsOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    expect(await corsOrigin(PREVIEW)).toBe(PREVIEW)
    expect(await corsOrigin(LIVE, 'GET')).toBe(LIVE)
    expect(await corsOrigin('https://evil.example', 'GET')).toBe('null')
    const src = readFileSync(resolve(__dirname, '../../sync-endpoint/worker.js'), 'utf8')
    expect(src).not.toMatch(/Access-Control-Allow-Origin': '\*'/)
    expect(src).toMatch(/isOriginAllowed/)
    expect(src).toMatch(/browserOriginSkipsClientKey/)
  })

  it('allowlisted Origin GET/PUT succeed without a client key; curl still 401', async () => {
    const live = await worker.fetch(
      new Request('https://mydsp-sync.dave-perry.workers.dev/', { headers: { Origin: LIVE } }),
      mockEnv,
    )
    expect(live.status).toBe(200)
    const curl = await worker.fetch(new Request('https://mydsp-sync.dave-perry.workers.dev/'), mockEnv)
    expect(curl.status).toBe(401)
    const put = await worker.fetch(
      new Request('https://mydsp-sync.dave-perry.workers.dev/', {
        method: 'PUT',
        headers: { Origin: LIVE },
        body: '{}',
      }),
      mockEnv,
    )
    expect(put.status).toBe(200)
  })

  it('missing access-key env is 500 even from live Origin', async () => {
    const res = await worker.fetch(
      new Request('https://mydsp-sync.dave-perry.workers.dev/', { headers: { Origin: LIVE } }),
      { STORE: mockEnv.STORE },
    )
    expect(res.status).toBe(500)
  })
})
