import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { NEWS_ALLOWLIST_PROBE } from '../domain/smokeChecks'
import { buildYoutubeUploadNotifications } from '../domain/youtubeUploadAlerts'
import {
  saveYoutubeVideosCache,
  setYoutubeSeenAt,
} from '../storage/youtubeStore'

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

describe('next25m — News / YouTube polish tip (1–25 → v1.2.80)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('25: package + release notes are 1.2.80', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.85')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.85')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.85',
      '1.2.84',
      '1.2.83',
      '1.2.82',
      '1.2.81',
    ])
  })

  it('1–5: Yahoo-primary news feeds + Worker no-store on feed errors', () => {
    const feeds = readFileSync(resolve(__dirname, '../services/newsFeeds.ts'), 'utf8')
    expect(feeds).toMatch(/feeds\.finance\.yahoo\.com/)
    expect(feeds).toMatch(/TOP_YAHOO_SYMBOLS/)
    expect(feeds).toMatch(/news\.google\.com/)
    const worker = readFileSync(resolve(__dirname, '../../quote-endpoint/worker.js'), 'utf8')
    expect(worker).toMatch(/no-store/)
    expect(worker).toMatch(/feeds\.finance\.yahoo\.com/)
    expect(NEWS_ALLOWLIST_PROBE).toMatch(/feeds\.finance\.yahoo\.com/)
  })

  it('3–4: News last-good merge + articles listener', () => {
    const media = readFileSync(resolve(__dirname, '../services/mediaRefresh.ts'), 'utf8')
    expect(media).toMatch(/export async function refreshNewsFeeds/)
    expect(media).toMatch(/keptCache/)
    expect(media).toMatch(/mydsp-news-articles/)
    const page = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(page).toMatch(/refreshNewsFeeds/)
    expect(page).toMatch(/mydsp-news-articles/)
    expect(page).toMatch(/applyCacheToState/)
    expect(page).toMatch(/setStatusMsg/)
  })

  it('6–10: YouTube last-good + upload notifications + background poll', () => {
    const media = readFileSync(resolve(__dirname, '../services/mediaRefresh.ts'), 'utf8')
    expect(media).toMatch(/export async function refreshYoutubeFeeds/)
    expect(media).toMatch(/youtube-uploads/)
    expect(media).toMatch(/buildYoutubeUploadNotifications/)
    const alerts = readFileSync(resolve(__dirname, '../domain/youtubeUploadAlerts.ts'), 'utf8')
    expect(alerts).toMatch(/export function buildYoutubeUploadNotifications/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/refreshMediaFeeds/)
    expect(shell).toMatch(/MEDIA_POLL_MS/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/youtube-uploads/)
    expect(settings).toMatch(/YouTube upload alerts/)
  })

  it('7: buildYoutubeUploadNotifications from unread cache', () => {
    setYoutubeSeenAt('2026-01-01T00:00:00.000Z')
    saveYoutubeVideosCache(
      {
        videos: [
          {
            id: 'v1',
            channelId: 'UCabc',
            channelTitle: 'Macro Desk',
            title: 'Fed preview',
            link: 'https://www.youtube.com/watch?v=abc',
            publishedAt: '2026-07-01T12:00:00.000Z',
          },
          {
            id: 'v0',
            channelId: 'UCabc',
            channelTitle: 'Macro Desk',
            title: 'Old clip',
            link: 'https://www.youtube.com/watch?v=old',
            publishedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        fetchedAt: '2026-07-01T12:05:00.000Z',
      },
      { markDirty: false },
    )
    const notes = buildYoutubeUploadNotifications()
    expect(notes.some((n) => n.id === 'yt-v1')).toBe(true)
    expect(notes.every((n) => n.actionUrl === '/youtube')).toBe(true)
    expect(notes.find((n) => n.id === 'yt-v1')?.title).toMatch(/Macro Desk/)
  })

  it('11: Smoke News probe requires Yahoo RSS body', () => {
    const checks = readFileSync(resolve(__dirname, '../domain/smokeChecks.ts'), 'utf8')
    expect(checks).toMatch(/looksLikeFeed/)
    expect(checks).toMatch(/expected Yahoo RSS 200/)
    expect(checks).toMatch(/NEWS_ALLOWLIST_PROBE/)
  })

  it('12–15: News polish — status strip, From Owned flash, Yahoo copy', () => {
    const page = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(page).toMatch(/news-status-strip/)
    expect(page).toMatch(/Yahoo Finance RSS/)
    expect(page).toMatch(/setStatusMsg/)
    expect(page).not.toMatch(/setError\(\s*\n?\s*`Added/)
  })

  it('16–20: YouTube UI + SmartNotifications + CSS polish', () => {
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(yt).toMatch(/youtube-notify-chip/)
    expect(yt).toMatch(/Add favourite channels/)
    expect(yt).toMatch(/refreshYoutubeFeeds/)
    expect(yt).toMatch(/keptCache|Live feed unavailable/)
    const smart = readFileSync(resolve(__dirname, '../components/SmartNotifications.tsx'), 'utf8')
    expect(smart).toMatch(/buildYoutubeUploadNotifications/)
    expect(smart).toMatch(/youtube-uploads/)
    expect(smart).toMatch(/mydsp-youtube-videos/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/news-status-strip/)
    expect(css).toMatch(/youtube-status-strip/)
    expect(css).toMatch(/youtube-notify-chip/)
  })

  it('21–24: tip harness + mediaRefresh wiring present', () => {
    const media = readFileSync(resolve(__dirname, '../services/mediaRefresh.ts'), 'utf8')
    expect(media).toMatch(/export async function refreshMediaFeeds/)
    expect(media).toMatch(/refreshNewsFeeds/)
    expect(media).toMatch(/refreshYoutubeFeeds/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Worker News allowlist/)
    expect(e2e).toMatch(/YouTube page uses Quote Worker/)
  })
})
