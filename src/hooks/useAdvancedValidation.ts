// Advanced Form Validation Integration - UK-specific validators

import type { ValidationRule } from '../utils/formValidation'
import { formatGBP } from '../utils/format'

// === UK-SPECIFIC VALIDATORS ===

// UK National Insurance Number validator
export const ukNationalInsurance = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    // Format: AB123456C
    const niRegex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D\s]$/i
    
    return niRegex.test(value.replace(/\s/g, ''))
  },
  message: message || 'Invalid UK National Insurance number format (e.g., AB123456C)'
})

// UK Sort Code validator
export const ukSortCode = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    // Format: 12-34-56 or 123456
    const sortCodeRegex = /^(\d{2}-\d{2}-\d{2}|\d{6})$/
    
    return sortCodeRegex.test(value)
  },
  message: message || 'Invalid UK sort code format (e.g., 12-34-56)'
})

// UK Account Number validator
export const ukAccountNumber = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    // Must be 8 digits
    return /^\d{8}$/.test(value)
  },
  message: message || 'UK account number must be 8 digits'
})

// UK Postcode validator
export const ukPostcode = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    // UK postcode format
    const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i
    
    return postcodeRegex.test(value)
  },
  message: message || 'Invalid UK postcode format (e.g., SW1A 1AA)'
})

// UK Phone Number validator
export const ukPhoneNumber = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    // UK phone format: +44, 07, or 01/02
    const phoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?[1-2]\d{2}|\(?0[1-2]\d{2}\)?)\s?\d{3}\s?\d{4}$/
    
    return phoneRegex.test(value.replace(/\s/g, ''))
  },
  message: message || 'Invalid UK phone number (e.g., 07123 456789 or +44 7123 456789)'
})

// === FINANCIAL VALIDATORS ===

// Positive amount validator
export const positiveAmount = (message?: string): ValidationRule => ({
  validate: (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    
    return !isNaN(num) && num > 0
  },
  message: message || 'Amount must be greater than zero'
})

// Max amount validator
export const maxAmount = (max: number, message?: string): ValidationRule => ({
  validate: (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    
    return isNaN(num) || num <= max
  },
  message: message || `Amount cannot exceed ${formatGBP(max)}`
})

// Date range validator
export const dateRange = (minDate?: Date, maxDate?: Date, message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    const date = new Date(value)
    
    if (isNaN(date.getTime())) return false
    
    if (minDate && date < minDate) return false
    if (maxDate && date > maxDate) return false
    
    return true
  },
  message: message || 'Date is out of range'
})

// Future date validator
export const futureDate = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    const date = new Date(value)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    return date >= now
  },
  message: message || 'Date must be in the future'
})

// Past date validator
export const pastDate = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    const date = new Date(value)
    const now = new Date()
    
    return date <= now
  },
  message: message || 'Date must be in the past'
})

// === COMPOSITE VALIDATORS ===

// Credit card number validator (basic Luhn algorithm)
export const creditCardNumber = (message?: string): ValidationRule => ({
  validate: (value: string) => {
    if (!value) return true
    
    const digits = value.replace(/\s/g, '')
    
    if (!/^\d{13,19}$/.test(digits)) return false
    
    // Luhn algorithm
    let sum = 0
    let isEven = false
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i])
      
      if (isEven) {
        digit *= 2
        if (digit > 9) {
          digit -= 9
        }
      }
      
      sum += digit
      isEven = !isEven
    }
    
    return sum % 10 === 0
  },
  message: message || 'Invalid credit card number'
})

// Percentage validator
export const percentage = (min: number = 0, max: number = 100, message?: string): ValidationRule => ({
  validate: (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    
    return !isNaN(num) && num >= min && num <= max
  },
  message: message || `Percentage must be between ${min} and ${max}`
})

// === FORM VALIDATION HOOKS ===

// Note: These are example validators. Integrate with actual forms using the validationConfig property
// Example usage:
// const form = useForm({
//   initialValues: { amount: '' },
//   validationConfig: {
//     amount: { rules: [positiveAmount()] }
//   },
//   onSubmit: async (values) => { ... }
// })

// Export all validators for easy reuse
export const validators = {
  // UK-specific
  ukNationalInsurance,
  ukSortCode,
  ukAccountNumber,
  ukPostcode,
  ukPhoneNumber,
  
  // Financial
  positiveAmount,
  maxAmount,
  dateRange,
  futureDate,
  pastDate,
  creditCardNumber,
  percentage
}
