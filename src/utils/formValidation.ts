// Form validation library with React hooks

import { useState, useCallback, useEffect } from 'react'

// === TYPES ===

export type ValidationRule<T = any> = {
  validate: (value: T, allValues?: Record<string, any>) => boolean | Promise<boolean>
  message: string
}

export type FieldValidation = {
  rules: ValidationRule[]
  validateOnChange?: boolean
  validateOnBlur?: boolean
}

export type FormConfig<T extends Record<string, any>> = {
  [K in keyof T]?: FieldValidation
}

export type FieldError = {
  field: string
  message: string
}

export type FormState<T extends Record<string, any>> = {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isValidating: boolean
  isSubmitting: boolean
  isDirty: boolean
  isValid: boolean
}

// === BUILT-IN VALIDATORS ===

export const required = (message = 'This field is required'): ValidationRule => ({
  validate: (value) => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    return true
  },
  message,
})

export const email = (message = 'Invalid email address'): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
  },
  message,
})

export const minLength = (min: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    return String(value).length >= min
  },
  message: message || `Minimum length is ${min}`,
})

export const maxLength = (max: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    return String(value).length <= max
  },
  message: message || `Maximum length is ${max}`,
})

export const min = (minValue: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (value === null || value === undefined || value === '') return true
    return Number(value) >= minValue
  },
  message: message || `Minimum value is ${minValue}`,
})

export const max = (maxValue: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (value === null || value === undefined || value === '') return true
    return Number(value) <= maxValue
  },
  message: message || `Maximum value is ${maxValue}`,
})

export const pattern = (regex: RegExp, message = 'Invalid format'): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    return regex.test(String(value))
  },
  message,
})

export const url = (message = 'Invalid URL'): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    try {
      new URL(String(value))
      return true
    } catch {
      return false
    }
  },
  message,
})

export const matches = (fieldName: string, message?: string): ValidationRule => ({
  validate: (value, allValues) => {
    if (!value || !allValues) return true
    return value === allValues[fieldName]
  },
  message: message || `Must match ${fieldName}`,
})

export const oneOf = (values: any[], message?: string): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    return values.includes(value)
  },
  message: message || `Must be one of: ${values.join(', ')}`,
})

export const custom = (validator: (value: any, allValues?: Record<string, any>) => boolean | Promise<boolean>, message: string): ValidationRule => ({
  validate: validator,
  message,
})

// UK specific validators
export const ukPostcode = (message = 'Invalid UK postcode'): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
    return postcodeRegex.test(String(value).trim())
  },
  message,
})

export const ukPhone = (message = 'Invalid UK phone number'): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    const phoneRegex = /^(?:(?:\+44\s?|0)(?:\d\s?){9,10})$/
    return phoneRegex.test(String(value).replace(/\s/g, ''))
  },
  message,
})

export const niNumber = (message = 'Invalid NI number'): ValidationRule => ({
  validate: (value) => {
    if (!value) return true
    const niRegex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D\s]$/i
    return niRegex.test(String(value).replace(/\s/g, ''))
  },
  message,
})

// === FORM HOOK ===

export interface UseFormOptions<T extends Record<string, any>> {
  initialValues: T
  validationConfig?: FormConfig<T>
  onSubmit: (values: T) => void | Promise<void>
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateOnMount?: boolean
}

export interface UseFormReturn<T extends Record<string, any>> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isValidating: boolean
  isSubmitting: boolean
  isDirty: boolean
  isValid: boolean
  
  handleChange: (field: keyof T) => (value: any) => void
  handleBlur: (field: keyof T) => () => void
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  setFieldValue: (field: keyof T, value: any) => void
  setFieldError: (field: keyof T, error: string) => void
  setFieldTouched: (field: keyof T, touched: boolean) => void
  validateField: (field: keyof T) => Promise<boolean>
  validateForm: () => Promise<boolean>
  resetForm: () => void
  getFieldProps: (field: keyof T) => {
    value: any
    onChange: (e: any) => void
    onBlur: () => void
    error: string | undefined
    touched: boolean | undefined
  }
}

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(options.initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isValidating, setIsValidating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = JSON.stringify(values) !== JSON.stringify(options.initialValues)
  const isValid = Object.keys(errors).length === 0

  // Validate single field
  const validateField = useCallback(
    async (field: keyof T): Promise<boolean> => {
      const fieldConfig = options.validationConfig?.[field]
      if (!fieldConfig) return true

      const value = values[field]
      
      for (const rule of fieldConfig.rules) {
        const isValid = await rule.validate(value, values)
        if (!isValid) {
          setErrors(prev => ({ ...prev, [field]: rule.message }))
          return false
        }
      }

      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      return true
    },
    [values, options.validationConfig]
  )

  // Validate entire form
  const validateForm = useCallback(async (): Promise<boolean> => {
    if (!options.validationConfig) return true

    setIsValidating(true)
    const newErrors: Partial<Record<keyof T, string>> = {}

    for (const field in options.validationConfig) {
      const fieldConfig = options.validationConfig[field]
      if (!fieldConfig) continue
      
      const value = values[field]

      for (const rule of fieldConfig.rules) {
        const isValid = await rule.validate(value, values)
        if (!isValid) {
          newErrors[field] = rule.message
          break
        }
      }
    }

    setErrors(newErrors)
    setIsValidating(false)
    return Object.keys(newErrors).length === 0
  }, [values, options.validationConfig])

  // Handle change
  const handleChange = useCallback(
    (field: keyof T) => (value: any) => {
      setValues(prev => ({ ...prev, [field]: value }))

      const shouldValidate = 
        options.validateOnChange ?? 
        options.validationConfig?.[field]?.validateOnChange ?? 
        false

      if (shouldValidate) {
        validateField(field)
      }
    },
    [options.validateOnChange, options.validationConfig, validateField]
  )

  // Handle blur
  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setTouched(prev => ({ ...prev, [field]: true }))

      const shouldValidate = 
        options.validateOnBlur ?? 
        options.validationConfig?.[field]?.validateOnBlur ?? 
        true

      if (shouldValidate) {
        validateField(field)
      }
    },
    [options.validateOnBlur, options.validationConfig, validateField]
  )

  // Handle submit
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      setIsSubmitting(true)
      const isValid = await validateForm()

      if (isValid) {
        try {
          await options.onSubmit(values)
        } catch (error) {
          console.error('Form submission error:', error)
        }
      } else {
        // Mark all fields as touched to show errors
        const allTouched = Object.keys(options.validationConfig || {}).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {}
        )
        setTouched(allTouched)
      }

      setIsSubmitting(false)
    },
    [values, options, validateForm]
  )

  // Setters
  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
  }, [])

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }))
  }, [])

  const setFieldTouched = useCallback((field: keyof T, isTouched: boolean) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }))
  }, [])

  const resetForm = useCallback(() => {
    setValues(options.initialValues)
    setErrors({})
    setTouched({})
  }, [options.initialValues])

  // Get field props helper
  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: values[field],
      onChange: (e: any) => {
        const value = e.target ? e.target.value : e
        handleChange(field)(value)
      },
      onBlur: handleBlur(field),
      error: errors[field],
      touched: touched[field],
    }),
    [values, errors, touched, handleChange, handleBlur]
  )

  // Validate on mount if requested
  useEffect(() => {
    if (options.validateOnMount) {
      validateForm()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    values,
    errors,
    touched,
    isValidating,
    isSubmitting,
    isDirty,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    validateField,
    validateForm,
    resetForm,
    getFieldProps,
  }
}

// === EXAMPLE USAGE ===

/*
interface LoginForm {
  email: string
  password: string
  rememberMe: boolean
}

function LoginComponent() {
  const form = useForm<LoginForm>({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validationConfig: {
      email: {
        rules: [required(), email()],
        validateOnBlur: true,
      },
      password: {
        rules: [required(), minLength(8, 'Password must be at least 8 characters')],
        validateOnBlur: true,
      },
    },
    onSubmit: async (values) => {
      console.log('Submitting:', values)
      // API call here
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <div>
        <input
          type="email"
          {...form.getFieldProps('email')}
        />
        {form.touched.email && form.errors.email && (
          <span>{form.errors.email}</span>
        )}
      </div>

      <div>
        <input
          type="password"
          value={form.values.password}
          onChange={(e) => form.handleChange('password')(e.target.value)}
          onBlur={form.handleBlur('password')}
        />
        {form.touched.password && form.errors.password && (
          <span>{form.errors.password}</span>
        )}
      </div>

      <button type="submit" disabled={form.isSubmitting || !form.isValid}>
        {form.isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}
*/
