/** Build YouTube new-upload notifications from last-good video cache. */

import type { Notification } from '../utils/notifications'
import { getYoutubeSeenAt, loadYoutubeVideosCache } from '../storage/youtubeStore'

/** Newest unread uploads from favourite channels (for bell + desktop banners). */
export function buildYoutubeUploadNotifications(
  limit = 8,
): Array<Omit<Notification, 'timestamp' | 'read' | 'category'> & { id: string }> {
  const seenAt = getYoutubeSeenAt()
  const { videos } = loadYoutubeVideosCache()
  const unread = videos
    .filter((v) => !seenAt || v.publishedAt > seenAt)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)

  return unread.map((v) => {
    const ageMs = Date.now() - new Date(v.publishedAt).getTime()
    const fresh = Number.isFinite(ageMs) && ageMs < 6 * 60 * 60 * 1000
    return {
      id: `yt-${v.id}`,
      type: 'info' as const,
      // Fresh uploads → high so desktop banners fire when threshold is high+
      priority: (fresh ? 'high' : 'medium') as Notification['priority'],
      title: `New video · ${v.channelTitle}`,
      message: v.title,
      actionUrl: '/youtube',
      actionLabel: 'YouTube',
      dismissible: true,
      metadata: {
        videoId: v.id,
        channelId: v.channelId,
        link: v.link,
        publishedAt: v.publishedAt,
      },
    }
  })
}
