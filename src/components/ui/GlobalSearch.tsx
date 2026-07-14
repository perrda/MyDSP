import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, TrendingUp, Coins, Building2, Target, FileText } from 'lucide-react'
import { usePortfolio } from '../../context/PortfolioContext'

interface SearchResult {
  type: 'crypto' | 'equity' | 'liability' | 'goal' | 'page'
  title: string
  subtitle?: string
  path: string
  icon: typeof Coins
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { data } = usePortfolio()

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const searchQuery = query.toLowerCase()
    const matches: SearchResult[] = []

    // Search crypto
    data.crypto.forEach((c) => {
      if (
        c.symbol.toLowerCase().includes(searchQuery) ||
        c.name.toLowerCase().includes(searchQuery)
      ) {
        matches.push({
          type: 'crypto',
          title: c.symbol,
          subtitle: c.name,
          path: `/crypto/${c.id}`,
          icon: Coins,
        })
      }
    })

    // Search equities
    data.equities.forEach((e) => {
      if (
        e.symbol.toLowerCase().includes(searchQuery) ||
        e.name.toLowerCase().includes(searchQuery)
      ) {
        matches.push({
          type: 'equity',
          title: e.symbol,
          subtitle: e.name,
          path: `/equities/${e.id}`,
          icon: TrendingUp,
        })
      }
    })

    // Search liabilities
    data.creditCards.forEach((cc) => {
      if (cc.name.toLowerCase().includes(searchQuery)) {
        matches.push({
          type: 'liability',
          title: cc.name,
          subtitle: 'Credit Card',
          path: `/liabilities/card/${cc.id}`,
          icon: Building2,
        })
      }
    })

    data.loans.forEach((loan) => {
      if (loan.name.toLowerCase().includes(searchQuery)) {
        matches.push({
          type: 'liability',
          title: loan.name,
          subtitle: 'Loan',
          path: `/liabilities/loan/${loan.id}`,
          icon: Building2,
        })
      }
    })

    // Search goals
    data.goals.forEach((goal) => {
      if (goal.name.toLowerCase().includes(searchQuery)) {
        matches.push({
          type: 'goal',
          title: goal.name,
          subtitle: 'Goal',
          path: '/goals',
          icon: Target,
        })
      }
    })

    // Add page shortcuts
    const pages = [
      { title: 'Dashboard', path: '/', keywords: ['home', 'overview'] },
      { title: 'Markets', path: '/markets', keywords: ['watchlist', 'quotes', 'prices', 'tickers', 'fx', 'gbp', 'usd', 'thb', 'ada', 'cross'] },
      { title: 'Crypto', path: '/crypto', keywords: ['bitcoin', 'btc', 'holdings'] },
      { title: 'Equities', path: '/equities', keywords: ['stocks', 'shares'] },
      { title: 'Liabilities', path: '/liabilities', keywords: ['debt', 'credit', 'loans'] },
      { title: 'Goals', path: '/goals', keywords: ['targets', 'objectives'] },
      { title: 'Spending', path: '/spending', keywords: ['expenses', 'transactions'] },
      { title: 'Budgets', path: '/budgets', keywords: ['budget', 'limits'] },
      { title: 'Tax', path: '/tax', keywords: ['cgt', 'capital gains'] },
      { title: 'Settings', path: '/settings', keywords: ['config', 'preferences'] },
    ]

    pages.forEach((page) => {
      if (
        page.title.toLowerCase().includes(searchQuery) ||
        page.keywords.some((k) => k.includes(searchQuery))
      ) {
        matches.push({
          type: 'page',
          title: page.title,
          subtitle: 'Page',
          path: page.path,
          icon: FileText,
        })
      }
    })

    setResults(matches.slice(0, 10))
    setSelectedIndex(0)
  }, [query, data])

  const handleSelect = (result: SearchResult) => {
    navigate(result.path)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Search Dialog */}
      <div className="fixed inset-0 z-[2001] flex items-start justify-center pt-[20vh] px-4">
        <div className="surface w-full max-w-2xl border border-border-strong shadow-2xl animate-scale-in overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search className="w-5 h-5 text-text-subtle flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search holdings, pages, goals..."
              className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-text-subtle"
            />
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setQuery('')
              }}
              className="text-text-subtle hover:text-text p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          {results.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto">
              {results.map((result, index) => {
                const Icon = result.icon
                return (
                  <button
                    key={`${result.type}-${result.path}`}
                    type="button"
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-surface-hover border-l-2 border-l-accent'
                        : 'border-l-2 border-l-transparent hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-xs text-text-subtle truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-text-subtle uppercase tracking-wider">
                      {result.type}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-center text-text-muted">
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-8 text-center text-text-muted">
              <p className="text-sm">Start typing to search...</p>
              <p className="text-xs mt-2">
                Use <kbd className="px-2 py-1 bg-surface-hover border border-border text-xs">↑</kbd>{' '}
                <kbd className="px-2 py-1 bg-surface-hover border border-border text-xs">↓</kbd> to
                navigate
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function SearchTrigger() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="toolbar-icon"
        aria-label="Search (⌘K)"
      >
        <Search size={18} />
      </button>
      {isOpen && <GlobalSearch />}
    </>
  )
}
