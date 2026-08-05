import { useState } from 'react'
import type { TodoList } from '../domain/todo-types'
import { createTodoList } from '../domain/todos'
import { Modal } from './ui/Modal'

const LIST_COLORS = [
  { value: '#F7931A', label: 'Accent' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#22C55E', label: 'Green' },
  { value: '#EF4444', label: 'Red' },
  { value: '#A855F7', label: 'Purple' },
  { value: '#64748B', label: 'Slate' },
]

const LIST_ICON_OPTIONS = [
  { value: 'list', glyph: '📋', label: 'List' },
  { value: 'finance', glyph: '💷', label: 'Finance' },
  { value: 'work', glyph: '💼', label: 'Work' },
  { value: 'home', glyph: '🏠', label: 'Home' },
  { value: 'health', glyph: '❤️', label: 'Health' },
  { value: 'career', glyph: '🎯', label: 'Career' },
]

export function listIconGlyph(icon?: string): string {
  if (!icon) return '📋'
  const match = LIST_ICON_OPTIONS.find((o) => o.value === icon)
  if (match) return match.glyph
  return icon.length <= 2 ? icon : '📋'
}

interface TodoListModalProps {
  list?: TodoList
  onSave: (list: TodoList) => void
  onClose: () => void
}

export function TodoListModal({ list, onSave, onClose }: TodoListModalProps) {
  const [formData, setFormData] = useState({
    name: list?.name || '',
    description: list?.description || '',
    color: list?.color || LIST_COLORS[0].value,
    icon: list?.icon || 'list',
    shared: list?.shared || false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const next = list
      ? {
          ...list,
          ...formData,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          shared: formData.shared,
          updatedAt: new Date().toISOString(),
        }
      : createTodoList({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
          icon: formData.icon,
          shared: formData.shared,
        })

    onSave(next)
  }

  return (
    <Modal open title={list ? 'Edit List' : 'New List'} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h3 className="font-bold mb-3">List Details</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">List Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm min-h-11"
                  placeholder="e.g. Finance, Personal, Career"
                />
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm min-h-[80px]"
                  placeholder="Optional notes about this list"
                />
              </div>
              <label
                className="flex items-start gap-3 rounded border border-border bg-surface-hover p-3 text-sm"
                data-testid="todos-list-share-hint"
              >
                <input
                  type="checkbox"
                  checked={formData.shared}
                  onChange={(e) => setFormData({ ...formData, shared: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold">Household (local)</span>
                  <span className="block text-xs text-text-subtle mt-0.5">
                    Marks this list as shared for your household; it syncs through workspace cloud sync, not a multi-user backend.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-3">Appearance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-subtle mb-1">Colour</label>
                <div className="flex flex-wrap gap-2">
                  {LIST_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      className={`w-8 h-8 rounded border-2 ${
                        formData.color === c.value ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                      aria-label={c.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-subtle mb-1">Icon</label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
                >
                  {LIST_ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.glyph} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 min-h-11">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 min-h-11" disabled={!formData.name.trim()}>
              {list ? 'Save Changes' : 'Create List'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
