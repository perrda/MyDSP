import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command, X } from 'lucide-react'

interface Shortcut {
  key: string
  description: string
  action: () => void
  modifier?: 'ctrl' | 'cmd' | 'shift' | 'alt'
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modifierMatch =
          !shortcut.modifier ||
          (shortcut.modifier === 'ctrl' && e.ctrlKey) ||
          (shortcut.modifier === 'cmd' && e.metaKey) ||
          (shortcut.modifier === 'shift' && e.shiftKey) ||
          (shortcut.modifier === 'alt' && e.altKey)

        if (modifierMatch && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const shortcuts = [
    { key: '⌘/Ctrl + K', description: 'Open search' },
    { key: '⌘/Ctrl + /', description: 'Show keyboard shortcuts' },
    { key: 'G then D', description: 'Go to Dashboard' },
    { key: 'G then C', description: 'Go to Crypto' },
    { key: 'G then E', description: 'Go to Equities' },
    { key: 'G then L', description: 'Go to Liabilities' },
    { key: 'G then G', description: 'Go to Goals' },
    { key: 'G then S', description: 'Go to Settings' },
    { key: 'ESC', description: 'Close modals/search' },
    { key: '?', description: 'Show this help' },
  ]

  // Toggle help with ?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Vim-style navigation (G then X)
  useEffect(() => {
    let gPressed = false
    let timeout: ReturnType<typeof setTimeout>

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        gPressed = true
        timeout = setTimeout(() => {
          gPressed = false
        }, 1000)
        return
      }

      if (gPressed) {
        gPressed = false
        clearTimeout(timeout)

        const routes: Record<string, string> = {
          d: '/',
          c: '/crypto',
          e: '/equities',
          l: '/liabilities',
          g: '/goals',
          s: '/settings',
          b: '/budgets',
          t: '/tax',
        }

        const path = routes[e.key.toLowerCase()]
        if (path) {
          e.preventDefault()
          navigate(path)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timeout)
    }
  }, [navigate])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Help Dialog */}
      <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
        <div className="surface w-full max-w-2xl border border-border-strong shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Command className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-text-subtle hover:text-text transition-colors p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shortcuts List */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between gap-4 p-3 surface-nested"
                >
                  <span className="text-sm text-text-muted">{shortcut.description}</span>
                  <kbd className="px-3 py-1 bg-surface-hover border border-border text-xs font-mono whitespace-nowrap">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 border border-border-strong bg-surface-nested">
              <p className="text-xs text-text-subtle">
                <strong>Tip:</strong> Press <kbd className="px-2 py-1 bg-surface-hover border border-border text-xs">?</kbd> 
                {' '}or{' '}
                <kbd className="px-2 py-1 bg-surface-hover border border-border text-xs">⌘/</kbd> 
                {' '}anytime to toggle this help menu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
