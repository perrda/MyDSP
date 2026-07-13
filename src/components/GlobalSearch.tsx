// Global Search Component with Cmd+K shortcut

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../services/search'
import { Search, X, TrendingUp, Target, CheckSquare, Briefcase, ChevronRight } from 'lucide-react'
import { logger } from '../utils/logger'

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Keyboard shortcut: Cmd+K or Ctrl+K
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    const startTime = performance.now()

    try {
      const searchResults = await globalSearch(searchQuery, { limit: 10 })
      setResults(searchResults)
      setSelectedIndex(0)

      const duration = performance.now() - startTime
      logger.metric('global-search', duration, { 
        unit: 'ms',
        query: searchQuery,
        results: searchResults.length 
      })
    } catch (error) {
      logger.error('Search failed', error as Error, 'search')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        performSearch(query)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Handle result selection
  const handleSelect = (result: any) => {
    logger.track('global_search_result_clicked', { type: result.type, score: result.score })

    // Navigate based on result type
    switch (result.type) {
      case 'spending':
        navigate('/spending')
        break
      case 'goal':
        navigate('/goals')
        break
      case 'todo':
        navigate('/todos')
        break
      case 'job':
        navigate('/jobs')
        break
      default:
        navigate('/')
    }

    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }

  const typeIcons = {
    spending: <TrendingUp className="w-4 h-4" />,
    goal: <Target className="w-4 h-4" />,
    todo: <CheckSquare className="w-4 h-4" />,
    job: <Briefcase className="w-4 h-4" />,
  }

  const typeColors = {
    spending: 'text-red-600 dark:text-red-400',
    goal: 'text-blue-600 dark:text-blue-400',
    todo: 'text-green-600 dark:text-green-400',
    job: 'text-purple-600 dark:text-purple-400',
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm text-gray-600 dark:text-gray-400"
      >
        <Search className="w-4 h-4" />
        <span>Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search spending, goals, todos, jobs..."
            className="flex-1 bg-transparent outline-none text-lg"
          />
          {loading && (
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
          <button
            onClick={() => {
              setIsOpen(false)
              setQuery('')
              setResults([])
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query && !loading && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No results found for "{query}"
            </div>
          )}

          {results.length === 0 && !query && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Start typing to search...</p>
              <p className="text-sm mt-2">Search across spending, goals, todos, and jobs</p>
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.data.id}`}
              onClick={() => handleSelect(result)}
              className={`w-full flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                index === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`flex-shrink-0 mt-1 ${typeColors[result.type as keyof typeof typeColors]}`}>
                  {typeIcons[result.type as keyof typeof typeIcons]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {result.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(result.score * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="font-medium truncate">
                    {result.data.title || result.data.name || result.data.description || result.data.companyName}
                  </p>
                  {result.data.searchText && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                      {result.data.searchText}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">esc</kbd>
              Close
            </span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
