import { useEffect, useCallback, useRef, cloneElement } from 'react'

// Skip to main content link
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}

// Announce to screen readers
export function useScreenReaderAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('sr-announcer')
    if (announcer) {
      announcer.setAttribute('aria-live', priority)
      announcer.textContent = message
      
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = ''
      }, 1000)
    }
  }, [])

  return { announce }
}

// Screen reader announcer component
export function ScreenReaderAnnouncer() {
  return (
    <div
      id="sr-announcer"
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    />
  )
}

// Focus management
export function useFocusTrap(isActive: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleTab)
    }
  }, [isActive, containerRef])
}

// Keyboard navigation hook
export function useKeyboardNavigation(options: {
  onArrowUp?: () => void
  onArrowDown?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onEnter?: () => void
  onEscape?: () => void
  onHome?: () => void
  onEnd?: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          options.onArrowUp?.()
          e.preventDefault()
          break
        case 'ArrowDown':
          options.onArrowDown?.()
          e.preventDefault()
          break
        case 'ArrowLeft':
          options.onArrowLeft?.()
          break
        case 'ArrowRight':
          options.onArrowRight?.()
          break
        case 'Enter':
          options.onEnter?.()
          break
        case 'Escape':
          options.onEscape?.()
          break
        case 'Home':
          options.onHome?.()
          e.preventDefault()
          break
        case 'End':
          options.onEnd?.()
          e.preventDefault()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [options])
}

// Accessible button component
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  loading?: boolean
  loadingText?: string
}

export function AccessibleButton({ 
  children, 
  loading, 
  loadingText = 'Loading...', 
  disabled,
  ...props 
}: AccessibleButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
    >
      {loading ? (
        <>
          <span className="sr-only">{loadingText}</span>
          <span aria-hidden="true">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

// Accessible link component
interface AccessibleLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode
  external?: boolean
}

export function AccessibleLink({ children, external, ...props }: AccessibleLinkProps) {
  return (
    <a
      {...props}
      {...(external && {
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': `${typeof children === 'string' ? children : ''} (opens in new tab)`,
      })}
    >
      {children}
      {external && <span className="sr-only"> (opens in new tab)</span>}
    </a>
  )
}

// Accessible form field
interface AccessibleFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactElement
}

export function AccessibleField({ 
  id, 
  label, 
  error, 
  hint, 
  required, 
  children 
}: AccessibleFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>
      
      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      
      {cloneElement(children, {
        id,
        'aria-required': required,
        'aria-invalid': !!error,
        'aria-describedby': [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined,
      } as any)}
      
      {error && (
        <p id={errorId} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Accessible modal
interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function AccessibleModal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children 
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  
  useFocusTrap(isOpen, modalRef as React.RefObject<HTMLElement>)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
    >
      <div
        ref={modalRef}
        className="surface rounded-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="modal-title" className="text-xl font-bold">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="text-sm text-text-muted mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost btn-sm"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Color contrast utilities
export function getContrastRatio(_foreground: string, _background: string): number {
  // Simplified contrast calculation
  // For production, use a proper color contrast library
  return 4.5 // Placeholder
}

export function isAccessibleContrast(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(foreground, background)
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7
}

// Live region component
interface LiveRegionProps {
  children: React.ReactNode
  priority?: 'polite' | 'assertive'
  atomic?: boolean
}

export function LiveRegion({ children, priority = 'polite', atomic = true }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic={atomic}
      className="sr-only"
    >
      {children}
    </div>
  )
}
