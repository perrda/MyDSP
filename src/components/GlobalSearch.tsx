// Global Search Component with Cmd+K shortcut — searches live portfolio data

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, TrendingUp, Target, CheckSquare, Briefcase, ChevronRight, Coins } from 'lucide-react'
import { usePortfolio } from '../context/PortfolioContext'
import { globalSearch, type GlobalSearchResult } from '../utils/search'
import { logger } from '../utils/logger'

function searchShortcutLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+K'
  const platform = navigator.platform || ''
  const ua = navigator.userAgent || ''
  const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS|iPhone|iPad/i.test(ua)
  return isApple ? '⌘K' : 'Ctrl+K'
}

export function GlobalSearch() {
  const { data } = usePortfolio()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const shortcut = useMemo(() => searchShortcutLabel(), [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        logger.track('global_search_opened', { trigger: 'keyboard' })
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        return
      }
      const start = performance.now()
      const found = globalSearch(searchQuery, {
        spending: data.spending ?? [],
        crypto: data.crypto ?? [],
        equities: data.equities ?? [],
        goals: data.goals ?? [],
        jobApplications: data.jobApplications ?? [],
        todoItems: data.todoItems ?? [],
      })
      setResults(found)
      setSelectedIndex(0)
      logger.metric('global-search', performance.now() - start, {
        unit: 'ms',
        query: searchQuery,
        results: found.length,
      })
    },
    [data],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) performSearch(query)
      else setResults([])
    }, 200)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  const handleSelect = (result: GlobalSearchResult) => {
    logger.track('global_search_result_clicked', { type: result.type, score: result.score })
    navigate(result.url || '/')
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }

  const typeIcons: Record<string, React.ReactNode> = {
    spending: <TrendingUp className="w-4 h-4" />,
    goal: <Target className="w-4 h-4" />,
    todo: <CheckSquare className="w-4 h-4" />,
    job: <Briefcase className="w-4 h-4" />,
    crypto: <Coins className="w-4 h-4" />,
    equity: <TrendingUp className="w-4 h-4" />,
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          logger.track('global_search_opened', { trigger: 'toolbar' })
        }}
        className="toolbar-icon"
        aria-label={`Search (${shortcut})`}
        aria-keyshortcuts="Meta+K Control+K"
        title={`Search (${shortcut})`}
      >
        <Search size={18} strokeWidth={1.5} aria-hidden />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[max(1rem,env(safe-area-inset-top))] sm:pt-20 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-0 sm:mx-3 h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[min(85vh,40rem)] bg-bg-elevated sm:rounded-none shadow-2xl border-0 sm:border border-border overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
          <Search className="w-5 h-5 text-text-muted shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search spending, holdings, goals…"
            className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-lg border-0 shadow-none focus:ring-0"
            style={{ fontSize: 16 }}
            aria-label="Search portfolio"
          />
          <kbd
            className="hidden sm:inline-flex shrink-0 items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted border border-border"
            aria-hidden
          >
            {shortcut}
          </kbd>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              setQuery('')
              setResults([])
            }}
            className="toolbar-icon shrink-0"
            aria-label="Close search"
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && query && (
            <div className="p-8 text-center text-text-muted">No results for “{query}”</div>
          )}
          {results.length === 0 && !query && (
            <div className="p-8 text-center text-text-muted">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden />
              <p>Search holdings, tasks, jobs, spending…</p>
              <p className="mt-2 text-xs text-text-subtle">Shortcut {shortcut}</p>
              <p className="mt-3 text-[11px] uppercase tracking-widest text-text-subtle hidden sm:block">
                ↑↓ navigate · ↵ open · esc close
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-widest text-text-subtle sm:hidden">
                Open Search from More on phone
              </p>
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.title}-${index}`}
              type="button"
              onClick={() => handleSelect(result)}
              className={`w-full flex items-center justify-between p-4 min-h-[3.25rem] border-b border-border hover:bg-surface-hover transition-colors text-left ${
                index === selectedIndex ? 'bg-accent/10' : ''
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 mt-1 text-accent">{typeIcons[result.type] ?? <Search className="w-4 h-4" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <span className="text-xs font-medium uppercase text-text-subtle shrink-0">{result.type}</span>
                    <span className="text-xs text-text-muted truncate">{(result.score * 100).toFixed(0)}% match</span>
                  </div>
                  <p className="font-medium truncate">{result.title}</p>
                  {result.subtitle && <p className="text-sm text-text-muted truncate mt-1">{result.subtitle}</p>}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" aria-hidden />
            </button>
          ))}
        </div>

        <div className="p-3 bg-bg border-t border-border flex items-center justify-between gap-3 text-xs text-text-muted pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
          <div className="hidden sm:flex items-center gap-4 min-w-0">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Close</span>
          </div>
          <span className="sm:hidden">Tap a result</span>
          <span className="tabular-nums shrink-0">{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
