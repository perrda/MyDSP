// Data transformation pipelines for ETL operations

import type { PortfolioData, SpendingEntry } from '../domain/types'

// === TRANSFORMATION TYPES ===

export type TransformFunction<T, R> = (input: T) => R

export interface Pipeline<T> {
  steps: Array<TransformFunction<any, any>>
  execute: (input: T) => any
}

export interface TransformationRule {
  name: string
  condition?: (item: any) => boolean
  transform: (item: any) => any
}

// === PIPELINE BUILDER ===

export class TransformPipeline<T> {
  private steps: Array<TransformFunction<any, any>> = []
  
  pipe<R>(fn: TransformFunction<T, R>): TransformPipeline<R> {
    this.steps.push(fn)
    return this as any
  }
  
  execute(input: T): any {
    return this.steps.reduce((acc, fn) => fn(acc), input)
  }
  
  batch(items: T[]): any[] {
    return items.map(item => this.execute(item))
  }
}

// === COMMON TRANSFORMATIONS ===

export function mapFields<T extends Record<string, any>>(
  mapping: Record<string, string>
): TransformFunction<T, Record<string, any>> {
  return (item: T) => {
    const result: Record<string, any> = {}
    Object.entries(mapping).forEach(([newKey, oldKey]) => {
      result[newKey] = item[oldKey]
    })
    return result
  }
}

export function filterFields<T extends Record<string, any>>(
  fields: string[]
): TransformFunction<T, Partial<T>> {
  return (item: T) => {
    const result: Partial<T> = {}
    fields.forEach(field => {
      if (field in item) {
        result[field as keyof T] = item[field as keyof T]
      }
    })
    return result
  }
}

export function omitFields<T extends Record<string, any>>(
  fields: string[]
): TransformFunction<T, Partial<T>> {
  return (item: T) => {
    const result = { ...item }
    fields.forEach(field => {
      delete result[field]
    })
    return result
  }
}

export function renameField<T extends Record<string, any>>(
  oldName: string,
  newName: string
): TransformFunction<T, T> {
  return (item: T) => {
    const result = { ...item }
    if (oldName in result) {
      result[newName as keyof T] = result[oldName as keyof T]
      delete result[oldName as keyof T]
    }
    return result
  }
}

export function addField<T extends Record<string, any>>(
  field: string,
  value: any | ((item: T) => any)
): TransformFunction<T, T & Record<string, any>> {
  return (item: T) => {
    const computedValue = typeof value === 'function' ? value(item) : value
    return { ...item, [field]: computedValue }
  }
}

export function transformField<T extends Record<string, any>>(
  field: string,
  transformer: (value: any) => any
): TransformFunction<T, T> {
  return (item: T) => {
    if (field in item) {
      return { ...item, [field]: transformer(item[field]) }
    }
    return item
  }
}

// === AGGREGATION TRANSFORMATIONS ===

export function groupBy<T extends Record<string, any>>(
  key: string
): TransformFunction<T[], Record<string, T[]>> {
  return (items: T[]) => {
    return items.reduce((groups, item) => {
      const groupKey = String(item[key])
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
      return groups
    }, {} as Record<string, T[]>)
  }
}

export function aggregate<T extends Record<string, any>>(
  groupKey: string,
  aggregations: Record<string, (items: T[]) => any>
): TransformFunction<T[], Array<Record<string, any>>> {
  return (items: T[]) => {
    const grouped = groupBy<T>(groupKey)(items)
    
    return Object.entries(grouped).map(([key, group]) => {
      const result: Record<string, any> = { [groupKey]: key }
      
      Object.entries(aggregations).forEach(([field, aggFn]) => {
        result[field] = aggFn(group)
      })
      
      return result
    })
  }
}

// === SPENDING TRANSFORMATIONS ===

export function normalizeSpendingCategory(entry: SpendingEntry): SpendingEntry {
  const categoryMap: Record<string, string> = {
    'groceries': 'food',
    'restaurants': 'food',
    'dining': 'food',
    'uber': 'transport',
    'taxi': 'transport',
    'train': 'transport',
    'netflix': 'subscriptions',
    'spotify': 'subscriptions',
    'gym': 'subscriptions'
  }
  
  const normalized = categoryMap[entry.category.toLowerCase()] || entry.category
  return { ...entry, category: normalized }
}

export function enrichSpendingData(entry: SpendingEntry): SpendingEntry & {
  dayOfWeek: string
  isWeekend: boolean
  month: string
  quarter: number
} {
  const date = new Date(entry.date)
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  const quarter = Math.floor(date.getMonth() / 3) + 1
  
  return { ...entry, dayOfWeek, isWeekend, month, quarter }
}

export function categorizeSpendingAmount(entry: SpendingEntry): SpendingEntry & {
  amountCategory: 'small' | 'medium' | 'large' | 'very-large'
} {
  let amountCategory: 'small' | 'medium' | 'large' | 'very-large'
  
  if (entry.amount < 10) amountCategory = 'small'
  else if (entry.amount < 50) amountCategory = 'medium'
  else if (entry.amount < 200) amountCategory = 'large'
  else amountCategory = 'very-large'
  
  return { ...entry, amountCategory }
}

// === PORTFOLIO TRANSFORMATIONS ===

export function flattenPortfolioData(data: PortfolioData): Record<string, any> {
  const totalCrypto = data.crypto?.reduce((sum: number, h) => sum + (h.qty * h.price), 0) || 0
  const totalEquity = data.equities?.reduce((sum: number, h) => sum + (h.shares * h.livePrice), 0) || 0
  const totalDebt = (data.creditCards?.reduce((sum, cc) => sum + cc.balance, 0) || 0) +
                    (data.loans?.reduce((sum, l) => sum + l.balance, 0) || 0)
  
  return {
    totalAssets: totalCrypto + totalEquity,
    totalCrypto,
    totalEquity,
    totalDebt,
    netWorth: totalCrypto + totalEquity - totalDebt,
    cryptoCount: data.crypto?.length || 0,
    equityCount: data.equities?.length || 0,
    creditCardCount: data.creditCards?.length || 0,
    loanCount: data.loans?.length || 0,
    goalsCount: data.goals?.length || 0,
    spendingEntriesCount: data.spending?.length || 0
  }
}

// === EXPORT TRANSFORMATIONS ===

export function toCSVRow<T extends Record<string, any>>(
  item: T,
  fields: string[]
): string {
  return fields.map(field => {
    const value = item[field]
    if (value === null || value === undefined) return ''
    
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }).join(',')
}

export function toJSON<T>(item: T, pretty: boolean = false): string {
  return pretty ? JSON.stringify(item, null, 2) : JSON.stringify(item)
}

// === VALIDATION TRANSFORMATIONS ===

export function validateAndClean<T extends Record<string, any>>(
  validators: Record<string, (value: any) => boolean>
): TransformFunction<T, T | null> {
  return (item: T) => {
    const isValid = Object.entries(validators).every(([field, validator]) => {
      return validator(item[field])
    })
    
    return isValid ? item : null
  }
}

export function fillDefaults<T extends Record<string, any>>(
  defaults: Partial<T>
): TransformFunction<T, T> {
  return (item: T) => {
    return { ...defaults, ...item } as T
  }
}

// === BATCH TRANSFORMATIONS ===

export function batchTransform<T, R>(
  items: T[],
  transformer: TransformFunction<T, R>,
  batchSize: number = 100
): R[] {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    results.push(...batch.map(transformer))
  }
  
  return results
}

export async function batchTransformAsync<T, R>(
  items: T[],
  transformer: (item: T) => Promise<R>,
  batchSize: number = 10,
  concurrency: number = 3
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const promises = batch.slice(0, concurrency).map(transformer)
    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  }
  
  return results
}
