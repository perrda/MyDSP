import { useState } from 'react'
import { X } from 'lucide-react'
import type { TodoList } from '../domain/todo-types'
import { createTodoList } from '../domain/todos'

const LIST_COLORS = [
  { value: '#F7931A', label: 'Accent' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#22C55E', label: 'Green' },
  { value: '#EF4444', label: 'Red' },
  { value: '#A855F7', label: 'Purple' },
  { value: '#64748B', label: 'Slate' },
]

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
          updatedAt: new Date().toISOString(),
        }
      : createTodoList({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
          icon: formData.icon,
        })

    onSave(next)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="surface rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="sticky top-0 surface border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{list ? 'Edit List' : 'New List'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded text-sm"
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
                  <option value="list">List</option>
                  <option value="finance">Finance</option>
                  <option value="work">Work</option>
                  <option value="home">Home</option>
                  <option value="health">Health</option>
                  <option value="career">Career</option>
                </select>
              </div>
            </div>
          </section>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!formData.name.trim()}>
              {list ? 'Save Changes' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
