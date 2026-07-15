import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Settings2, Trash2, ArrowUpDown } from 'lucide-react'
import { ReorderHandle, ReorderList } from './ui/Reorderable'
import { listIconGlyph } from './TodoListModal'
import type { TodoList } from '../domain/todo-types'

type Props = {
  lists: TodoList[]
  selectedListId: number | null
  counts: Map<number, number>
  totalCount: number
  onSelect: (id: number | null) => void
  onReorder: (next: TodoList[]) => void
  onEdit: (list: TodoList) => void
  onDelete: (list: TodoList) => void
}

/**
 * Vertical list picker — portfolio-select style.
 * Avoids the horizontal chip strip that overflows as lists grow.
 */
export function TodoListPicker({
  lists,
  selectedListId,
  counts,
  totalCount,
  onSelect,
  onReorder,
  onEdit,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [sorting, setSorting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const triggerId = useId()

  const selected = selectedListId != null ? lists.find((l) => l.id === selectedListId) : null
  const selectedCount = selected ? (counts.get(selected.id) ?? 0) : totalCount

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) {
        setOpen(false)
        setSorting(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSorting(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (id: number | null) => {
    onSelect(id)
    if (!sorting) setOpen(false)
  }

  return (
    <div ref={wrapRef} className="todo-list-picker mb-5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[12rem] max-w-md">
          <label htmlFor={triggerId} className="block text-[11px] uppercase tracking-wider text-text-subtle mb-1.5 font-semibold">
            List
          </label>
          <button
            id={triggerId}
            type="button"
            className="todo-list-picker-trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={
              selected
                ? `List: ${selected.name}, ${selectedCount} tasks`
                : `List: All lists, ${selectedCount} tasks`
            }
            onClick={() => {
              setOpen((v) => {
                if (v) setSorting(false)
                return !v
              })
            }}
          >
            <span className="todo-list-picker-trigger-main">
              {selected ? (
                <>
                  <span className="shrink-0" aria-hidden>
                    {listIconGlyph(selected.icon)}
                  </span>
                  <span
                    className="todo-list-picker-swatch shrink-0"
                    style={{ backgroundColor: selected.color || '#F7931A' }}
                    aria-hidden
                  />
                  <span className="truncate font-semibold tracking-wide uppercase text-[11px] sm:text-xs">
                    {selected.name}
                  </span>
                </>
              ) : (
                <span className="truncate font-semibold tracking-wide uppercase text-[11px] sm:text-xs">
                  All lists
                </span>
              )}
              <span className="tabular-nums text-text-subtle shrink-0">({selectedCount})</span>
            </span>
            <ChevronDown
              size={16}
              strokeWidth={2}
              className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        </div>

        {selected ? (
          <div className="flex items-center gap-1 pb-0.5">
            <button
              type="button"
              className="btn-ghost btn-sm p-2 min-h-11 min-w-11"
              title="Edit list"
              aria-label={`Edit list ${selected.name}`}
              onClick={() => onEdit(selected)}
            >
              <Settings2 size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm p-2 min-h-11 min-w-11 text-red-500"
              title="Delete list"
              aria-label={`Delete list ${selected.name}`}
              onClick={() => onDelete(selected)}
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Todo lists"
          className="todo-list-picker-menu"
        >
          <div className="todo-list-picker-menu-head">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
              {sorting ? 'Drag to reorder' : 'Choose a list'}
            </p>
            <button
              type="button"
              className={`btn-ghost btn-sm inline-flex items-center gap-1.5 min-h-11 ${
                sorting ? 'text-accent border border-accent' : ''
              }`}
              aria-pressed={sorting}
              onClick={() => setSorting((v) => !v)}
            >
              <ArrowUpDown size={14} strokeWidth={1.75} />
              {sorting ? 'Done' : 'Sort'}
            </button>
          </div>

          <button
            type="button"
            role="option"
            aria-selected={selectedListId === null}
            className={`todo-list-picker-option ${selectedListId === null ? 'is-active' : ''}`}
            onClick={() => pick(null)}
          >
            <span className="font-semibold uppercase tracking-wide text-[11px]">All lists</span>
            <span className="tabular-nums text-text-subtle ml-auto">({totalCount})</span>
          </button>

          <div className="todo-list-picker-divider" role="separator" />

          {lists.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">No lists yet</p>
          ) : (
            <ReorderList
              items={lists}
              getId={(l) => String(l.id)}
              onReorder={onReorder}
              className="flex flex-col"
            >
              {(list) => {
                const count = counts.get(list.id) ?? 0
                const active = selectedListId === list.id
                return (
                  <div className={`todo-list-picker-row ${active ? 'is-active' : ''}`}>
                    {sorting ? <ReorderHandle label={`Reorder ${list.name}`} /> : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className="todo-list-picker-option flex-1 min-w-0"
                      onClick={() => pick(list.id)}
                    >
                      <span className="shrink-0" aria-hidden>
                        {listIconGlyph(list.icon)}
                      </span>
                      <span
                        className="todo-list-picker-swatch shrink-0"
                        style={{ backgroundColor: list.color || '#F7931A' }}
                        aria-hidden
                      />
                      <span className="truncate font-semibold uppercase tracking-wide text-[11px]">
                        {list.name}
                      </span>
                      <span className="tabular-nums text-text-subtle ml-auto shrink-0">({count})</span>
                    </button>
                  </div>
                )
              }}
            </ReorderList>
          )}
        </div>
      ) : null}
    </div>
  )
}
