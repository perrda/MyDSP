import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { PagePrimaryActions } from '../components/ui/PagePrimaryActions'
import { EmptyState, EmptyStateInline } from '../components/ui/EmptyState'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { useToasts } from '../components/ToastProvider'
import { MAX_YOUTUBE_CHANNELS, type YoutubeChannel, type YoutubeVideo } from '../domain/youtube'
import { resolveYoutubeChannel } from '../services/youtubeFeeds'
import { refreshYoutubeFeeds } from '../services/mediaRefresh'
import { isOnline } from '../services/offlineQueue'
import {
  getAutoSyncStatus,
  subscribeAutoSync,
  type AutoSyncStatus,
} from '../services/sync/autoSyncService'
import { loadSyncConfig } from '../services/sync/syncService'
import {
  addYoutubeChannel,
  getYoutubeSeenAt,
  listYoutubeChannels,
  loadYoutubeState,
  loadYoutubeVideosCache,
  removeYoutubeChannel,
  reorderYoutubeChannels,
  setYoutubeSeenAt,
  updateYoutubeChannel,
} from '../storage/youtubeStore'
import { usePortfolio } from '../context/PortfolioContext'
import { ownedHoldingSymbols } from '../domain/calc'
import { formatDateTime } from '../utils/format'
import { notificationManager } from '../utils/notifications'

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const YT_PAGE = 6

function extractYoutubeVideoId(link: string, id?: string): string | null {
  const rawId = id?.match(/(?:video:|watch\?v=|\/videos\/)?([\w-]{11})/)?.[1]
  if (rawId) return rawId
  try {
    const url = new URL(link)
    const v = url.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
    const short = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)
    if (short) return short[1]
    if (url.hostname.includes('youtu.be')) {
      const pathId = url.pathname.replace(/^\//, '').slice(0, 11)
      if (/^[\w-]{11}$/.test(pathId)) return pathId
    }
  } catch {
    /* ignore */
  }
  return null
}

function textHasSymbol(text: string, symbol: string): boolean {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(text.toUpperCase())
}

export function YouTubePage() {
  const { data } = usePortfolio()
  const { showToast } = useToasts()
  const [syncStatus, setSyncStatus] = useState<AutoSyncStatus>(() => getAutoSyncStatus())
  const [syncConfigured, setSyncConfigured] = useState(() => {
    const cfg = loadSyncConfig()
    return Boolean(cfg.enabled && cfg.remoteUrl.trim())
  })
  const needsSyncUnlock = syncConfigured && syncStatus.state === 'needs-passphrase'
  const [channels, setChannels] = useState(() => listYoutubeChannels())
  const [videos, setVideos] = useState<YoutubeVideo[]>(() => loadYoutubeVideosCache().videos)
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAt, setLastAt] = useState(() => loadYoutubeState().lastRefreshAt)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<YoutubeChannel | null>(null)
  const [formUrl, setFormUrl] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formFolder, setFormFolder] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [sorting, setSorting] = useState(false)
  const [folderFilter, setFolderFilter] = useState('all')
  const [seenAt, setSeenAt] = useState(getYoutubeSeenAt)
  const [visibleCount, setVisibleCount] = useState(YT_PAGE)
  const [online, setOnline] = useState(() => isOnline())
  const [relativeTick, setRelativeTick] = useState(0)
  const inFlight = useRef(false)
  const handledDeepLink = useRef('')

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    return subscribeAutoSync((s) => {
      setSyncStatus(s)
      const cfg = loadSyncConfig()
      setSyncConfigured(Boolean(cfg.enabled && cfg.remoteUrl.trim()))
    })
  }, [])

  const applyCacheToState = useCallback(() => {
    const cached = loadYoutubeVideosCache()
    if (cached.videos.length > 0 || listYoutubeChannels().length === 0) {
      setVideos(cached.videos)
    }
    const st = loadYoutubeState()
    if (st.lastRefreshAt) setLastAt(st.lastRefreshAt)
    else if (cached.fetchedAt) setLastAt(cached.fetchedAt)
  }, [])

  const reloadList = useCallback(() => {
    setChannels(listYoutubeChannels())
    setSeenAt(getYoutubeSeenAt())
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    const list = listYoutubeChannels()
    if (list.length === 0) {
      // Keep last-good videos when favourites are empty (cleared temporarily or sync lag)
      applyCacheToState()
      try {
        notificationManager.syncCategory('youtube-uploads', [])
      } catch {
        /* ignore */
      }
      return
    }
    inFlight.current = true
    setRefreshing(true)
    setError(null)
    try {
      const result = await refreshYoutubeFeeds()
      applyCacheToState()
      if (!result.ok && !result.keptCache) {
        setError(result.error || 'No videos returned. Check channel URLs and try again.')
      } else if (result.keptCache) {
        setError('Live feed unavailable — showing last-good cached videos.')
      }
    } catch (e) {
      applyCacheToState()
      setError(e instanceof Error ? e.message : 'YouTube refresh failed')
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [applyCacheToState])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = () => {
      reloadList()
      void refresh()
    }
    window.addEventListener('mydsp-youtube-changed', onChanged)
    return () => window.removeEventListener('mydsp-youtube-changed', onChanged)
  }, [reloadList, refresh])

  useEffect(() => {
    const onGlobal = () => void refresh()
    window.addEventListener('mydsp-global-refresh', onGlobal)
    return () => window.removeEventListener('mydsp-global-refresh', onGlobal)
  }, [refresh])

  useEffect(() => {
    const onRefresh = () => void refresh()
    const onVideos = () => applyCacheToState()
    window.addEventListener('mydsp-youtube-refresh', onRefresh)
    window.addEventListener('mydsp-youtube-videos', onVideos)
    return () => {
      window.removeEventListener('mydsp-youtube-refresh', onRefresh)
      window.removeEventListener('mydsp-youtube-videos', onVideos)
    }
  }, [refresh, applyCacheToState])

  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('refresh') !== '1') return
    void refresh()
    const next = new URLSearchParams(searchParams)
    next.delete('refresh')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, refresh])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const portfolioSymbols = useMemo(() => ownedHoldingSymbols(data), [data])
  const folders = useMemo(
    () => [...new Set(channels.map((c) => c.folder?.trim()).filter((x): x is string => Boolean(x)))].sort(),
    [channels],
  )
  const filteredChannels = useMemo(
    () => (folderFilter === 'all' ? channels : channels.filter((c) => c.folder === folderFilter)),
    [channels, folderFilter],
  )
  const channelById = useMemo(() => new Map(channels.map((c) => [c.channelId, c])), [channels])
  const cachedWithoutChannels = channels.length === 0 && videos.length > 0
  const displayedVideos = useMemo(() => {
    const allowedChannels =
      folderFilter === 'all'
        ? null
        : new Set(channels.filter((c) => c.folder === folderFilter).map((c) => c.channelId))
    return [...videos]
      .filter((v) => !allowedChannels || allowedChannels.has(v.channelId))
      .sort((a, b) => {
        const score = (video: YoutubeVideo) => {
          const channel = channelById.get(video.channelId)
          const text = `${video.title} ${video.description ?? ''} ${video.channelTitle} ${channel?.folder ?? ''}`.toUpperCase()
          return portfolioSymbols.reduce((sum, symbol) => sum + (textHasSymbol(text, symbol) ? 1 : 0), 0)
        }
        const boostedA = Date.parse(a.publishedAt) + score(a) * 15 * 60_000
        const boostedB = Date.parse(b.publishedAt) + score(b) * 15 * 60_000
        return boostedB - boostedA
      })
  }, [videos, folderFilter, channels, channelById, portfolioSymbols])
  const unreadCount = displayedVideos.filter((v) => !seenAt || v.publishedAt > seenAt).length
  const cachedMode =
    channels.length > 0 &&
    videos.length > 0 &&
    (!online || (error !== null && error.toLowerCase().includes('unavailable')))

  useEffect(() => {
    const requestedVideo = searchParams.get('video')?.trim() ?? ''
    const unreadRequested = searchParams.get('unread') === '1'
    const deepLinkKey = requestedVideo ? `video:${requestedVideo}` : unreadRequested ? 'unread' : ''
    if (!deepLinkKey || handledDeepLink.current === deepLinkKey) return

    const target = requestedVideo
      ? displayedVideos.find(
          (video) =>
            video.id === requestedVideo ||
            extractYoutubeVideoId(video.link, video.id) === requestedVideo,
        )
      : displayedVideos.find((video) => !seenAt || video.publishedAt > seenAt)
    if (!target) return

    handledDeepLink.current = deepLinkKey
    const index = displayedVideos.findIndex((video) => video.id === target.id)
    setVisibleCount((count) => Math.max(count, index + 1))
    setSelectedVideo(target)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = [...document.querySelectorAll<HTMLElement>('[data-youtube-video-id]')].find(
          (element) => element.dataset.youtubeVideoId === target.id,
        )
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
  }, [displayedVideos, searchParams, seenAt])

  const markYtRead = () => {
    const previousSeenAt = seenAt
    const now = new Date().toISOString()
    setYoutubeSeenAt(now)
    setSeenAt(now)
    try {
      notificationManager.syncCategory('youtube-uploads', [])
    } catch {
      /* ignore */
    }
    showToast({
      type: 'success',
      title: 'YouTube marked read',
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          setYoutubeSeenAt(previousSeenAt)
          setSeenAt(previousSeenAt)
        },
      },
    })
  }

  const openCreate = () => {
    setEditing(null)
    setFormUrl('')
    setFormTitle('')
    setFormFolder('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (c: YoutubeChannel) => {
    setEditing(c)
    setFormUrl(c.url)
    setFormTitle(c.title)
    setFormFolder(c.folder ?? '')
    setFormError(null)
    setModalOpen(true)
  }

  const save = async () => {
    setFormError(null)
    try {
      if (editing) {
        updateYoutubeChannel(editing.id, { title: formTitle, url: formUrl, folder: formFolder })
        setModalOpen(false)
        reloadList()
        return
      }
      setResolving(true)
      const resolved = await resolveYoutubeChannel(formUrl)
      addYoutubeChannel({
        channelId: resolved.channelId,
        title: formTitle.trim() || resolved.title,
        url: resolved.url,
        thumbnailUrl: resolved.thumbnailUrl,
        folder: formFolder,
      })
      setModalOpen(false)
      reloadList()
      void refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save channel')
    } finally {
      setResolving(false)
    }
  }

  const selectedVideoId = selectedVideo ? extractYoutubeVideoId(selectedVideo.link, selectedVideo.id) : null

  return (
    <div>
      <PageHeader
        eyebrow="Media"
        title="YouTube"
        description={`Favourite finance channels (up to ${MAX_YOUTUBE_CHANNELS}). Full-length uploads only — YouTube Shorts are filtered out. New videos refresh with prices and appear in the bell — no API key required.`}
        action={
          <PagePrimaryActions
            primaryLabel="Add channel"
            onPrimary={openCreate}
            primaryDisabled={channels.length >= MAX_YOUTUBE_CHANNELS}
            menuLabel="YouTube actions"
            items={[
              ...(unreadCount > 0
                ? [{ id: 'mark-read', label: 'Mark all read', onClick: markYtRead }]
                : []),
              {
                id: 'sort',
                label: sorting ? 'Done sorting' : 'Sort channels',
                active: sorting,
                disabled: channels.length === 0,
                onClick: () => setSorting((v) => !v),
              },
            ]}
          />
        }
      />

      <div
        className="youtube-sticky-status youtube-status-strip text-xs text-text-subtle mb-4 flex flex-wrap items-center gap-2 min-h-9"
        data-testid="youtube-sticky-status"
      >
        <span>
          {channels.length}/{MAX_YOUTUBE_CHANNELS} channels
          {refreshing
            ? ' · Updating…'
            : lastAt
              ? (
                  <>
                    {' · Updated '}
                    <span className="youtube-status-relative">
                      {formatRelative(lastAt)}
                      {relativeTick >= 0 ? '' : ''}
                    </span>
                    <span className="youtube-status-absolute-date">
                      {' · '}
                      {formatDateTime(lastAt)}
                    </span>
                  </>
                )
              : ''}
          {error && !cachedMode ? ` · ${error}` : ''}
        </span>
        {unreadCount > 0 ? (
          <Link
            to="/youtube?unread=1"
            className="youtube-unread-chip inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full hover:underline"
            title="Jump to the first unread video"
          >
            {unreadCount} new
          </Link>
        ) : null}
        {unreadCount > 0 ? (
          <button type="button" className="btn-ghost btn-sm text-xs min-h-9" onClick={markYtRead}>
            Mark all read
          </button>
        ) : null}
      </div>

      {cachedMode ? (
        <div
          className="youtube-cached-mode-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Cached mode</p>
          <p className="text-xs mt-0.5 opacity-90">
            {!online
              ? 'You are offline — showing last-good videos from cache.'
              : 'Live feed unavailable — showing last-good cached videos.'}
          </p>
        </div>
      ) : null}

      {needsSyncUnlock ? (
        <div
          className="youtube-unlock-sync-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
          data-testid="youtube-unlock-sync-banner"
        >
          <p className="font-semibold">Unlock sync to pull favourite channels</p>
          <p className="text-xs mt-0.5 opacity-90">
            Cloud sync is waiting for your passphrase. Channels on your iPad / other devices stay encrypted
            until you unlock — then they appear here automatically.
          </p>
          <Link to="/settings#sync" className="btn-secondary btn-sm mt-2 inline-flex min-h-11">
            Unlock in Settings → Sync
          </Link>
        </div>
      ) : null}

      {cachedWithoutChannels ? (
        <div
          className="youtube-cached-without-channels-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Cached from last sync — add a channel</p>
          <p className="text-xs mt-0.5 opacity-90">
            Showing {videos.length} cached video{videos.length === 1 ? '' : 's'}. Add a favourite channel to keep this feed fresh.
          </p>
        </div>
      ) : null}

      <div
        className="youtube-folder-filters mb-4 flex flex-wrap items-center gap-2"
        data-testid="youtube-folders"
      >
        <span className="label-uppercase text-[11px] text-text-subtle">Folders</span>
        <button
          type="button"
          className={`btn-sm ${folderFilter === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
          aria-pressed={folderFilter === 'all'}
          onClick={() => setFolderFilter('all')}
        >
          All
        </button>
        {folders.map((folder) => (
          <button
            key={folder}
            type="button"
            className={`btn-sm ${folderFilter === folder ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={folderFilter === folder}
            onClick={() => setFolderFilter(folder)}
          >
            {folder}
          </button>
        ))}
      </div>

      {/* Favourites */}
      <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
          <div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-1">
              Favourite channels
            </p>
            <p className="label-uppercase text-[11px] text-text-subtle">
              {sorting ? 'Drag ⋮⋮ to reorder' : 'Full CRUD'}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm text-accent inline-flex items-center gap-1.5"
            onClick={openCreate}
            disabled={channels.length >= MAX_YOUTUBE_CHANNELS}
          >
            <Plus size={14} strokeWidth={2} />
            Add channel
          </button>
        </div>

        {channels.length === 0 ? (
          <EmptyState
            icon={<Video size={40} strokeWidth={1.25} className="text-red-500" />}
            title="Add favourite channels"
            description={`Paste a YouTube URL, @handle, or UC… id (up to ${MAX_YOUTUBE_CHANNELS}). Latest uploads land here and in the notification bell when released.`}
            action={{ label: 'Add channel', onClick: openCreate }}
          />
        ) : filteredChannels.length === 0 ? (
          <p className="px-4 sm:px-5 py-8 text-sm text-text-muted text-center">
            No channels in {folderFilter}.
          </p>
        ) : (
          <ReorderList
            items={filteredChannels}
            getId={(c) => c.id}
            onReorder={(next) => {
              reorderYoutubeChannels(next.map((c) => c.id))
              reloadList()
            }}
            className="divide-y divide-border"
          >
            {(c) => (
              <div className="px-4 sm:px-5 py-3 flex items-center gap-3">
                {sorting ? <ReorderHandle label={`Reorder ${c.title}`} /> : null}
                {c.thumbnailUrl ? (
                  <img
                    src={c.thumbnailUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0 bg-surface-hover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
                    <Video size={18} className="text-red-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text truncate">{c.title}</p>
                  {c.folder ? (
                    <p className="text-[11px] text-text-subtle truncate">Folder · {c.folder}</p>
                  ) : null}
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline truncate block"
                  >
                    {c.url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm btn-icon-edit p-2 min-h-9 min-w-9"
                  aria-label={`Edit ${c.title}`}
                  onClick={() => openEdit(c)}
                >
                  <Pencil size={16} strokeWidth={1.75} className="icon-edit" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm p-2 min-h-9 min-w-9 text-red-500"
                  aria-label={`Remove ${c.title}`}
                  onClick={() => setDeleteId(c.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </ReorderList>
        )}
      </section>

      {/* Latest videos */}
      <div
        className={`youtube-master-detail${selectedVideo ? ' youtube-master-detail--open' : ''}`}
      >
        <div className="youtube-master-detail-list min-w-0">
          <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-1">
                  Latest videos
                </p>
                <p className="label-uppercase text-[11px] text-text-subtle tabular-nums">
                  {displayedVideos.length} from your favourites
                  {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                  <span data-testid="youtube-relevance"> · relevance ranked</span>
                </p>
              </div>
              {unreadCount > 0 ? (
                <span
                  className="youtube-notify-chip shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full"
                  title="New uploads also appear in the header bell"
                >
                  Notify · {unreadCount}
                </span>
              ) : null}
            </div>
            {displayedVideos.length === 0 ? (
              <EmptyStateInline
                icon={<Video size={28} strokeWidth={1.25} className="text-red-500" />}
                message={
                  refreshing
                    ? 'Loading videos…'
                    : channels.length === 0
                      ? cachedWithoutChannels
                        ? 'No cached videos match this folder yet.'
                        : 'Add a channel to see new uploads here.'
                      : 'No videos yet — use the header refresh to pull latest uploads.'
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {displayedVideos.slice(0, visibleCount).map((v) => {
                    const unread = !seenAt || v.publishedAt > seenAt
                    const selected = selectedVideo?.id === v.id
                    const rowBody = (
                      <>
                        {v.thumbnailUrl ? (
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            className="w-28 sm:w-36 aspect-video object-cover rounded-md shrink-0 bg-surface-hover"
                          />
                        ) : (
                          <div className="w-28 sm:w-36 aspect-video rounded-md bg-surface-hover shrink-0 flex items-center justify-center">
                            <Video size={22} className="text-red-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-text tracking-tight leading-snug">
                            {unread ? (
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2 align-middle"
                                aria-hidden
                              />
                            ) : null}
                            {v.title}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            {v.channelTitle}
                            <span aria-hidden> · </span>
                            {formatRelative(v.publishedAt)}
                          </p>
                        </div>
                        <ExternalLink
                          size={14}
                          className="text-text-subtle shrink-0 mt-1"
                          aria-hidden
                        />
                      </>
                    )
                    return (
                      <li key={v.id} data-youtube-video-id={v.id}>
                        <a
                          href={v.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="youtube-row-phone-link px-4 sm:px-5 py-3.5 items-start gap-3 hover:bg-surface-hover/60 transition-colors"
                        >
                          {rowBody}
                        </a>
                        <button
                          type="button"
                          className={`youtube-row-detail-button px-4 sm:px-5 py-3.5 items-start gap-3 hover:bg-surface-hover/60 transition-colors w-full text-left${
                            selected ? ' youtube-row--selected' : ''
                          }`}
                          onClick={() => setSelectedVideo(v)}
                        >
                          {rowBody}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {visibleCount < displayedVideos.length ? (
                  <div className="px-4 sm:px-5 py-3 border-t border-border">
                    <button
                      type="button"
                      className="btn-secondary btn-sm w-full min-h-11"
                      onClick={() => setVisibleCount((n) => n + YT_PAGE)}
                    >
                      Load more ({displayedVideos.length - visibleCount} left)
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
        {selectedVideo ? (
          <aside
            className="youtube-master-detail-panel surface p-4 border border-border sticky self-start"
            aria-label={`Selected video: ${selectedVideo.title}`}
          >
            <p className="label-uppercase mb-1">Selected</p>
            <h2 className="text-lg font-bold tracking-tight leading-snug mb-2">
              {selectedVideo.title}
            </h2>
            <p className="text-sm text-text-muted mb-1">{selectedVideo.channelTitle}</p>
            <p className="text-xs text-text-subtle mb-3">
              Published {formatDateTime(selectedVideo.publishedAt)}
            </p>
            {selectedVideo.thumbnailUrl ? (
              <img
                src={selectedVideo.thumbnailUrl}
                alt=""
                className={`youtube-detail-thumbnail w-full aspect-video object-cover rounded-md mb-3 bg-surface-hover${
                  selectedVideoId ? ' youtube-detail-thumbnail--with-embed' : ''
                }`}
              />
            ) : null}
            {selectedVideoId ? (
              <iframe
                title={`Preview ${selectedVideo.title}`}
                src={`https://www.youtube.com/embed/${selectedVideoId}`}
                className="w-full aspect-video rounded-md mb-3 bg-surface-hover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                data-testid="youtube-embed"
              />
            ) : null}
            {selectedVideo.description ? (
              <p className="text-sm text-text-muted mb-3 leading-relaxed line-clamp-4">
                {selectedVideo.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a
                href={selectedVideo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-sm inline-flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                Open on YouTube
              </a>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setSelectedVideo(null)}
              >
                Close
              </button>
            </div>
          </aside>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit channel' : 'Add YouTube channel'}
        onClose={() => !resolving && setModalOpen(false)}
      >
        <div className="space-y-4">
          <Field
            label="Channel URL or @handle"
            hint="e.g. @CoinBureau, https://www.youtube.com/@CoinBureau, or /channel/UC…"
          >
            <input
              className="w-full"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://www.youtube.com/@… or UC…"
              disabled={resolving}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Display name" hint={editing ? 'Rename this favourite' : 'Optional override'}>
            <input
              className="w-full"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Channel name"
              disabled={resolving}
            />
          </Field>
          <Field label="Folder" hint="Optional grouping, e.g. Macro, Crypto, Equities">
            <input
              className="w-full"
              value={formFolder}
              onChange={(e) => setFormFolder(e.target.value)}
              placeholder="Macro"
              disabled={resolving}
            />
          </Field>
          {formError ? (
            <p className="text-sm text-red-500" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={resolving}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              disabled={resolving || !formUrl.trim()}
              onClick={() => void save()}
            >
              {resolving ? <RefreshCw size={14} className="animate-spin" /> : null}
              {editing ? 'Save' : resolving ? 'Resolving…' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove channel"
        body="Remove this channel from your YouTube favourites?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleteId) {
            removeYoutubeChannel(deleteId)
            setDeleteId(null)
            reloadList()
            void refresh()
          }
        }}
        onClose={() => setDeleteId(null)}
      />

    </div>
  )
}
