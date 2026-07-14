import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { MAX_YOUTUBE_CHANNELS, type YoutubeChannel, type YoutubeVideo } from '../domain/youtube'
import { fetchFavouriteVideos, resolveYoutubeChannel } from '../services/youtubeFeeds'
import {
  addYoutubeChannel,
  listYoutubeChannels,
  loadYoutubeState,
  removeYoutubeChannel,
  reorderYoutubeChannels,
  setYoutubeLastRefresh,
  updateYoutubeChannel,
} from '../storage/youtubeStore'
import { formatDateTime } from '../utils/format'

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

export function YouTubePage() {
  const [channels, setChannels] = useState(() => listYoutubeChannels())
  const [videos, setVideos] = useState<YoutubeVideo[]>([])
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
  const inFlight = useRef(false)

  const reloadList = useCallback(() => {
    setChannels(listYoutubeChannels())
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    const list = listYoutubeChannels()
    if (list.length === 0) {
      setVideos([])
      return
    }
    inFlight.current = true
    setRefreshing(true)
    setError(null)
    try {
      const vids = await fetchFavouriteVideos(list, 5, 40)
      setVideos(vids)
      const at = new Date().toISOString()
      setYoutubeLastRefresh(at)
      setLastAt(at)
      if (vids.length === 0) {
        setError('No videos returned. Check channel URLs and try again.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'YouTube refresh failed')
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [])

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
        description={`Favourite finance channels (up to ${MAX_YOUTUBE_CHANNELS}). Latest uploads appear below — no API key required. Drag ⋮⋮ to reorder.`}
        action={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={refreshing || channels.length === 0}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <p className="text-xs text-text-subtle mb-4">
        {channels.length}/{MAX_YOUTUBE_CHANNELS} channels
        {lastAt ? ` · Last update ${formatDateTime(lastAt)}` : ''}
        {error ? ` · ${error}` : ''}
      </p>

      {/* Favourites */}
      <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
          <div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-1">
              Favourite channels
            </p>
            <p className="label-uppercase text-[10px] text-text-subtle">
              Full CRUD · drag to reorder
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
          <p className="px-4 sm:px-5 py-10 text-sm text-text-muted text-center">
            Add up to {MAX_YOUTUBE_CHANNELS} channels — paste a YouTube URL, @handle, or UC… id.
          </p>
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
                <ReorderHandle label={`Reorder ${c.title}`} />
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
                  className="btn-ghost btn-sm p-2 min-h-9 min-w-9"
                  aria-label={`Edit ${c.title}`}
                  onClick={() => openEdit(c)}
                >
                  <Pencil size={14} />
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
      <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border">
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-1">Latest videos</p>
          <p className="label-uppercase text-[10px] text-text-subtle tabular-nums">
            {videos.length} from your favourites
          </p>
        </div>
        {videos.length === 0 ? (
          <p className="px-4 sm:px-5 py-10 text-sm text-text-muted text-center">
            {refreshing
              ? 'Loading videos…'
              : channels.length === 0
                ? 'Add a channel to see new uploads here.'
                : 'No videos yet — tap Refresh.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {videos.map((v) => (
              <li key={v.id}>
                <a
                  href={v.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-surface-hover/60 transition-colors"
                >
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
                    <p className="font-semibold text-text tracking-tight leading-snug">{v.title}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {v.channelTitle}
                      <span aria-hidden> · </span>
                      {formatRelative(v.publishedAt)}
                    </p>
                  </div>
                  <ExternalLink size={14} className="text-text-subtle shrink-0 mt-1" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit channel' : 'Add YouTube channel'}
        onClose={() => !resolving && setModalOpen(false)}
      >
        <div className="space-y-4">
          <Field
            label="Channel URL or @handle"
            hint="e.g. https://www.youtube.com/@CoinBureau or UC…"
          >
            <input
              className="w-full"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://www.youtube.com/@…"
              disabled={Boolean(editing) || resolving}
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
    </div>
  )
}
