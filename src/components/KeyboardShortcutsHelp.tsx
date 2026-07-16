/** Web keyboard shortcuts cheat-sheet (? or Shift+/). Hidden on coarse-pointer phones. */

import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'

const ROWS: { keys: string; action: string }[] = [
  { keys: '⌘K / Ctrl+K', action: 'Open global search' },
  { keys: '? or Shift+/', action: 'Show this shortcuts list' },
  { keys: 'Esc', action: 'Close dialogs, menus, and search' },
  { keys: '↑ ↓ Enter', action: 'Move and open search results' },
]

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(min-width: 1024px)').matches
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isCoarsePointer()) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (isCoarsePointer()) return null

  return (
    <Modal open={open} title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <ul className="space-y-3">
        {ROWS.map((row) => (
          <li key={row.keys} className="flex items-start justify-between gap-4 text-sm">
            <kbd className="shrink-0 px-2 py-1 text-[11px] font-semibold tracking-wide border border-border-strong bg-surface text-text">
              {row.keys}
            </kbd>
            <span className="text-text-muted text-right leading-snug">{row.action}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] text-text-subtle leading-relaxed">
        Shortcuts are for web / desktop. On iPhone and iPad, use Search from the toolbar and pull to
        sync.
      </p>
    </Modal>
  )
}
