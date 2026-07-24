import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, EmptyStateInline } from '../components/ui/EmptyState'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { MAX_YOUTUBE_CHANNELS, type YoutubeChannel, type YoutubeVideo } from '../domain/youtube'
import { resolveYoutubeChannel } from '../services/youtubeFeeds'
import { refreshYoutubeFeeds } from '../services/mediaRefresh'
import { isOnline } from '../services/offlineQueue'
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

export function YouTubePage() {
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
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [sorting, setSorting] = useState(false)
  const [seenAt, setSeenAt] = useState(getYoutubeSeenAt)
  const [visibleCount, setVisibleCount] = useState(YT_PAGE)
  const [online, setOnline] = useState(() => isOnline())
  const [relativeTick, setRelativeTick] = useState(0)
  const inFlight = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
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

  const unreadCount = videos.filter((v) => !seenAt || v.publishedAt > seenAt).length
  const cachedMode =
    videos.length > 0 &&
    (!online || (error !== null && error.toLowerCase().includes('unavailable')))
  const markYtRead = () => {
    const now = new Date().toISOString()
    setYoutubeSeenAt(now)
    setSeenAt(now)
    try {
      notificationManager.syncCategory('youtube-uploads', [])
    } catch {
      /* ignore */
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormUrl('')
    setFormTitle('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (c: YoutubeChannel) => {
    setEditing(c)
    setFormUrl(c.url)
    setFormTitle(c.title)
    setFormError(null)
    setModalOpen(true)
  }

  const save = async () => {
    setFormError(null)
    try {
      if (editing) {
        updateYoutubeChannel(editing.id, { title: formTitle, url: formUrl })
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

  return (
    <div>
      <PageHeader
        eyebrow="Media"
        title="YouTube"
        description={`Favourite finance channels (up to ${MAX_YOUTUBE_CHANNELS}). New uploads refresh with prices and appear in the bell — no API key required.`}
        action={
          <button
            type="button"
            className={`ui-seg${sorting ? ' is-active' : ''}`}
            aria-pressed={sorting}
            onClick={() => setSorting((v) => !v)}
            disabled={channels.length === 0}
          >
            <ArrowUpDown size={13} strokeWidth={1.75} aria-hidden />
            {sorting ? 'Done' : 'Sort'}
          </button>
        }
      />

      <p
        className="youtube-sticky-status youtube-status-strip text-xs text-text-subtle mb-4 flex flex-wrap items-center gap-2 min-h-9"
        data-testid="youtube-sticky-status"
      >
        <span>
          {channels.length}/{MAX_YOUTUBE_CHANNELS} channels
          {refreshing
            ? ' · Updating…'
            : lastAt
              ? ` · Updated ${formatRelative(lastAt)}${relativeTick >= 0 ? '' : ''} · ${formatDateTime(lastAt)}`
              : ''}
          {error && !cachedMode ? ` · ${error}` : ''}
        </span>
        {unreadCount > 0 ? (
          <span className="youtube-unread-chip inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full">
            {unreadCount} new
          </span>
        ) : null}
        {unreadCount > 0 ? (
          <button type="button" className="btn-ghost btn-sm text-xs min-h-9" onClick={markYtRead}>
            Mark all read
          </button>
        ) : null}
      </p>

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
        ) : (
          <ReorderList
            items={channels}
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
                  {videos.length} from your favourites
                  {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
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
            {videos.length === 0 ? (
              <EmptyStateInline
                icon={<Video size={28} strokeWidth={1.25} className="text-red-500" />}
                message={
                  refreshing
                    ? 'Loading videos…'
                    : channels.length === 0
                      ? 'Add a channel to see new uploads here.'
                      : 'No videos yet — use the header refresh to pull latest uploads.'
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {videos.slice(0, visibleCount).map((v) => {
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
                      <li key={v.id}>
                        <a
                          href={v.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-surface-hover/60 transition-colors md:hidden"
                        >
                          {rowBody}
                        </a>
                        <button
                          type="button"
                          className={`px-4 sm:px-5 py-3.5 items-start gap-3 hover:bg-surface-hover/60 transition-colors hidden md:flex w-full text-left${
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
                {visibleCount < videos.length ? (
                  <div className="px-4 sm:px-5 py-3 border-t border-border">
                    <button
                      type="button"
                      className="btn-secondary btn-sm w-full min-h-11"
                      onClick={() => setVisibleCount((n) => n + YT_PAGE)}
                    >
                      Load more ({videos.length - visibleCount} left)
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
        {selectedVideo ? (
          <aside
            className="youtube-master-detail-panel surface p-4 border border-border hidden md:block sticky self-start"
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
                className="w-full aspect-video object-cover rounded-md mb-3 bg-surface-hover"
              />
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
              disabled={Boolean(editing) || resolving}
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

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary YouTube actions">
        <button
          type="button"
          className="btn-primary btn-sm inline-flex items-center gap-1.5"
          onClick={openCreate}
          disabled={channels.length >= MAX_YOUTUBE_CHANNELS}
        >
          <Plus size={16} strokeWidth={2} />
          Add channel
        </button>
        {unreadCount > 0 ? (
          <button type="button" className="btn-ghost btn-sm" onClick={markYtRead}>
            Mark all read
          </button>
        ) : null}
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
