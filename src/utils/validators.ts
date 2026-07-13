// Comprehensive validation utilities for all data types

export interface ValidationResult {
  valid: boolean
  error?: string
  sanitized?: any
}

export interface ValidationRule<T = any> {
  validator: (value: T) => boolean
  message: string
}

// === NUMBER VALIDATION ===

export function validateNumber(
  value: any,
  options: {
    min?: number
    max?: number
    allowZero?: boolean
    allowNegative?: boolean
    decimals?: number
  } = {}
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value
  
  if (isNaN(num) || num === null || num === undefined) {
    return { valid: false, error: 'Must be a valid number' }
  }
  
  if (!options.allowZero && num === 0) {
    return { valid: false, error: 'Cannot be zero' }
  }
  
  if (!options.allowNegative && num < 0) {
    return { valid: false, error: 'Cannot be negative' }
  }
  
  if (options.min !== undefined && num < options.min) {
    return { valid: false, error: `Must be at least ${options.min}` }
  }
  
  if (options.max !== undefined && num > options.max) {
    return { valid: false, error: `Must be at most ${options.max}` }
  }
  
  if (options.decimals !== undefined) {
    const decimals = (num.toString().split('.')[1] || '').length
    if (decimals > options.decimals) {
      return { valid: false, error: `Maximum ${options.decimals} decimal places` }
    }
  }
  
  return { valid: true, sanitized: num }
}

export function validatePercentage(value: any): ValidationResult {
  return validateNumber(value, { min: 0, max: 100, allowZero: true })
}

export function validateCurrency(value: any): ValidationResult {
  const result = validateNumber(value, { allowNegative: false, decimals: 2 })
  if (result.valid) {
    return { valid: true, sanitized: Math.round(result.sanitized! * 100) / 100 }
  }
  return result
}

// === DATE VALIDATION ===

export function validateDate(
  value: any,
  options: {
    min?: Date | string
    max?: Date | string
    allowFuture?: boolean
    allowPast?: boolean
  } = {}
): ValidationResult {
  const date = typeof value === 'string' ? new Date(value) : value
  
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { valid: false, error: 'Must be a valid date' }
  }
  
  const now = new Date()
  
  if (!options.allowFuture && date > now) {
    return { valid: false, error: 'Cannot be in the future' }
  }
  
  if (!options.allowPast && date < now) {
    return { valid: false, error: 'Cannot be in the past' }
  }
  
  if (options.min) {
    const minDate = new Date(options.min)
    if (date < minDate) {
      return { valid: false, error: `Must be on or after ${minDate.toLocaleDateString()}` }
    }
  }
  
  if (options.max) {
    const maxDate = new Date(options.max)
    if (date > maxDate) {
      return { valid: false, error: `Must be on or before ${maxDate.toLocaleDateString()}` }
    }
  }
  
  return { valid: true, sanitized: date.toISOString().split('T')[0] }
}

export function validateDateRange(start: any, end: any): ValidationResult {
  const startResult = validateDate(start)
  if (!startResult.valid) return startResult
  
  const endResult = validateDate(end)
  if (!endResult.valid) return endResult
  
  const startDate = new Date(startResult.sanitized!)
  const endDate = new Date(endResult.sanitized!)
  
  if (startDate >= endDate) {
    return { valid: false, error: 'End date must be after start date' }
  }
  
  return { valid: true, sanitized: { start: startResult.sanitized, end: endResult.sanitized } }
}

// === STRING VALIDATION ===

export function validateString(
  value: any,
  options: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    trim?: boolean
    required?: boolean
  } = {}
): ValidationResult {
  let str = typeof value === 'string' ? value : String(value)
  
  if (options.trim) {
    str = str.trim()
  }
  
  if (options.required && !str) {
    return { valid: false, error: 'This field is required' }
  }
  
  if (options.minLength !== undefined && str.length < options.minLength) {
    return { valid: false, error: `Must be at least ${options.minLength} characters` }
  }
  
  if (options.maxLength !== undefined && str.length > options.maxLength) {
    return { valid: false, error: `Must be at most ${options.maxLength} characters` }
  }
  
  if (options.pattern && !options.pattern.test(str)) {
    return { valid: false, error: 'Invalid format' }
  }
  
  return { valid: true, sanitized: str }
}

export function validateEmail(email: string): ValidationResult {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return validateString(email, {
    pattern: emailPattern,
    trim: true,
    required: true,
  })
}

export function validateURL(url: string): ValidationResult {
  try {
    new URL(url)
    return { valid: true, sanitized: url }
  } catch {
    return { valid: false, error: 'Must be a valid URL' }
  }
}

// === CRYPTO/EQUITY VALIDATION ===

export function validateTickerSymbol(symbol: string): ValidationResult {
  return validateString(symbol, {
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Z0-9]+$/,
    trim: true,
    required: true,
  })
}

export function validateQuantity(qty: any): ValidationResult {
  return validateNumber(qty, {
    min: 0.00000001,
    allowZero: false,
    allowNegative: false,
    decimals: 8,
  })
}

// === TRANSACTION VALIDATION ===

export function validateTransaction(transaction: {
  date?: string
  description?: string
  amount?: number
  category?: string
}): ValidationResult {
  // Date
  const dateResult = validateDate(transaction.date, { allowFuture: false })
  if (!dateResult.valid) {
    return { valid: false, error: `Date: ${dateResult.error}` }
  }
  
  // Description
  const descResult = validateString(transaction.description, {
    minLength: 1,
    maxLength: 200,
    trim: true,
    required: true,
  })
  if (!descResult.valid) {
    return { valid: false, error: `Description: ${descResult.error}` }
  }
  
  // Amount
  const amountResult = validateCurrency(transaction.amount)
  if (!amountResult.valid) {
    return { valid: false, error: `Amount: ${amountResult.error}` }
  }
  
  // Category
  const categoryResult = validateString(transaction.category, {
    minLength: 1,
    maxLength: 50,
    trim: true,
    required: true,
  })
  if (!categoryResult.valid) {
    return { valid: false, error: `Category: ${categoryResult.error}` }
  }
  
  return {
    valid: true,
    sanitized: {
      date: dateResult.sanitized,
      description: descResult.sanitized,
      amount: amountResult.sanitized,
      category: categoryResult.sanitized,
    },
  }
}

// === GOAL VALIDATION ===

export function validateGoal(goal: {
  name?: string
  target?: number
  deadline?: string
}): ValidationResult {
  const nameResult = validateString(goal.name, {
    minLength: 1,
    maxLength: 100,
    trim: true,
    required: true,
  })
  if (!nameResult.valid) {
    return { valid: false, error: `Name: ${nameResult.error}` }
  }
  
  const targetResult = validateCurrency(goal.target)
  if (!targetResult.valid) {
    return { valid: false, error: `Target: ${targetResult.error}` }
  }
  
  const deadlineResult = validateDate(goal.deadline, { allowFuture: true, allowPast: false })
  if (!deadlineResult.valid) {
    return { valid: false, error: `Deadline: ${deadlineResult.error}` }
  }
  
  return {
    valid: true,
    sanitized: {
      name: nameResult.sanitized,
      target: targetResult.sanitized,
      deadline: deadlineResult.sanitized,
    },
  }
}

// === BUDGET VALIDATION ===

export function validateBudget(budget: {
  category?: string
  limit?: number
  period?: 'monthly' | 'yearly'
}): ValidationResult {
  const categoryResult = validateString(budget.category, {
    minLength: 1,
    maxLength: 50,
    trim: true,
    required: true,
  })
  if (!categoryResult.valid) {
    return { valid: false, error: `Category: ${categoryResult.error}` }
  }
  
  const limitResult = validateCurrency(budget.limit)
  if (!limitResult.valid) {
    return { valid: false, error: `Limit: ${limitResult.error}` }
  }
  
  if (!budget.period || !['monthly', 'yearly'].includes(budget.period)) {
    return { valid: false, error: 'Period must be monthly or yearly' }
  }
  
  return {
    valid: true,
    sanitized: {
      category: categoryResult.sanitized,
      limit: limitResult.sanitized,
      period: budget.period,
    },
  }
}

// === BATCH VALIDATION ===

export function validateBatch<T>(
  items: T[],
  validator: (item: T) => ValidationResult
): { valid: boolean; errors: Array<{ index: number; error: string }>; validItems: T[] } {
  const errors: Array<{ index: number; error: string }> = []
  const validItems: T[] = []
  
  items.forEach((item, index) => {
    const result = validator(item)
    if (result.valid) {
      validItems.push(result.sanitized ?? item)
    } else {
      errors.push({ index, error: result.error! })
    }
  })
  
  return {
    valid: errors.length === 0,
    errors,
    validItems,
  }
}

// === SANITIZATION ===

export function sanitizeHTML(html: string): string {
  const div = document.createElement('div')
  div.textContent = html
  return div.innerHTML
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255)
}

export function sanitizeCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

// === COMPOSITE VALIDATORS ===

export function createValidator<T>(
  rules: Array<ValidationRule<T>>
): (value: T) => ValidationResult {
  return (value: T) => {
    for (const rule of rules) {
      if (!rule.validator(value)) {
        return { valid: false, error: rule.message }
      }
    }
    return { valid: true }
  }
}

// === ERROR HANDLING ===

export class ValidationError extends Error {
  field: string
  value: any
  
  constructor(field: string, value: any, message: string) {
    super(`Validation error in ${field}: ${message}`)
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

export function assertValid(result: ValidationResult, field: string, value: any): void {
  if (!result.valid) {
    throw new ValidationError(field, value, result.error!)
  }
}
