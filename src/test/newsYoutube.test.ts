import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeNewsTag } from '../domain/news'
import { MAX_YOUTUBE_CHANNELS, parseYoutubeInput } from '../domain/youtube'
import { extractChannelIdFromHtml } from '../services/youtubeFeeds'

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

describe('news store', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('seeds default ticker tags', async () => {
    const store = await import('../storage/newsStore')
    const tags = store.listNewsTags()
    expect(tags.map((t) => t.tag)).toEqual(
      expect.arrayContaining(['BTC', 'ETH', 'ADA', 'TSLA', 'MSTR']),
    )
  })

  it('supports CRUD + reorder for meta-tags', async () => {
    const store = await import('../storage/newsStore')
    store.loadNewsState()
    const sol = store.addNewsTag({ tag: 'sol', label: 'Solana' })
    expect(sol.tag).toBe('SOL')
    expect(() => store.addNewsTag({ tag: 'SOL' })).toThrow(/already/i)
    store.updateNewsTag(sol.id, { label: 'Solana (SOL)' })
    expect(store.listNewsTags().find((t) => t.id === sol.id)?.label).toBe('Solana (SOL)')

    const ids = store.listNewsTags().map((t) => t.id)
    store.reorderNewsTags([...ids].reverse())
    expect(store.listNewsTags().map((t) => t.id)).toEqual([...ids].reverse())

    store.removeNewsTag(sol.id)
    expect(store.listNewsTags().some((t) => t.tag === 'SOL')).toBe(false)
  })

  it('normalizes tags', () => {
    expect(normalizeNewsTag(' $btc ')).toBe('BTC')
  })
})

describe('youtube store', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('parses channel URLs and handles', () => {
    expect(parseYoutubeInput('UCqK_GSMbpiV8spgD3ZGloSw').channelId).toBe(
      'UCqK_GSMbpiV8spgD3ZGloSw',
    )
    expect(parseYoutubeInput('@CoinBureau').handle).toBe('CoinBureau')
    expect(
      parseYoutubeInput('https://www.youtube.com/channel/UCqK_GSMbpiV8spgD3ZGloSw').channelId,
    ).toBe('UCqK_GSMbpiV8spgD3ZGloSw')
    expect(parseYoutubeInput('https://www.youtube.com/@CoinBureau').handle).toBe('CoinBureau')
  })

  it('extracts the page owner channel id (not a related channel)', () => {
    const html = `
      <html><head>
        <link rel="canonical" href="https://www.youtube.com/channel/UCbLhGKVY-bJPcawebgtNfbw">
        <meta property="og:url" content="https://www.youtube.com/channel/UCbLhGKVY-bJPcawebgtNfbw">
        <meta itemprop="identifier" content="UCbLhGKVY-bJPcawebgtNfbw">
      </head><body>
        <script>"channelId":"UC7KjtEJT6HvI3kBcF2I4vXg","externalId":"UCbLhGKVY-bJPcawebgtNfbw"</script>
      </body></html>`
    expect(extractChannelIdFromHtml(html)).toBe('UCbLhGKVY-bJPcawebgtNfbw')
  })

  it('resolves @handle via HTML when feed verify is unavailable', async () => {
    const html = `
      <html><head>
        <link rel="canonical" href="https://www.youtube.com/channel/UCbLhGKVY-bJPcawebgtNfbw">
        <meta property="og:title" content="Altcoin Daily - YouTube">
        <meta property="og:image" content="https://example.com/thumb.jpg">
      </head><body>youtube channelId enough</body></html>`
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (url.includes('feeds/videos.xml')) {
        return new Response('nope', { status: 403 })
      }
      // Direct YouTube HTML or any proxy that wraps it
      if (url.includes('AltcoinDaily') || url.includes('youtube.com')) {
        return new Response(html, { status: 200 })
      }
      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { resolveYoutubeChannel } = await import('../services/youtubeFeeds')
    const resolved = await resolveYoutubeChannel('https://www.youtube.com/@AltcoinDaily')
    expect(resolved.channelId).toBe('UCbLhGKVY-bJPcawebgtNfbw')
    expect(resolved.title).toBe('Altcoin Daily')
    expect(resolved.thumbnailUrl).toBe('https://example.com/thumb.jpg')

    vi.unstubAllGlobals()
  })

  it('enforces max 25 channels and supports reorder', async () => {
    const store = await import('../storage/youtubeStore')
    store.loadYoutubeState()
    for (let i = 0; i < MAX_YOUTUBE_CHANNELS; i++) {
      store.addYoutubeChannel({
        channelId: `UC${String(i).padStart(22, '0')}`,
        title: `Channel ${i}`,
        url: `https://www.youtube.com/channel/UC${String(i).padStart(22, '0')}`,
      })
    }
    expect(store.listYoutubeChannels()).toHaveLength(MAX_YOUTUBE_CHANNELS)
    expect(() =>
      store.addYoutubeChannel({
        channelId: 'UCxxxxxxxxxxxxxxxxxxxxxx',
        title: 'Overflow',
        url: 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx',
      }),
    ).toThrow(/25/)

    const ids = store.listYoutubeChannels().map((c) => c.id)
    store.reorderYoutubeChannels([ids[1], ids[0], ...ids.slice(2)])
    expect(store.listYoutubeChannels()[0].id).toBe(ids[1])
    expect(store.listYoutubeChannels()[1].id).toBe(ids[0])
  })
})

describe('rss parse', () => {
  it('parses a minimal RSS feed', async () => {
    const { parseFeedXml } = await import('../services/rss')
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>Feed</title>
        <item>
          <title>Hello markets</title>
          <link>https://example.com/a</link>
          <pubDate>Tue, 14 Jul 2026 12:00:00 GMT</pubDate>
          <description>Summary here</description>
          <source>Example</source>
        </item>
      </channel></rss>`
    const items = parseFeedXml(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Hello markets')
    expect(items[0].link).toBe('https://example.com/a')
    expect(items[0].source).toBe('Example')
  })

  it('parses a minimal Atom feed', async () => {
    const { parseFeedXml } = await import('../services/rss')
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Channel</title>
        <entry>
          <id>yt:video:abc</id>
          <title>Latest upload</title>
          <link href="https://www.youtube.com/watch?v=abc"/>
          <published>2026-07-14T10:00:00Z</published>
          <author><name>FinanceTube</name></author>
        </entry>
      </feed>`
    const items = parseFeedXml(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Latest upload')
    expect(items[0].link).toContain('watch?v=abc')
  })
})
