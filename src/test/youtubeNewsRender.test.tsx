import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { YouTubePage } from '../pages/YouTubePage'
import { NewsPage } from '../pages/NewsPage'

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

describe('YouTube + News page render QA', () => {
  beforeEach(() => {
    mockLocalStorage()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('YouTubePage renders empty state and opens Add channel modal', async () => {
    render(
      <MemoryRouter>
        <YouTubePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'YouTube' })).toBeTruthy()
    expect(screen.getByText(/Favourite channels/i)).toBeTruthy()
    expect(screen.getByText(/Add up to 25 channels/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Add channel/i }))
    expect(screen.getByText(/Add YouTube channel/i)).toBeTruthy()
    expect(screen.getByLabelText(/Channel URL or @handle/i)).toBeTruthy()
  })

  it('YouTubePage can add a resolved channel', async () => {
    const html = `
      <html><head>
        <link rel="canonical" href="https://www.youtube.com/channel/UCbLhGKVY-bJPcawebgtNfbw">
        <meta property="og:title" content="Altcoin Daily - YouTube">
      </head><body>youtube channelId enough content here for acceptance</body></html>`

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
        if (url.includes('feeds/videos.xml')) {
          const xml = `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Altcoin Daily</title>
              <entry>
                <id>yt:video:abc123</id>
                <title>Market update</title>
                <link href="https://www.youtube.com/watch?v=abc123"/>
                <published>2026-07-14T10:00:00Z</published>
                <author><name>Altcoin Daily</name></author>
              </entry>
            </feed>`
          return new Response(xml, { status: 200 })
        }
        if (url.includes('AltcoinDaily') || url.includes('youtube.com')) {
          return new Response(html, { status: 200 })
        }
        return new Response('', { status: 404 })
      }),
    )

    render(
      <MemoryRouter>
        <YouTubePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add channel/i }))
    fireEvent.change(screen.getByPlaceholderText(/youtube.com/i), {
      target: { value: 'https://www.youtube.com/@AltcoinDaily' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

    await waitFor(() => {
      expect(screen.getByText('Altcoin Daily')).toBeTruthy()
    })
  })

  it('NewsPage renders without crashing', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'News' })).toBeTruthy()
    expect(screen.getByText(/Top news/i)).toBeTruthy()
    expect(screen.getAllByText(/meta-tags/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Add meta-tag/i })).toBeTruthy()
  })

  it('YouTubePage renders channel row icons without crashing', async () => {
    localStorage.setItem(
      'mydsp_youtube_v1',
      JSON.stringify({
        version: 1,
        channels: [
          {
            id: 'yt_1',
            channelId: 'UCbLhGKVY-bJPcawebgtNfbw',
            title: 'Altcoin Daily',
            url: 'https://www.youtube.com/@AltcoinDaily',
            createdAt: '2026-07-14T00:00:00.000Z',
            sortOrder: 0,
          },
        ],
      }),
    )

    render(
      <MemoryRouter>
        <YouTubePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Altcoin Daily')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Edit Altcoin Daily/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Remove Altcoin Daily/i })).toBeTruthy()
  })
})
