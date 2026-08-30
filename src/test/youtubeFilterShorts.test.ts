import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { filterOutYoutubeShorts, isYoutubeShort } from '../domain/youtube'
import { loadYoutubeVideosCache, saveYoutubeVideosCache } from '../storage/youtubeStore'

const mem = new Map<string, string>()

describe('YouTube Shorts filter (v1.2.105)', () => {
  beforeEach(() => {
    mem.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
    })
  })

  afterEach(() => {
    mem.clear()
    vi.unstubAllGlobals()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.139')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.139')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.139',
      '1.2.137',
      '1.2.135',
      '1.2.134',
      '1.2.133',
    ])
  })

  it('detects Shorts by URL, #shorts, and Shorts title — not short-term', () => {
    expect(
      isYoutubeShort({
        id: '1',
        title: 'Quick tip',
        link: 'https://www.youtube.com/shorts/abc123',
      }),
    ).toBe(true)
    expect(
      isYoutubeShort({
        id: '2',
        title: 'Market update #Shorts',
        link: 'https://www.youtube.com/watch?v=abc123',
      }),
    ).toBe(true)
    expect(
      isYoutubeShort({
        id: '3',
        title: 'Fed Shorts Explained',
        link: 'https://www.youtube.com/watch?v=abc123',
      }),
    ).toBe(false) // finance "shorts" ≠ YouTube Shorts
    expect(
      isYoutubeShort({
        id: '4',
        title: 'Short-term rates and inflation',
        link: 'https://www.youtube.com/watch?v=abc123',
      }),
    ).toBe(false)
    expect(
      isYoutubeShort({
        id: '5',
        title: 'Full macro outlook',
        link: 'https://www.youtube.com/watch?v=abc123',
      }),
    ).toBe(false)
    expect(
      isYoutubeShort({
        id: '6',
        title: 'Quick clip',
        link: 'https://www.youtube.com/watch?v=clip',
        durationSeconds: 45,
      }),
    ).toBe(true)
    expect(
      isYoutubeShort({
        id: '7',
        title: 'Hourly show',
        link: 'https://www.youtube.com/watch?v=long',
        durationSeconds: 3600,
      }),
    ).toBe(false)
  })

  it('filterOutYoutubeShorts keeps only full-length', () => {
    const kept = filterOutYoutubeShorts([
      {
        id: 'a',
        title: 'Full video',
        link: 'https://www.youtube.com/watch?v=full',
        channelId: 'UC1',
        channelTitle: 'Ch',
        publishedAt: '2026-07-25T10:00:00.000Z',
      },
      {
        id: 'b',
        title: 'Clip #shorts',
        link: 'https://www.youtube.com/watch?v=short',
        channelId: 'UC1',
        channelTitle: 'Ch',
        publishedAt: '2026-07-25T11:00:00.000Z',
      },
    ])
    expect(kept.map((v) => v.id)).toEqual(['a'])
  })

  it('cache load/save strips Shorts so they cannot sync back', () => {
    saveYoutubeVideosCache({
      videos: [
        {
          id: 'full',
          title: 'Deep dive',
          link: 'https://www.youtube.com/watch?v=full',
          channelId: 'UC1',
          channelTitle: 'Ch',
          publishedAt: '2026-07-25T10:00:00.000Z',
        },
        {
          id: 'short',
          title: 'Tip',
          link: 'https://www.youtube.com/shorts/xyz',
          channelId: 'UC1',
          channelTitle: 'Ch',
          publishedAt: '2026-07-25T11:00:00.000Z',
        },
      ],
      fetchedAt: '2026-07-25T12:00:00.000Z',
    })
    const loaded = loadYoutubeVideosCache()
    expect(loaded.videos.map((v) => v.id)).toEqual(['full'])
  })

  it('feeds and page copy document Shorts exclusion', () => {
    const feeds = readFileSync(resolve(__dirname, '../services/youtubeFeeds.ts'), 'utf8')
    expect(feeds).toMatch(/filterOutYoutubeShorts/)
    const page = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(page).toMatch(/YouTube Shorts are filtered out/)
  })
})
