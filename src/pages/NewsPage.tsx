import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import type { NewsArticle, NewsTag } from '../domain/news'
import { fetchTaggedNews, fetchTopFinancialNews } from '../services/newsFeeds'
import { isOnline } from '../services/offlineQueue'
import {
  addNewsTag,
  getNewsSeenAt,
  listNewsTags,
  loadNewsArticlesCache,
  loadNewsState,
  removeNewsTag,
  reorderNewsTags,
  saveNewsArticlesCache,
  setNewsCollapsed,
  setNewsLastRefresh,
  setNewsSeenAt,
  updateNewsTag,
} from '../storage/newsStore'
import { loadPortfolio } from '../storage/portfolioStore'
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

const NEWS_PAGE = 10

function ArticleRow({
  article,
  unread,
  selected,
  onSelect,
}: {
  article: NewsArticle
  unread?: boolean
  selected?: boolean
  onSelect?: (article: NewsArticle) => void
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text tracking-tight leading-snug">
          {unread ? (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2 align-middle" aria-hidden />
          ) : null}
          {article.title}
        </p>
        <p className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>{article.source}</span>
          <span aria-hidden>·</span>
          <span>{formatRelative(article.publishedAt)}</span>
          {article.tag ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-accent font-semibold">{article.tag}</span>
            </>
          ) : null}
        </p>
        {article.summary ? (
          <p className="text-xs text-text-subtle mt-1.5 line-clamp-2">{article.summary}</p>
        ) : null}
      </div>
      <ExternalLink size={14} className="text-text-subtle shrink-0 mt-1" aria-hidden />
    </>
  )
  const rowClass =
    'px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-surface-hover/60 transition-colors'
  return (
    <>
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`${rowClass} md:hidden`}
      >
        {body}
      </a>
      <button
        type="button"
        className={`${rowClass} hidden md:flex w-full text-left${selected ? ' news-row--selected' : ''}`}
        onClick={() => onSelect?.(article)}
      >
        {body}
      </button>
    </>
  )
}

export function NewsPage() {
  const [cachedArticles] = useState(loadNewsArticlesCache)
  const [tags, setTags] = useState(() => listNewsTags())
  const [collapsed, setCollapsed] = useState(() => loadNewsState().collapsed)
  const [top, setTop] = useState<NewsArticle[]>(() => cachedArticles.top)
  const [byTag, setByTag] = useState<Record<string, NewsArticle[]>>(
    () => cachedArticles.byTag,
  )
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAt, setLastAt] = useState(() => loadNewsState().lastRefreshAt)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<NewsTag | null>(null)
  const [formTag, setFormTag] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string | 'all'>('all')
  const [sorting, setSorting] = useState(false)
  const [seenAt, setSeenAt] = useState(getNewsSeenAt)
  const [topVisible, setTopVisible] = useState(NEWS_PAGE)
  const [taggedVisible, setTaggedVisible] = useState(NEWS_PAGE)
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [online, setOnline] = useState(() => isOnline())
  const inFlight = useRef(false)

  useEffect(() => {
    setTaggedVisible(NEWS_PAGE)
  }, [filterTag])

  const reloadList = useCallback(() => {
    setTags(listNewsTags())
    setCollapsed(loadNewsState().collapsed)
    setSeenAt(getNewsSeenAt())
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    setError(null)
    try {
      const list = listNewsTags()
      const topRequest = fetchTopFinancialNews(10).then((topNews) => {
        setTop(topNews)
        if (topNews.length > 0) {
          const cached = loadNewsArticlesCache()
          saveNewsArticlesCache(
            {
              ...cached,
              top: topNews,
              fetchedAt: new Date().toISOString(),
            },
            { markDirty: true },
          )
        }
        return topNews
      })
      const taggedRequest = fetchTaggedNews(list, 10).then((tagged) => {
        setByTag(tagged)
        if (Object.values(tagged).some((articles) => articles.length > 0)) {
          const cached = loadNewsArticlesCache()
          saveNewsArticlesCache(
            {
              ...cached,
              byTag: tagged,
              fetchedAt: new Date().toISOString(),
            },
            { markDirty: true },
          )
        }
        return tagged
      })
      const [topResult, taggedResult] = await Promise.allSettled([topRequest, taggedRequest])
      const topNews = topResult.status === 'fulfilled' ? topResult.value : []
      const tagged = taggedResult.status === 'fulfilled' ? taggedResult.value : {}
      const hasArticles =
        topNews.length > 0 || Object.values(tagged).some((articles) => articles.length > 0)
      if (hasArticles) {
        const at = new Date().toISOString()
        setNewsLastRefresh(at)
        setLastAt(at)
      } else {
        setError('No headlines returned. Check your connection and try the header refresh.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'News refresh failed')
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = () => reloadList()
    window.addEventListener('mydsp-news-changed', onChanged)
    return () => window.removeEventListener('mydsp-news-changed', onChanged)
  }, [reloadList])

  useEffect(() => {
    const onGlobal = () => void refresh()
    window.addEventListener('mydsp-global-refresh', onGlobal)
    return () => window.removeEventListener('mydsp-global-refresh', onGlobal)
  }, [refresh])

  useEffect(() => {
    const onRefresh = () => void refresh()
    window.addEventListener('mydsp-news-refresh', onRefresh)
    return () => window.removeEventListener('mydsp-news-refresh', onRefresh)
  }, [refresh])

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

  const taggedFlat = useMemo(() => {
    const rows: NewsArticle[] = []
    for (const t of tags) {
      for (const a of byTag[t.id] || []) rows.push(a)
    }
    rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    if (filterTag === 'all') return rows
    return rows.filter((a) => a.tag === filterTag)
  }, [tags, byTag, filterTag])

  const unreadCount = useMemo(() => {
    if (!seenAt) return top.length + taggedFlat.length
    const cutoff = seenAt
    const topN = top.filter((a) => a.publishedAt > cutoff).length
    const tagN = taggedFlat.filter((a) => a.publishedAt > cutoff).length
    return topN + tagN
  }, [top, taggedFlat, seenAt])

  const markNewsRead = () => {
    const now = new Date().toISOString()
    setNewsSeenAt(now)
    setSeenAt(now)
  }

  const isUnread = (a: NewsArticle) => !seenAt || a.publishedAt > seenAt

  const hasCachedArticles =
    top.length > 0 || Object.values(byTag).some((articles) => articles.length > 0)
  const cachedMode = hasCachedArticles && (!online || error !== null)

  const openCreate = () => {
    setEditing(null)
    setFormTag('')
    setFormLabel('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (t: NewsTag) => {
    setEditing(t)
    setFormTag(t.tag)
    setFormLabel(t.label)
    setFormError(null)
    setModalOpen(true)
  }

  const save = () => {
    try {
      if (editing) {
        updateNewsTag(editing.id, { tag: formTag, label: formLabel })
      } else {
        addNewsTag({ tag: formTag, label: formLabel })
      }
      setModalOpen(false)
      reloadList()
      void refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save tag')
    }
  }

  const toggle = (section: 'top' | 'tagged') => {
    const next = !collapsed[section]
    setNewsCollapsed(section, next)
    setCollapsed((c) => ({ ...c, [section]: next }))
  }

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="News"
        description="Google News via the quote Worker (same path as prices). Top 10 + By ticker (10 per tag)."
        action={
          <button
            type="button"
            className={`btn-secondary inline-flex items-center gap-2 ${sorting ? 'border-accent text-accent' : ''}`}
            aria-pressed={sorting}
            onClick={() => setSorting((v) => !v)}
            disabled={tags.length === 0}
          >
            <ArrowUpDown size={14} strokeWidth={1.75} />
            {sorting ? 'Done' : 'Sort'}
          </button>
        }
      />

      <p className="text-xs text-text-subtle mb-4 flex flex-wrap items-center gap-2">
        <span>
          {refreshing ? 'Updating headlines…' : lastAt ? `Last update ${formatDateTime(lastAt)}` : 'Headlines not loaded yet'}
          {error ? ` · ${error}` : ''}
        </span>
        {unreadCount > 0 ? (
          <span className="news-unread-chip inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full">
            {unreadCount} new
          </span>
        ) : null}
        {unreadCount > 0 ? (
          <button type="button" className="btn-ghost btn-sm text-xs min-h-9" onClick={markNewsRead}>
            Mark all read
          </button>
        ) : null}
      </p>

      {cachedMode ? (
        <div
          className="news-cached-mode-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Cached mode</p>
          <p className="text-xs mt-0.5 opacity-90">
            {!online
              ? 'You are offline — showing last-good headlines from cache.'
              : 'Live headlines unavailable — showing last-good cached articles.'}
          </p>
        </div>
      ) : null}

      <div
        className={`news-master-detail${selectedArticle ? ' news-master-detail--open' : ''}`}
      >
        <div className="news-master-detail-list min-w-0">
      {/* Top news */}
      <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border">
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-1">Top news</p>
            <p className="label-uppercase text-[11px] text-text-subtle tabular-nums">
              {top.length} headline{top.length === 1 ? '' : 's'} today
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm p-2 min-h-10 min-w-10 shrink-0"
            aria-label={collapsed.top ? 'Expand Top news' : 'Collapse Top news'}
            onClick={() => toggle('top')}
          >
            {collapsed.top ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        {!collapsed.top && (
          <div className="divide-y divide-border">
            {top.length === 0 ? (
              <p className="px-4 sm:px-5 py-8 text-sm text-text-muted text-center">
                No top headlines yet.
              </p>
            ) : (
              <>
                {top.slice(0, topVisible).map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    unread={isUnread(a)}
                    selected={selectedArticle?.id === a.id}
                    onSelect={setSelectedArticle}
                  />
                ))}
                {topVisible < top.length ? (
                  <div className="px-4 sm:px-5 py-3">
                    <button
                      type="button"
                      className="btn-secondary btn-sm w-full min-h-11"
                      onClick={() => setTopVisible((n) => n + NEWS_PAGE)}
                    >
                      Load more ({top.length - topVisible} left)
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </section>

      {/* Tagged news */}
      <section className="border border-border bg-bg-elevated mb-6 overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border">
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-1">By ticker</p>
            <p className="label-uppercase text-[11px] text-text-subtle tabular-nums">
              {tags.length} tag{tags.length === 1 ? '' : 's'} · {taggedFlat.length} stor
              {taggedFlat.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm p-2 min-h-10 min-w-10 shrink-0"
            aria-label={collapsed.tagged ? 'Expand By ticker' : 'Collapse By ticker'}
            onClick={() => toggle('tagged')}
          >
            {collapsed.tagged ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {!collapsed.tagged && (
          <>
            <div className="px-4 sm:px-5 py-3 flex flex-wrap gap-2 border-b border-border">
              <button
                type="button"
                className={`btn-sm ${filterTag === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setFilterTag('all')}
              >
                All
              </button>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn-sm ${filterTag === t.tag ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setFilterTag(t.tag)}
                >
                  {t.tag}
                </button>
              ))}
            </div>

            <div className="divide-y divide-border">
              {taggedFlat.length === 0 ? (
                <p className="px-4 sm:px-5 py-8 text-sm text-text-muted text-center">
                  No stories for these tags yet.
                </p>
              ) : (
                <>
                  {taggedFlat.slice(0, taggedVisible).map((a) => (
                    <ArticleRow
                      key={`${a.tag}-${a.id}`}
                      article={a}
                      unread={isUnread(a)}
                      selected={
                        selectedArticle?.id === a.id && selectedArticle?.tag === a.tag
                      }
                      onSelect={setSelectedArticle}
                    />
                  ))}
                  {taggedVisible < taggedFlat.length ? (
                    <div className="px-4 sm:px-5 py-3">
                      <button
                        type="button"
                        className="btn-secondary btn-sm w-full min-h-11"
                        onClick={() => setTaggedVisible((n) => n + NEWS_PAGE)}
                      >
                        Load more ({taggedFlat.length - taggedVisible} left)
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-border">
              <p className="text-xs text-text-subtle mb-3">
                {sorting ? 'Meta-tags · drag ⋮⋮ to reorder' : 'Meta-tags'}
              </p>
              {tags.length === 0 ? (
                <p className="text-sm text-text-muted mb-3">
                  No tags yet. Add tickers like TSLA, BTC, or ADA to filter headlines.
                </p>
              ) : (
                <ReorderList
                  items={tags}
                  getId={(t) => t.id}
                  onReorder={(next) => {
                    reorderNewsTags(next.map((t) => t.id))
                    reloadList()
                  }}
                  className="divide-y divide-border border border-border mb-3"
                >
                  {(t) => (
                    <div className="px-3 py-2.5 flex items-center gap-2">
                      {sorting ? <ReorderHandle label={`Reorder ${t.tag}`} /> : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{t.tag}</p>
                        <p className="text-xs text-text-muted truncate">{t.label}</p>
                      </div>
                      <Newspaper size={14} className="text-text-subtle shrink-0" aria-hidden />
                      <button
                        type="button"
                        className="btn-ghost btn-sm p-2 min-h-9 min-w-9"
                        aria-label={`Edit ${t.tag}`}
                        onClick={() => openEdit(t)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm p-2 min-h-9 min-w-9 text-red-500"
                        aria-label={`Remove ${t.tag}`}
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </ReorderList>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-sm text-accent inline-flex items-center gap-1.5"
                  onClick={openCreate}
                >
                  <Plus size={14} strokeWidth={2} />
                  Add meta-tag
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm news-from-owned inline-flex items-center gap-1.5"
                  onClick={() => {
                    const portfolio = loadPortfolio()
                    const existing = new Set(listNewsTags().map((t) => t.tag.toUpperCase()))
                    let added = 0
                    for (const e of portfolio.equities) {
                      const sym = e.symbol.trim().toUpperCase()
                      if (!sym || existing.has(sym)) continue
                      try {
                        addNewsTag({ tag: sym, label: e.name })
                        existing.add(sym)
                        added++
                      } catch {
                        /* ignore */
                      }
                    }
                    for (const c of portfolio.crypto) {
                      const sym = c.symbol.trim().toUpperCase()
                      if (!sym || existing.has(sym)) continue
                      try {
                        addNewsTag({ tag: sym, label: c.name })
                        existing.add(sym)
                        added++
                      } catch {
                        /* ignore */
                      }
                    }
                    setTags(listNewsTags())
                    setError(
                      added > 0
                        ? `Added ${added} meta-tag${added === 1 ? '' : 's'} from Owned holdings`
                        : 'All Owned symbols already have News meta-tags',
                    )
                  }}
                >
                  From Owned
                </button>
              </div>
            </div>
          </>
        )}
      </section>
        </div>
        {selectedArticle ? (
          <aside
            className="news-master-detail-panel surface p-4 border border-border hidden md:block sticky top-20 self-start"
            aria-label={`Selected article: ${selectedArticle.title}`}
          >
            <p className="label-uppercase mb-1">Selected</p>
            <h2 className="text-lg font-bold tracking-tight leading-snug mb-2">
              {selectedArticle.title}
            </h2>
            <p className="text-sm text-text-muted mb-1">{selectedArticle.source}</p>
            <p className="text-xs text-text-subtle mb-3">
              Published {formatDateTime(selectedArticle.publishedAt)}
              {selectedArticle.tag ? (
                <>
                  <span aria-hidden> · </span>
                  <span className="text-accent font-semibold">{selectedArticle.tag}</span>
                </>
              ) : null}
            </p>
            {selectedArticle.summary ? (
              <p className="text-sm text-text-muted mb-3 leading-relaxed">{selectedArticle.summary}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a
                href={selectedArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-sm inline-flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                Open article
              </a>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setSelectedArticle(null)}
              >
                Close
              </button>
            </div>
          </aside>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit meta-tag' : 'Add meta-tag'}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <Field label="Ticker / tag" hint="e.g. TSLA, MSTR, BTC, ADA">
            <input
              className="w-full"
              value={formTag}
              onChange={(e) => setFormTag(e.target.value.toUpperCase())}
              placeholder="BTC"
              autoCapitalize="characters"
            />
          </Field>
          <Field label="Label" hint="Optional display name">
            <input
              className="w-full"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="Bitcoin"
            />
          </Field>
          {formError ? (
            <p className="text-sm text-red-500" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove meta-tag"
        body="Remove this ticker tag from News? Headlines already loaded stay until the next refresh."
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleteId) {
            removeNewsTag(deleteId)
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
