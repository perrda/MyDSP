// Smart Data Features - Pattern Recognition and Intelligent Suggestions
// ML-style features without external dependencies

import type { SpendingEntry, RecurringTransaction, Goal } from '../domain/types'
import { formatGBP } from '../utils/format'

export interface SpendingPattern {
  pattern: 'recurring' | 'seasonal' | 'weekend' | 'weekday'
  merchant: string
  category: string
  avgAmount: number
  frequency: number // days between occurrences
  confidence: number // 0-100
  lastOccurrence: string
  nextPredicted: string
  suggestion: string
}

export interface SmartSuggestion {
  id: string
  type: 'recurring' | 'category' | 'budget' | 'goal' | 'optimization'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action?: string
  data?: any
}

export interface CategorySuggestion {
  transaction: SpendingEntry
  suggestedCategory: string
  confidence: number
  reason: string
}

export interface MerchantCluster {
  merchant: string
  variants: string[]
  category: string
  transactions: number
  totalAmount: number
  suggestion: string
}

// Detect recurring spending patterns
export function detectRecurringPatterns(spending: SpendingEntry[]): SpendingPattern[] {
  const patterns: SpendingPattern[] = []
  
  // Group by merchant (normalized)
  const merchantGroups = new Map<string, SpendingEntry[]>()
  
  spending.forEach(s => {
    const normalized = normalizeMerchant(s.description)
    if (!merchantGroups.has(normalized)) {
      merchantGroups.set(normalized, [])
    }
    merchantGroups.get(normalized)!.push(s)
  })
  
  // Analyze each merchant group
  merchantGroups.forEach((transactions, merchant) => {
    if (transactions.length < 3) return // Need at least 3 occurrences
    
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const amounts = sortedTx.map(t => Math.abs(t.amount))
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
    
    // Calculate intervals between transactions
    const intervals: number[] = []
    for (let i = 1; i < sortedTx.length; i++) {
      const days = daysBetween(sortedTx[i-1].date, sortedTx[i].date)
      intervals.push(days)
    }
    
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length
    const stdDev = Math.sqrt(
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    )
    
    // High confidence if consistent intervals (low std dev)
    const coefficientOfVariation = stdDev / avgInterval
    const confidence = Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100))
    
    // Only suggest if confidence > 60% and interval is reasonable (7-90 days)
    if (confidence > 60 && avgInterval >= 7 && avgInterval <= 90) {
      const lastOccurrence = sortedTx[sortedTx.length - 1].date
      const nextPredicted = addDays(lastOccurrence, Math.round(avgInterval))
      
      let patternType: 'recurring' | 'seasonal' | 'weekend' | 'weekday' = 'recurring'
      if (avgInterval >= 25 && avgInterval <= 35) patternType = 'recurring' // ~monthly
      else if (avgInterval >= 6 && avgInterval <= 8) patternType = 'weekend' // ~weekly
      
      patterns.push({
        pattern: patternType,
        merchant,
        category: transactions[0].category,
        avgAmount,
        frequency: Math.round(avgInterval),
        confidence: Math.round(confidence),
        lastOccurrence,
        nextPredicted,
        suggestion: `Add as recurring transaction: ${merchant} every ${Math.round(avgInterval)} days`,
      })
    }
  })
  
  return patterns.sort((a, b) => b.confidence - a.confidence)
}

// Generate smart suggestions based on spending patterns
export function generateSmartSuggestions(
  spending: SpendingEntry[],
  existingRecurring: RecurringTransaction[],
  goals: Goal[],
  budgetGoals: Record<string, number>
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = []
  
  // 1. Suggest converting patterns to recurring transactions
  const patterns = detectRecurringPatterns(spending)
  const existingMerchants = new Set(existingRecurring.map(r => 
    normalizeMerchant(r.name)
  ))
  
  patterns.slice(0, 3).forEach((pattern, i) => {
    const normalized = normalizeMerchant(pattern.merchant)
    if (!existingMerchants.has(normalized) && pattern.confidence > 70) {
      suggestions.push({
        id: `recurring-${i}`,
        type: 'recurring',
        priority: 'high',
        title: 'Set up recurring transaction',
        description: `"${pattern.merchant}" appears every ${pattern.frequency} days with ${pattern.confidence}% consistency`,
        action: 'Add to recurring',
        data: pattern,
      })
    }
  })
  
  // 2. Suggest budget optimization
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthSpending = spending.filter(s => s.date.startsWith(currentMonth))
  const categorySpending = new Map<string, number>()
  
  monthSpending.forEach(s => {
    const cat = s.category.toLowerCase()
    categorySpending.set(cat, (categorySpending.get(cat) || 0) + Math.abs(s.amount))
  })
  
  categorySpending.forEach((spent, category) => {
    const limit = budgetGoals[category]
    if (!limit && spent > 100) {
      suggestions.push({
        id: `budget-${category}`,
        type: 'budget',
        priority: 'medium',
        title: `Set budget for ${category}`,
        description: `You've spent ${formatGBP(spent)} on ${category} this month with no budget set`,
        action: 'Create budget',
        data: { category, suggestedLimit: Math.ceil(spent * 1.1) },
      })
    }
  })
  
  // 3. Suggest goal creation for savings
  const last3Months = spending.filter(s => {
    const date = new Date(s.date)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 3)
    return date >= cutoff
  })
  
  const avgMonthlySpending = last3Months.reduce((sum, s) => sum + Math.abs(s.amount), 0) / 3
  
  const hasEmergencyFund = goals.some(g => 
    g.name.toLowerCase().includes('emergency') || 
    g.name.toLowerCase().includes('savings')
  )
  
  if (!hasEmergencyFund && avgMonthlySpending > 0) {
    suggestions.push({
      id: 'goal-emergency',
      type: 'goal',
      priority: 'high',
      title: 'Create emergency fund goal',
      description: `Based on your average spending of ${formatGBP(avgMonthlySpending)}/month, aim for 3-6 months of expenses`,
      action: 'Create goal',
      data: { suggestedAmount: Math.ceil(avgMonthlySpending * 3) },
    })
  }
  
  // 4. Detect merchant name variations
  const clusters = detectMerchantClusters(spending)
  clusters.slice(0, 2).forEach((cluster, i) => {
    if (cluster.variants.length > 1) {
      suggestions.push({
        id: `merchant-${i}`,
        type: 'category',
        priority: 'low',
        title: 'Standardize merchant names',
        description: `"${cluster.merchant}" appears as ${cluster.variants.length} different names`,
        action: 'Create merchant rule',
        data: cluster,
      })
    }
  })
  
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

// Suggest category corrections based on similar transactions
export function suggestCategoryCorrections(
  spending: SpendingEntry[]
): CategorySuggestion[] {
  const suggestions: CategorySuggestion[] = []
  
  // Build a map of merchant -> most common category
  const merchantCategories = new Map<string, Map<string, number>>()
  
  spending.forEach(s => {
    const merchant = normalizeMerchant(s.description)
    if (!merchantCategories.has(merchant)) {
      merchantCategories.set(merchant, new Map())
    }
    const catMap = merchantCategories.get(merchant)!
    catMap.set(s.category, (catMap.get(s.category) || 0) + 1)
  })
  
  // Find transactions with minority categories for their merchant
  spending.forEach(transaction => {
    const merchant = normalizeMerchant(transaction.description)
    const catMap = merchantCategories.get(merchant)!
    
    if (catMap.size > 1) {
      const entries = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
      const [mostCommon, mostCount] = entries[0]
      const totalCount = Array.from(catMap.values()).reduce((sum, c) => sum + c, 0)
      
      if (transaction.category !== mostCommon && mostCount / totalCount > 0.7) {
        suggestions.push({
          transaction,
          suggestedCategory: mostCommon,
          confidence: Math.round((mostCount / totalCount) * 100),
          reason: `${mostCount} of ${totalCount} transactions at "${merchant}" are categorized as "${mostCommon}"`,
        })
      }
    }
  })
  
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10)
}

// Detect merchant name variations and cluster them
export function detectMerchantClusters(spending: SpendingEntry[]): MerchantCluster[] {
  const clusters: MerchantCluster[] = []
  const processed = new Set<string>()
  
  spending.forEach(s => {
    const desc = s.description.toLowerCase()
    if (processed.has(desc)) return
    
    const variants: string[] = [s.description]
    let totalAmount = Math.abs(s.amount)
    let transactionCount = 1
    
    // Find similar merchants
    spending.forEach(other => {
      if (other.id === s.id) return
      const otherDesc = other.description.toLowerCase()
      if (processed.has(otherDesc)) return
      
      if (isSimilarMerchant(desc, otherDesc)) {
        variants.push(other.description)
        totalAmount += Math.abs(other.amount)
        transactionCount++
        processed.add(otherDesc)
      }
    })
    
    if (variants.length > 1) {
      processed.add(desc)
      const normalized = normalizeMerchant(s.description)
      
      clusters.push({
        merchant: normalized,
        variants,
        category: s.category,
        transactions: transactionCount,
        totalAmount,
        suggestion: `Create merchant rule: "${variants.join('" OR "')}" → "${normalized}"`,
      })
    }
  })
  
  return clusters.sort((a, b) => b.transactions - a.transactions)
}

// Helper functions

function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/\d+/g, '') // Remove numbers
    .replace(/[^a-z\s]/g, '') // Remove special chars
    .trim()
    .split(/\s+/)
    .slice(0, 2) // Take first 2 words
    .join(' ')
}

function isSimilarMerchant(a: string, b: string): boolean {
  const aNorm = normalizeMerchant(a)
  const bNorm = normalizeMerchant(b)
  
  if (aNorm === bNorm) return true
  
  // Check if one starts with the other
  if (aNorm.startsWith(bNorm) || bNorm.startsWith(aNorm)) return true
  
  // Check Levenshtein distance
  const distance = levenshteinDistance(aNorm, bNorm)
  const maxLen = Math.max(aNorm.length, bNorm.length)
  const similarity = 1 - distance / maxLen
  
  return similarity > 0.7
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

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
