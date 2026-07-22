import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  RELEASE_NOTES,
  releaseNotesArchive,
  releaseNotesBullets,
} from '../domain/releaseNotes'
import {
  checkSyncUrlReachable,
  pingQuoteWorker,
  syncUrlForReachabilityCheck,
} from '../domain/smokeChecks'
import {
  buildWeeklyDigestContent,
  buildWeeklyDigestHtml,
  weekDeltaFromHistory,
} from '../domain/weeklyDigest'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('next25c quality / ops (21–25)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
    vi.unstubAllGlobals()
  })

  it('21: RELEASE_NOTES archive (5 versions) + UpdateBanner See all + Settings whats-new', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(5)
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.88')
    expect(releaseNotesBullets(3)).toHaveLength(3)
    expect(releaseNotesArchive(5)).toHaveLength(5)
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.88',
      '1.2.87',
      '1.2.86',
      '1.2.85',
      '1.2.84',
    ])


    const notes = readFileSync(resolve(__dirname, '../domain/releaseNotes.ts'), 'utf8')
    expect(notes).toMatch(/releaseNotesArchive/)
    expect(notes).toMatch(/ReleaseNotesEntry/)

    const banner = readFileSync(resolve(__dirname, '../components/UpdateBanner.tsx'), 'utf8')
    expect(banner).toMatch(/update-banner-see-all/)
    expect(banner).toMatch(/settings#whats-new/)
    expect(banner).toMatch(/See all/)

    const archive = readFileSync(resolve(__dirname, '../components/WhatsNewArchive.tsx'), 'utf8')
    expect(archive).toMatch(/id="whats-new"/)
    expect(archive).toMatch(/releaseNotesArchive/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/WhatsNewArchive/)
    expect(settings).toMatch(/id="whats-new"/)
  })

  it('22: ErrorBoundary recovery — Reload / Clear SW caches / Open Sync', () => {
    const src = readFileSync(resolve(__dirname, '../components/ErrorBoundary.tsx'), 'utf8')
    expect(src).toMatch(/error-boundary-reload/)
    expect(src).toMatch(/error-boundary-clear-sw/)
    expect(src).toMatch(/error-boundary-open-sync/)
    expect(src).toMatch(/Clear SW caches/)
    expect(src).toMatch(/Open Sync/)
    expect(src).toMatch(/clearServiceWorkerCaches/)
    expect(src).toMatch(/settings#sync/)
    expect(src).toMatch(/location\.reload/)
  })

  it('23: Skip links target sync-conflicts-panel and markets-cached-mode-banner', () => {
    const a11y = readFileSync(resolve(__dirname, '../components/Accessibility.tsx'), 'utf8')
    expect(a11y).toMatch(/#sync-conflicts-panel/)
    expect(a11y).toMatch(/#markets-cached-mode-banner/)
    expect(a11y).toMatch(/Skip to sync conflicts/)
    expect(a11y).toMatch(/Skip to Markets cached banner/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/id="sync-conflicts-panel"/)

    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/id="markets-cached-mode-banner"/)
  })

  it('24: /smoke Quote Worker ping + Sync URL reachability (no secrets)', async () => {
    expect(
      syncUrlForReachabilityCheck('https://example.com/sync?key=secret&x=1'),
    ).toBe('https://example.com/sync?x=1')
    expect(syncUrlForReachabilityCheck('')).toBeNull()
    expect(syncUrlForReachabilityCheck('not-a-url')).toBeNull()

    const quoteFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, service: 'mydsp-quote' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const quote = await pingQuoteWorker('https://mydsp-quote.example', quoteFetch as unknown as typeof fetch)
    expect(quote.ok).toBe(true)
    expect(quoteFetch).toHaveBeenCalled()

    const syncFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 204 })
      }
      return new Response('ok', { status: 200 })
    })
    const sync = await checkSyncUrlReachable(
      'https://sync.example/path?key=topsecret',
      syncFetch as unknown as typeof fetch,
    )
    expect(sync.ok).toBe(true)
    const calledUrl = String(syncFetch.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).not.toMatch(/key=/)
    expect(calledUrl).toMatch(/sync\.example/)

    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/pingQuoteWorker/)
    expect(smoke).toMatch(/checkSyncUrlReachable/)
    expect(smoke).toMatch(/Quote Worker ping/)
    expect(smoke).toMatch(/Sync URL reachability/)
  })

  it('25: Weekly email-ready HTML digest download from Dashboard/Compare', () => {
    const content = buildWeeklyDigestContent({
      netWorth: 100_000,
      assets: 120_000,
      liabilities: 20_000,
      crypto: 30_000,
      equity: 90_000,
      weekDelta: 1_250,
      portfolios: [{ name: 'David', netWorth: 80_000 }],
      highlights: ['3 todos due'],
      generatedAt: new Date('2026-07-16T12:00:00Z'),
    })
    expect(content).toMatch(/weekly digest/i)
    expect(content).toMatch(/Net worth/)
    expect(content).toMatch(/Week change/)
    expect(content).toMatch(/David/)
    expect(content).toMatch(/no email is sent/i)

    const html = buildWeeklyDigestHtml({
      netWorth: 50_000,
      assets: 50_000,
      liabilities: 0,
      crypto: 10_000,
      equity: 40_000,
      weekDelta: null,
    })
    expect(html).toMatch(/<!DOCTYPE html>/i)
    expect(html).toMatch(/MyDSP weekly digest/)

    expect(
      weekDeltaFromHistory(
        [
          { date: '2026-07-01', netWorth: 90_000 },
          { date: '2026-07-09', netWorth: 95_000 },
          { date: '2026-07-16', netWorth: 100_000 },
        ],
        100_000,
        new Date('2026-07-16T12:00:00'),
      ),
    ).toBe(5_000)

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/weekly-digest-btn/)
    expect(dash).toMatch(/WeeklyDigestModal/)

    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/weekly-digest-btn/)
    expect(compare).toMatch(/WeeklyDigestModal/)
  })

  it('package version is 1.2.70', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.88')
  })
})
