/**
 * Background News + YouTube refresh — same entry points as price refresh.
 * Works even when News/YouTube pages are not mounted (header Refresh / PTR / interval).
 */

import { fetchTaggedNews, fetchTopFinancialNews } from './newsFeeds'
import { fetchFavouriteVideos } from './youtubeFeeds'
import {
  listNewsTags,
  loadNewsArticlesCache,
  saveNewsArticlesCache,
  setNewsLastRefresh,
} from '../storage/newsStore'
import {
  listYoutubeChannels,
  loadYoutubeVideosCache,
  saveYoutubeVideosCache,
  setYoutubeLastRefresh,
} from '../storage/youtubeStore'
import { buildYoutubeUploadNotifications } from '../domain/youtubeUploadAlerts'
import { notificationManager } from '../utils/notifications'

let newsInFlight: Promise<MediaRefreshResult> | null = null
let youtubeInFlight: Promise<MediaRefreshResult> | null = null

export type MediaRefreshResult = {
  ok: boolean
  count: number
  keptCache: boolean
  error?: string
}

/** Refresh Top + By-ticker headlines into last-good cache (merge on empty). */
export async function refreshNewsFeeds(): Promise<MediaRefreshResult> {
  if (newsInFlight) return newsInFlight
  newsInFlight = (async () => {
    try {
      const list = listNewsTags()
      const cached = loadNewsArticlesCache()
      const [topSettled, taggedSettled] = await Promise.allSettled([
        fetchTopFinancialNews(10),
        fetchTaggedNews(list, 10),
      ])
      const topLive = topSettled.status === 'fulfilled' ? topSettled.value : []
      const taggedLive = taggedSettled.status === 'fulfilled' ? taggedSettled.value : {}

      const top =
        topLive.length > 0
          ? topLive
          : cached.top.length > 0
            ? cached.top
            : []
      const byTag: Record<string, typeof top> = { ...(cached.byTag || {}) }
      let taggedLiveHits = 0
      for (const [id, articles] of Object.entries(taggedLive)) {
        if (articles.length > 0) {
          byTag[id] = articles
          taggedLiveHits++
        }
      }

      const liveHits = (topLive.length > 0 ? 1 : 0) + taggedLiveHits
      const keptCache = topLive.length === 0 && taggedLiveHits === 0 && top.length > 0
      const count =
        top.length + Object.values(byTag).reduce((n, a) => n + (a?.length || 0), 0)

      if (liveHits > 0) {
        const at = new Date().toISOString()
        saveNewsArticlesCache({ top, byTag, fetchedAt: at }, { markDirty: true })
        setNewsLastRefresh(at)
      }

      try {
        window.dispatchEvent(new CustomEvent('mydsp-news-articles'))
      } catch {
        /* ignore */
      }

      if (count === 0) {
        return {
          ok: false,
          count: 0,
          keptCache: false,
          error: 'No headlines returned',
        }
      }
      return { ok: true, count, keptCache }
    } catch (e) {
      return {
        ok: false,
        count: 0,
        keptCache: loadNewsArticlesCache().top.length > 0,
        error: e instanceof Error ? e.message : 'News refresh failed',
      }
    } finally {
      newsInFlight = null
    }
  })()
  return newsInFlight
}

/** Refresh favourite-channel videos into last-good cache + notify new uploads. */
export async function refreshYoutubeFeeds(): Promise<MediaRefreshResult> {
  if (youtubeInFlight) return youtubeInFlight
  youtubeInFlight = (async () => {
    try {
      const channels = listYoutubeChannels()
      if (channels.length === 0) {
        try {
          notificationManager.syncCategory('youtube-uploads', [])
        } catch {
          /* ignore */
        }
        return { ok: true, count: 0, keptCache: false }
      }

      const cached = loadYoutubeVideosCache()
      const vids = await fetchFavouriteVideos(channels, 5, 40)
      const keptCache = vids.length === 0 && cached.videos.length > 0
      const next = vids.length > 0 ? vids : cached.videos

      if (vids.length > 0) {
        const at = new Date().toISOString()
        saveYoutubeVideosCache({ videos: next, fetchedAt: at }, { markDirty: true })
        setYoutubeLastRefresh(at)
      }

      try {
        window.dispatchEvent(new CustomEvent('mydsp-youtube-videos'))
      } catch {
        /* ignore */
      }

      try {
        const alerts = buildYoutubeUploadNotifications()
        notificationManager.syncCategory('youtube-uploads', alerts)
      } catch {
        /* ignore */
      }

      if (next.length === 0) {
        return {
          ok: false,
          count: 0,
          keptCache: false,
          error: 'No videos returned',
        }
      }
      return { ok: true, count: next.length, keptCache }
    } catch (e) {
      return {
        ok: false,
        count: 0,
        keptCache: loadYoutubeVideosCache().videos.length > 0,
        error: e instanceof Error ? e.message : 'YouTube refresh failed',
      }
    } finally {
      youtubeInFlight = null
    }
  })()
  return youtubeInFlight
}

/** Parallel News + YouTube refresh (header Refresh / PTR / interval). */
export async function refreshMediaFeeds(): Promise<{
  news: MediaRefreshResult
  youtube: MediaRefreshResult
}> {
  const [news, youtube] = await Promise.all([refreshNewsFeeds(), refreshYoutubeFeeds()])
  return { news, youtube }
}
