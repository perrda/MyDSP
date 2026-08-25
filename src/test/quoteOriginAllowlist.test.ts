import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import worker, { isOriginAllowed } from '../../quote-endpoint/worker.js'

async function corsOrigin(path: string, origin: string, method = 'OPTIONS'): Promise<string | null> {
  const res = await worker.fetch(
    new Request(`https://mydsp-quote.dave-perry.workers.dev${path}`, {
      method,
      headers: { Origin: origin },
    }),
  )
  return res.headers.get('Access-Control-Allow-Origin')
}

describe('quote Worker origin allowlist', () => {
  it('keeps production SPA origins', () => {
    expect(isOriginAllowed('https://mydspv1.dave-perry.workers.dev')).toBe(true)
    expect(isOriginAllowed('https://perrda.github.io')).toBe(true)
    expect(isOriginAllowed('https://evil.example')).toBe(false)
  })

  it('allows localhost / 127.0.0.1 with the Vite ports (hostname-only compare used to drop :5173)', () => {
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
    expect(isOriginAllowed('http://localhost:5174')).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:5173')).toBe(true)
    expect(isOriginAllowed('http://localhost:4173')).toBe(true)
  })

  it('allows four-octet private LAN hosts (old 10.x regex only matched three octets)', () => {
    expect(isOriginAllowed('http://10.0.0.1:5173')).toBe(true)
    expect(isOriginAllowed('http://192.168.1.20:5173')).toBe(true)
    expect(isOriginAllowed('http://172.16.4.8:3000')).toBe(true)
    expect(isOriginAllowed('http://11.0.0.1:5173')).toBe(false)
  })

  it('echoes allowed Origin on CORS preflight and the / identity JSON (smoke ping)', async () => {
    expect(await corsOrigin('/', 'http://localhost:5173')).toBe('http://localhost:5173')
    expect(await corsOrigin('/', 'http://localhost:5173', 'GET')).toBe('http://localhost:5173')
    expect(await corsOrigin('/quote', 'https://mydspv1.dave-perry.workers.dev')).toBe(
      'https://mydspv1.dave-perry.workers.dev',
    )
    expect(await corsOrigin('/', 'https://evil.example', 'GET')).toBe('null')
  })

  it('still allowlists Yahoo / Finnhub / feed hosts', () => {
    const src = readFileSync(resolve(__dirname, '../../quote-endpoint/worker.js'), 'utf8')
    expect(src).toMatch(/query1\.finance\.yahoo\.com/)
    expect(src).toMatch(/finnhub\.io/)
    expect(src).toMatch(/news\.google\.com/)
  })
})
