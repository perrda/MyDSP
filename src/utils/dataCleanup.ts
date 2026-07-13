// Automated data cleanup, maintenance, and optimization utilities

import type { PortfolioData, SpendingEntry, Goal, HistoryPoint } from '../domain/types'
import type { TodoItem } from '../domain/todo-types'
import type { JobApplication } from '../domain/job-types'

// === DATA CLEANUP ===

export interface CleanupReport {
  itemsRemoved: number
  itemsUpdated: number
  spaceFreed: number // bytes
  categories: Record<string, number>
  timestamp: string
}

export interface CleanupOptions {
  removeOldData?: boolean
  daysToKeep?: number
  removeCompleted?: boolean
  removeDuplicates?: boolean
  normalizeData?: boolean
  compactHistory?: boolean
}

export function cleanupPortfolioData(
  data: PortfolioData,
  options: CleanupOptions = {}
): { data: PortfolioData; report: CleanupReport } {
  const {
    removeOldData = false,
    daysToKeep = 365,
    removeCompleted = false,
    removeDuplicates = true,
    normalizeData = true,
    compactHistory = false
  } = options
  
  const report: CleanupReport = {
    itemsRemoved: 0,
    itemsUpdated: 0,
    spaceFreed: 0,
    categories: {},
    timestamp: new Date().toISOString()
  }
  
  const result = { ...data }
  
  // Clean spending entries
  if (data.spending) {
    const { cleaned, removed } = cleanupSpendingEntries(
      data.spending,
      removeOldData,
      daysToKeep,
      removeDuplicates
    )
    result.spending = cleaned
    report.itemsRemoved += removed
    report.categories.spending = removed
  }
  
  // Clean goals
  if (data.goals) {
    const { cleaned, removed } = cleanupGoals(
      data.goals,
      removeCompleted
    )
    result.goals = cleaned
    report.itemsRemoved += removed
    report.categories.goals = removed
  }
  
  // Clean history
  if (data.history && compactHistory) {
    const { cleaned, removed } = compactHistoryData(data.history)
    result.history = cleaned
    report.itemsRemoved += removed
    report.categories.history = removed
  }
  
  // Normalize data
  if (normalizeData) {
    const updated = normalizePortfolioData(result)
    report.itemsUpdated += updated
  }
  
  return { data: result, report }
}

function cleanupSpendingEntries(
  spending: SpendingEntry[],
  removeOld: boolean,
  daysToKeep: number,
  removeDupes: boolean
): { cleaned: SpendingEntry[]; removed: number } {
  let cleaned = [...spending]
  let removed = 0
  
  // Remove old entries
  if (removeOld) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const initialLength = cleaned.length
    cleaned = cleaned.filter(s => new Date(s.date) >= cutoffDate)
    removed += initialLength - cleaned.length
  }
  
  // Remove duplicates
  if (removeDupes) {
    const seen = new Set<string>()
    const initialLength = cleaned.length
    cleaned = cleaned.filter(s => {
      const key = `${s.date}-${s.amount}-${s.description}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    removed += initialLength - cleaned.length
  }
  
  return { cleaned, removed }
}

function cleanupGoals(
  goals: Goal[],
  removeCompleted: boolean
): { cleaned: Goal[]; removed: number } {
  let cleaned = [...goals]
  let removed = 0
  
  if (removeCompleted) {
    const now = new Date()
    const initialLength = cleaned.length
    cleaned = cleaned.filter(g => new Date(g.deadline) >= now)
    removed += initialLength - cleaned.length
  }
  
  return { cleaned, removed }
}

function compactHistoryData(
  history: HistoryPoint[]
): { cleaned: HistoryPoint[]; removed: number } {
  if (history.length <= 365) return { cleaned: history, removed: 0 }
  
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  
  // Keep all recent data (last year) + monthly snapshots for older data
  const recent = history.filter(h => new Date(h.date) >= oneYearAgo)
  const old = history.filter(h => new Date(h.date) < oneYearAgo)
  
  // Keep only first of each month for old data
  const monthlyOld = old.filter((h, idx, arr) => {
    if (idx === 0) return true
    const prevDate = new Date(arr[idx - 1].date)
    const currDate = new Date(h.date)
    return prevDate.getMonth() !== currDate.getMonth() ||
           prevDate.getFullYear() !== currDate.getFullYear()
  })
  
  const cleaned = [...monthlyOld, ...recent]
  return { cleaned, removed: history.length - cleaned.length }
}

function normalizePortfolioData(data: PortfolioData): number {
  let updated = 0
  
  // Remove null/undefined commentaries
  if (data.creditCards) {
    data.creditCards.forEach(cc => {
      if (cc.commentaries) {
        const before = cc.commentaries.length
        cc.commentaries = cc.commentaries.filter(c => c && c.text && c.text.trim())
        updated += before - cc.commentaries.length
      }
    })
  }
  
  if (data.loans) {
    data.loans.forEach(loan => {
      if (loan.commentaries) {
        const before = loan.commentaries.length
        loan.commentaries = loan.commentaries.filter(c => c && c.text && c.text.trim())
        updated += before - loan.commentaries.length
      }
    })
  }
  
  if (data.goals) {
    data.goals.forEach(g => {
      if (g.commentaries) {
        const before = g.commentaries.length
        g.commentaries = g.commentaries.filter(c => c && c.text && c.text.trim())
        updated += before - g.commentaries.length
      }
    })
  }
  
  return updated
}

// === TODO CLEANUP ===

export function cleanupTodos(
  todos: TodoItem[],
  options: {
    removeCompleted?: boolean
    daysOld?: number
    removeArchived?: boolean
  } = {}
): { cleaned: TodoItem[]; removed: number } {
  const { removeCompleted = false, daysOld = 30, removeArchived = true } = options
  
  let cleaned = [...todos]
  let removed = 0
  
  if (removeCompleted) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    const initialLength = cleaned.length
    cleaned = cleaned.filter(t => {
      if (!t.completedAt) return true
      return new Date(t.completedAt) >= cutoffDate
    })
    removed += initialLength - cleaned.length
  }
  
  if (removeArchived) {
    const initialLength = cleaned.length
    cleaned = cleaned.filter(t => t.status !== 'archived')
    removed += initialLength - cleaned.length
  }
  
  return { cleaned, removed }
}

// === JOB APPLICATION CLEANUP ===

export function cleanupJobs(
  jobs: JobApplication[],
  options: {
    removeRejected?: boolean
    daysOld?: number
    removeArchived?: boolean
  } = {}
): { cleaned: JobApplication[]; removed: number } {
  const { removeRejected = false, daysOld = 90, removeArchived = true } = options
  
  let cleaned = [...jobs]
  let removed = 0
  
  if (removeRejected) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    const initialLength = cleaned.length
    cleaned = cleaned.filter(j => {
      if (j.status !== 'rejected') return true
      return j.updatedAt && new Date(j.updatedAt) >= cutoffDate
    })
    removed += initialLength - cleaned.length
  }
  
  if (removeArchived) {
    const initialLength = cleaned.length
    cleaned = cleaned.filter(j => j.status !== 'archived')
    removed += initialLength - cleaned.length
  }
  
  return { cleaned, removed }
}

// === DUPLICATE DETECTION ===

export interface DuplicateGroup<T> {
  items: T[]
  similarityScore: number
}

export function findDuplicateSpending(
  spending: SpendingEntry[],
  threshold: number = 0.9
): DuplicateGroup<SpendingEntry>[] {
  const groups: DuplicateGroup<SpendingEntry>[] = []
  const processed = new Set<number>()
  
  spending.forEach((entry, idx) => {
    if (processed.has(idx)) return
    
    const duplicates: SpendingEntry[] = [entry]
    processed.add(idx)
    
    spending.forEach((other, otherIdx) => {
      if (otherIdx <= idx || processed.has(otherIdx)) return
      
      const similarity = calculateSpendingSimilarity(entry, other)
      if (similarity >= threshold) {
        duplicates.push(other)
        processed.add(otherIdx)
      }
    })
    
    if (duplicates.length > 1) {
      groups.push({
        items: duplicates,
        similarityScore: 1.0
      })
    }
  })
  
  return groups
}

function calculateSpendingSimilarity(a: SpendingEntry, b: SpendingEntry): number {
  let score = 0
  let factors = 0
  
  // Same date
  if (a.date === b.date) {
    score += 0.4
  }
  factors++
  
  // Same amount
  if (Math.abs(a.amount - b.amount) < 0.01) {
    score += 0.3
  }
  factors++
  
  // Similar description
  const descSimilarity = stringSimilarity(
    a.description.toLowerCase(),
    b.description.toLowerCase()
  )
  score += descSimilarity * 0.2
  factors++
  
  // Same category
  if (a.category === b.category) {
    score += 0.1
  }
  factors++
  
  return score
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  
  if (longer.length === 0) return 1
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(a: string, b: string): number {
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

// === DATA OPTIMIZATION ===

export function optimizeLocalStorage(): CleanupReport {
  const report: CleanupReport = {
    itemsRemoved: 0,
    itemsUpdated: 0,
    spaceFreed: 0,
    categories: {},
    timestamp: new Date().toISOString()
  }
  
  const before = estimateLocalStorageSize()
  
  // Remove expired cache entries
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    if (key.startsWith('cache_')) {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}')
        if (item.expiry && Date.now() > item.expiry) {
          localStorage.removeItem(key)
          report.itemsRemoved++
        }
      } catch {
        // Invalid JSON, remove it
        localStorage.removeItem(key)
        report.itemsRemoved++
      }
    }
  }
  
  const after = estimateLocalStorageSize()
  report.spaceFreed = before - after
  
  return report
}

function estimateLocalStorageSize(): number {
  let size = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const value = localStorage.getItem(key) || ''
      size += key.length + value.length
    }
  }
  return size * 2 // Approximate byte size (UTF-16)
}

// === SCHEDULED CLEANUP ===

export interface CleanupSchedule {
  interval: number // milliseconds
  options: CleanupOptions
  enabled: boolean
}

let cleanupTimerId: number | undefined

export function scheduleCleanup(
  schedule: CleanupSchedule,
  onCleanup: (report: CleanupReport) => void
): void {
  if (cleanupTimerId) {
    window.clearInterval(cleanupTimerId)
  }
  
  if (!schedule.enabled) return
  
  cleanupTimerId = window.setInterval(() => {
    const report = optimizeLocalStorage()
    onCleanup(report)
  }, schedule.interval)
}

export function cancelScheduledCleanup(): void {
  if (cleanupTimerId) {
    window.clearInterval(cleanupTimerId)
    cleanupTimerId = undefined
  }
}

// === DATA VALIDATION & REPAIR ===

export interface ValidationIssue {
  type: 'error' | 'warning'
  field: string
  message: string
  fixable: boolean
}

export function validatePortfolioData(data: PortfolioData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  
  // Validate crypto holdings
  if (data.crypto) {
    data.crypto.forEach((holding, idx) => {
      if (!holding.symbol) {
        issues.push({
          type: 'error',
          field: `crypto[${idx}].symbol`,
          message: 'Symbol is required',
          fixable: false
        })
      }
      if (holding.qty < 0) {
        issues.push({
          type: 'error',
          field: `crypto[${idx}].qty`,
          message: 'Quantity cannot be negative',
          fixable: true
        })
      }
    })
  }
  
  // Validate spending
  if (data.spending) {
    data.spending.forEach((entry, idx) => {
      if (!entry.date) {
        issues.push({
          type: 'error',
          field: `spending[${idx}].date`,
          message: 'Date is required',
          fixable: false
        })
      }
      if (entry.amount < 0) {
        issues.push({
          type: 'warning',
          field: `spending[${idx}].amount`,
          message: 'Amount should be positive',
          fixable: true
        })
      }
    })
  }
  
  // Validate goals
  if (data.goals) {
    data.goals.forEach((goal, idx) => {
      if (!goal.name) {
        issues.push({
          type: 'error',
          field: `goals[${idx}].name`,
          message: 'Goal name is required',
          fixable: false
        })
      }
      if (goal.target <= 0) {
        issues.push({
          type: 'error',
          field: `goals[${idx}].target`,
          message: 'Target must be positive',
          fixable: false
        })
      }
    })
  }
  
  return issues
}

export function repairPortfolioData(data: PortfolioData): { repaired: PortfolioData; fixes: number } {
  const result = { ...data }
  let fixes = 0
  
  // Fix negative quantities
  if (result.crypto) {
    result.crypto = result.crypto.map(h => {
      if (h.qty < 0) {
        fixes++
        return { ...h, qty: Math.abs(h.qty) }
      }
      return h
    })
  }
  
  // Fix negative spending amounts
  if (result.spending) {
    result.spending = result.spending.map(s => {
      if (s.amount < 0) {
        fixes++
        return { ...s, amount: Math.abs(s.amount) }
      }
      return s
    })
  }
  
  return { repaired: result, fixes }
}
