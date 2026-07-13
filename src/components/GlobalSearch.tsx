// Global Search Component with Cmd+K shortcut — searches live portfolio data

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, TrendingUp, Target, CheckSquare, Briefcase, ChevronRight, Coins } from 'lucide-react'
import { usePortfolio } from '../context/PortfolioContext'
import { globalSearch, type GlobalSearchResult } from '../utils/search'
import { logger } from '../utils/logger'

export function GlobalSearch() {
  const { data } = usePortfolio()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

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
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-bg hover:bg-surface-hover rounded-lg transition-colors text-sm text-text-muted border border-border"
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-bg-elevated border border-border rounded">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-3 bg-bg-elevated rounded-xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search className="w-5 h-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search spending, holdings, goals, todos, jobs..."
            className="flex-1 bg-transparent outline-none text-lg"
          />
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              setQuery('')
              setResults([])
            }}
            className="p-1 hover:bg-surface-hover rounded"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query && (
            <div className="p-8 text-center text-text-muted">No results for “{query}”</div>
          )}
          {results.length === 0 && !query && (
            <div className="p-8 text-center text-text-muted">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Start typing to search…</p>
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.title}-${index}`}
              type="button"
              onClick={() => handleSelect(result)}
              className={`w-full flex items-center justify-between p-4 border-b border-border hover:bg-surface-hover transition-colors text-left ${
                index === selectedIndex ? 'bg-accent/10' : ''
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 mt-1 text-accent">{typeIcons[result.type] ?? <Search className="w-4 h-4" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase text-text-subtle">{result.type}</span>
                    <span className="text-xs text-text-muted">{(result.score * 100).toFixed(0)}% match</span>
                  </div>
                  <p className="font-medium truncate">{result.title}</p>
                  {result.subtitle && <p className="text-sm text-text-muted truncate mt-1">{result.subtitle}</p>}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
            </button>
          ))}
        </div>

        <div className="p-3 bg-bg border-t border-border flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Close</span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
