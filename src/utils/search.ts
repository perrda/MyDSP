// Advanced search and filtering utilities with fuzzy matching

import type { SpendingEntry, CryptoHolding, EquityHolding, Goal } from '../domain/types'
import type { JobApplication } from '../domain/job-types'
import type { TodoItem } from '../domain/todo-types'

export interface SearchOptions {
  fuzzy?: boolean
  caseSensitive?: boolean
  matchWholeWord?: boolean
  maxResults?: number
}

export interface SearchResult<T> {
  item: T
  score: number
  matches: Array<{ field: string; indices: [number, number][] }>
}

// === FUZZY MATCHING ===

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[b.length][a.length]
}

export function fuzzyMatch(query: string, text: string, threshold: number = 0.7): boolean {
  const distance = levenshteinDistance(query.toLowerCase(), text.toLowerCase())
  const maxLen = Math.max(query.length, text.length)
  const similarity = 1 - distance / maxLen
  return similarity >= threshold
}

export function fuzzyScore(query: string, text: string): number {
  if (!text || !query) return 0
  
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  
  // Exact match
  if (textLower === queryLower) return 1.0
  
  // Starts with
  if (textLower.startsWith(queryLower)) return 0.95
  
  // Contains
  if (textLower.includes(queryLower)) return 0.8
  
  // Fuzzy similarity
  const distance = levenshteinDistance(queryLower, textLower)
  const maxLen = Math.max(query.length, text.length)
  return Math.max(0, 1 - distance / maxLen)
}

// === SEARCH INDEX ===

export class SearchIndex<T> {
  private items: T[] = []
  private index: Map<string, Set<number>> = new Map()
  private fields: Array<keyof T>
  
  constructor(fields: Array<keyof T>) {
    this.fields = fields
  }
  
  add(items: T[]): void {
    items.forEach((item) => {
      this.items.push(item)
      const globalIdx = this.items.length - 1
      
      this.fields.forEach(field => {
        const value = String(item[field] || '')
        const tokens = this.tokenize(value)
        
        tokens.forEach(token => {
          if (!this.index.has(token)) {
            this.index.set(token, new Set())
          }
          this.index.get(token)!.add(globalIdx)
        })
      })
    })
  }
  
  search(query: string, options: SearchOptions = {}): SearchResult<T>[] {
    const {
      fuzzy = true,
      caseSensitive = false,
      maxResults = 100,
    } = options
    
    const queryTokens = this.tokenize(query, caseSensitive)
    const scores = new Map<number, number>()
    
    // Find candidate items
    const candidates = new Set<number>()
    queryTokens.forEach(token => {
      // Direct match
      if (this.index.has(token)) {
        this.index.get(token)!.forEach(idx => candidates.add(idx))
      }
      
      // Fuzzy match
      if (fuzzy) {
        this.index.forEach((indices, indexedToken) => {
          if (fuzzyMatch(token, indexedToken, 0.7)) {
            indices.forEach(idx => candidates.add(idx))
          }
        })
      }
    })
    
    // Score candidates
    candidates.forEach(idx => {
      const item = this.items[idx]
      let totalScore = 0
      let matchCount = 0
      
      this.fields.forEach(field => {
        const value = String(item[field] || '')
        queryTokens.forEach(token => {
          const score = fuzzyScore(token, value)
          if (score > 0.5) {
            totalScore += score
            matchCount++
          }
        })
      })
      
      if (matchCount > 0) {
        scores.set(idx, totalScore / this.fields.length)
      }
    })
    
    // Sort by score and return
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([idx, score]) => ({
        item: this.items[idx],
        score,
        matches: [],
      }))
  }
  
  clear(): void {
    this.items = []
    this.index.clear()
  }
  
  private tokenize(text: string, caseSensitive: boolean = false): string[] {
    const normalized = caseSensitive ? text : text.toLowerCase()
    return normalized
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0)
  }
}

// === SPENDING SEARCH ===

export function searchSpending(
  spending: SpendingEntry[],
  query: string,
  options: SearchOptions = {}
): SearchResult<SpendingEntry>[] {
  const index = new SearchIndex<SpendingEntry>(['description', 'category'])
  index.add(spending)
  return index.search(query, options)
}

// === FILTERING ===

export interface FilterOptions<T> {
  search?: string
  filters?: Partial<Record<keyof T, any | any[]>>
  dateRange?: { from: string; to: string }
  amountRange?: { min: number; max: number }
  sort?: {
    field: keyof T
    direction: 'asc' | 'desc'
  }
}

export function filterItems<T extends Record<string, any>>(
  items: T[],
  options: FilterOptions<T>
): T[] {
  let filtered = [...items]
  
  // Text search
  if (options.search) {
    const query = options.search.toLowerCase()
    filtered = filtered.filter(item => {
      return Object.values(item).some(value => 
        String(value).toLowerCase().includes(query)
      )
    })
  }
  
  // Field filters
  if (options.filters) {
    filtered = filtered.filter(item => {
      return Object.entries(options.filters!).every(([key, value]) => {
        const itemValue = item[key]
        
        // Array of accepted values
        if (Array.isArray(value)) {
          return value.includes(itemValue)
        }
        
        // Single value
        return itemValue === value
      })
    })
  }
  
  // Date range
  if (options.dateRange && 'date' in items[0]) {
    filtered = filtered.filter(item => {
      const date = (item as any).date
      return date >= options.dateRange!.from && date <= options.dateRange!.to
    })
  }
  
  // Amount range
  if (options.amountRange && 'amount' in items[0]) {
    filtered = filtered.filter(item => {
      const amount = Math.abs((item as any).amount)
      return amount >= options.amountRange!.min && amount <= options.amountRange!.max
    })
  }
  
  // Sorting
  if (options.sort) {
    const { field, direction } = options.sort
    filtered.sort((a, b) => {
      const aVal = a[field]
      const bVal = b[field]
      
      if (aVal === bVal) return 0
      
      const comparison = aVal < bVal ? -1 : 1
      return direction === 'asc' ? comparison : -comparison
    })
  }
  
  return filtered
}

// === ADVANCED FILTERS ===

export function filterSpendingAdvanced(
  spending: SpendingEntry[],
  filters: {
    categories?: string[]
    methods?: string[]
    dateRange?: { from: string; to: string }
    amountRange?: { min: number; max: number }
    search?: string
    excludeCategories?: string[]
  }
): SpendingEntry[] {
  return spending.filter(s => {
    // Categories
    if (filters.categories && !filters.categories.includes(s.category)) {
      return false
    }
    
    // Exclude categories
    if (filters.excludeCategories && filters.excludeCategories.includes(s.category)) {
      return false
    }
    
    // Methods
    if (filters.methods && !filters.methods.includes(s.method)) {
      return false
    }
    
    // Date range
    if (filters.dateRange) {
      if (s.date < filters.dateRange.from || s.date > filters.dateRange.to) {
        return false
      }
    }
    
    // Amount range
    if (filters.amountRange) {
      const amount = Math.abs(s.amount)
      if (amount < filters.amountRange.min || amount > filters.amountRange.max) {
        return false
      }
    }
    
    // Search
    if (filters.search) {
      const query = filters.search.toLowerCase()
      const searchable = `${s.description} ${s.category}`.toLowerCase()
      if (!searchable.includes(query)) {
        return false
      }
    }
    
    return true
  })
}

// === GLOBAL SEARCH ===

export interface GlobalSearchResult {
  type: 'spending' | 'crypto' | 'equity' | 'goal' | 'job' | 'todo'
  item: any
  title: string
  subtitle: string
  score: number
  url: string
}

export function globalSearch(
  query: string,
  data: {
    spending: SpendingEntry[]
    crypto: CryptoHolding[]
    equities: EquityHolding[]
    goals: Goal[]
    jobs: JobApplication[]
    todos: TodoItem[]
  }
): GlobalSearchResult[] {
  const results: GlobalSearchResult[] = []
  
  // Search spending
  data.spending.forEach(s => {
    const score = fuzzyScore(query, `${s.description} ${s.category}`)
    if (score > 0.3) {
      results.push({
        type: 'spending',
        item: s,
        title: s.description,
        subtitle: `${s.category} · ${s.date}`,
        score,
        url: '/spending',
      })
    }
  })
  
  // Search crypto
  data.crypto.forEach(c => {
    const score = fuzzyScore(query, `${c.symbol} ${c.name || ''}`)
    if (score > 0.3) {
      results.push({
        type: 'crypto',
        item: c,
        title: c.symbol,
        subtitle: c.name || 'Crypto holding',
        score,
        url: `/crypto/${c.id}`,
      })
    }
  })
  
  // Search equities
  data.equities.forEach(e => {
    const score = fuzzyScore(query, `${e.symbol} ${e.name || ''}`)
    if (score > 0.3) {
      results.push({
        type: 'equity',
        item: e,
        title: e.symbol,
        subtitle: e.name || 'Equity holding',
        score,
        url: `/equities/${e.id}`,
      })
    }
  })
  
  // Search goals
  data.goals.forEach(g => {
    const score = fuzzyScore(query, g.name)
    if (score > 0.3) {
      results.push({
        type: 'goal',
        item: g,
        title: g.name,
        subtitle: `Goal · ${g.type}`,
        score,
        url: '/goals',
      })
    }
  })
  
  // Search jobs
  data.jobs.forEach(j => {
    const score = fuzzyScore(query, `${j.companyName} ${j.jobTitle}`)
    if (score > 0.3) {
      results.push({
        type: 'job',
        item: j,
        title: j.jobTitle,
        subtitle: j.companyName,
        score,
        url: `/jobs/${j.id}`,
      })
    }
  })
  
  // Search todos
  data.todos.forEach(t => {
    const score = fuzzyScore(query, t.title)
    if (score > 0.3) {
      results.push({
        type: 'todo',
        item: t,
        title: t.title,
        subtitle: `Todo · ${t.priority} priority`,
        score,
        url: '/todos',
      })
    }
  })
  
  return results.sort((a, b) => b.score - a.score).slice(0, 20)
}

// === SEARCH HISTORY ===

const SEARCH_HISTORY_KEY = 'mydsp:search-history'
const MAX_HISTORY = 10

export function getSearchHistory(): string[] {
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY)
    return history ? JSON.parse(history) : []
  } catch {
    return []
  }
}

export function addToSearchHistory(query: string): void {
  if (!query.trim()) return
  
  const history = getSearchHistory()
  const updated = [query, ...history.filter(q => q !== query)].slice(0, MAX_HISTORY)
  
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  } catch {
    // Quota exceeded or localStorage unavailable
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch {
    // localStorage unavailable
  }
}
