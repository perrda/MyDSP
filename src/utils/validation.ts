/** Input validation and sanitization utilities */

export interface ValidationResult {
  valid: boolean
  error?: string
  sanitized?: unknown
}

/**
 * Validate and sanitize a number input
 */
export function validateNumber(
  value: unknown,
  opts?: {
    min?: number
    max?: number
    allowNegative?: boolean
    required?: boolean
  },
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    if (opts?.required) {
      return { valid: false, error: 'This field is required' }
    }
    return { valid: true, sanitized: 0 }
  }

  const num = typeof value === 'string' ? parseFloat(value) : Number(value)

  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Please enter a valid number' }
  }

  if (!opts?.allowNegative && num < 0) {
    return { valid: false, error: 'Value cannot be negative' }
  }

  if (opts?.min !== undefined && num < opts.min) {
    return { valid: false, error: `Value must be at least ${opts.min}` }
  }

  if (opts?.max !== undefined && num > opts.max) {
    return { valid: false, error: `Value cannot exceed ${opts.max}` }
  }

  return { valid: true, sanitized: num }
}

/**
 * Validate and sanitize a string input
 */
export function validateString(
  value: unknown,
  opts?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    required?: boolean
    trim?: boolean
  },
): ValidationResult {
  if (value === null || value === undefined) {
    if (opts?.required) {
      return { valid: false, error: 'This field is required' }
    }
    return { valid: true, sanitized: '' }
  }

  let str = String(value)
  if (opts?.trim !== false) {
    str = str.trim()
  }

  if (opts?.required && str === '') {
    return { valid: false, error: 'This field is required' }
  }

  if (opts?.minLength !== undefined && str.length < opts.minLength) {
    return { valid: false, error: `Must be at least ${opts.minLength} characters` }
  }

  if (opts?.maxLength !== undefined && str.length > opts.maxLength) {
    return { valid: false, error: `Cannot exceed ${opts.maxLength} characters` }
  }

  if (opts?.pattern && !opts.pattern.test(str)) {
    return { valid: false, error: 'Invalid format' }
  }

  return { valid: true, sanitized: str }
}

/**
 * Validate a date string (YYYY-MM-DD format)
 */
export function validateDate(
  value: unknown,
  opts?: {
    required?: boolean
    minDate?: string
    maxDate?: string
    futureOnly?: boolean
    pastOnly?: boolean
  },
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    if (opts?.required) {
      return { valid: false, error: 'Date is required' }
    }
    return { valid: true, sanitized: '' }
  }

  const str = String(value).trim()
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

  if (!ISO_DATE.test(str)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' }
  }

  const date = new Date(str)
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (opts?.futureOnly && date < today) {
    return { valid: false, error: 'Date must be in the future' }
  }

  if (opts?.pastOnly && date > today) {
    return { valid: false, error: 'Date cannot be in the future' }
  }

  if (opts?.minDate && str < opts.minDate) {
    return { valid: false, error: `Date cannot be before ${opts.minDate}` }
  }

  if (opts?.maxDate && str > opts.maxDate) {
    return { valid: false, error: `Date cannot be after ${opts.maxDate}` }
  }

  return { valid: true, sanitized: str }
}

/**
 * Validate a symbol/ticker (uppercase alphanumeric, common patterns)
 */
export function validateSymbol(value: unknown, required = false): ValidationResult {
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { valid: false, error: 'Symbol is required' }
    }
    return { valid: true, sanitized: '' }
  }

  const str = String(value).trim().toUpperCase()

  // Allow: BTC, TSLA, VOD.L, BTC-USD, etc
  const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,20}$/

  if (!SYMBOL_PATTERN.test(str)) {
    return { valid: false, error: 'Symbol must be uppercase letters, numbers, dots, or hyphens' }
  }

  return { valid: true, sanitized: str }
}

/**
 * Validate an email address
 */
export function validateEmail(value: unknown, required = false): ValidationResult {
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { valid: false, error: 'Email is required' }
    }
    return { valid: true, sanitized: '' }
  }

  const str = String(value).trim().toLowerCase()
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!EMAIL_PATTERN.test(str)) {
    return { valid: false, error: 'Please enter a valid email address' }
  }

  return { valid: true, sanitized: str }
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  
  const str = String(value)
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/**
 * Validate a percentage (0-100)
 */
export function validatePercentage(value: unknown, required = false): ValidationResult {
  const numResult = validateNumber(value, {
    min: 0,
    max: 100,
    required,
    allowNegative: false,
  })

  if (!numResult.valid) {
    return { ...numResult, error: 'Percentage must be between 0 and 100' }
  }

  return numResult
}

/**
 * Batch validate multiple fields
 */
export function validateFields(
  fields: Record<string, { value: unknown; validator: (v: unknown) => ValidationResult }>,
): { valid: boolean; errors: Record<string, string>; sanitized: Record<string, unknown> } {
  const errors: Record<string, string> = {}
  const sanitized: Record<string, unknown> = {}
  let valid = true

  for (const [key, { value, validator }] of Object.entries(fields)) {
    const result = validator(value)
    if (!result.valid) {
      valid = false
      if (result.error) errors[key] = result.error
    } else {
      sanitized[key] = result.sanitized
    }
  }

  return { valid, errors, sanitized }
}
