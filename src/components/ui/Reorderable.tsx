import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { GripVertical } from 'lucide-react'
import { moveIndex } from '../../utils/reorder'

interface ReorderContextValue {
  listId: string
  draggingId: string | null
  overId: string | null
  onHandlePointerDown: (id: string, e: ReactPointerEvent) => void
}

const ReorderContext = createContext<ReorderContextValue | null>(null)

interface ReorderListProps<T> {
  items: T[]
  getId: (item: T) => string
  onReorder: (next: T[]) => void
  children: (item: T, index: number) => ReactNode
  className?: string
  itemClassName?: string | ((item: T, index: number) => string)
}

/**
 * Pointer-based reorder (mouse + touch). Drag only from ReorderHandle
 * so NavLinks / buttons still click normally.
 */
export function ReorderList<T>({
  items,
  getId,
  onReorder,
  children,
  className = '',
  itemClassName,
}: ReorderListProps<T>) {
  const listId = useId()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const getIdRef = useRef(getId)
  getIdRef.current = getId
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const dragIdRef = useRef<string | null>(null)
  const overIdRef = useRef<string | null>(null)
  const movedRef = useRef(false)

  const finish = useCallback(() => {
    const dragId = dragIdRef.current
    const dropId = overIdRef.current
    dragIdRef.current = null
    overIdRef.current = null
    setDraggingId(null)
    setOverId(null)

    if (!dragId || !dropId || dragId === dropId || !movedRef.current) {
      movedRef.current = false
      return
    }
    movedRef.current = false
    const list = itemsRef.current
    const idOf = getIdRef.current
    const from = list.findIndex((item) => idOf(item) === dragId)
    const to = list.findIndex((item) => idOf(item) === dropId)
    if (from < 0 || to < 0 || from === to) return
    onReorderRef.current(moveIndex(list, from, to))
  }, [])

  const onHandlePointerDown = useCallback(
    (id: string, e: ReactPointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      dragIdRef.current = id
      overIdRef.current = id
      movedRef.current = false
      setDraggingId(id)
      setOverId(id)

      const onMove = (ev: PointerEvent) => {
        if (dragIdRef.current !== id) return
        const dx = Math.abs(ev.clientX - e.clientX)
        const dy = Math.abs(ev.clientY - e.clientY)
        if (dx + dy > 4) movedRef.current = true
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        const row = el?.closest<HTMLElement>(`[data-reorder-list="${listId}"][data-reorder-id]`)
        const nextOver = row?.dataset.reorderId ?? null
        if (nextOver && nextOver !== overIdRef.current) {
          overIdRef.current = nextOver
          setOverId(nextOver)
        }
      }

      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId)
        } catch {
          /* already released */
        }
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
        finish()
      }

      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    },
    [finish, listId],
  )

  const value = useMemo(
    () => ({ listId, draggingId, overId, onHandlePointerDown }),
    [listId, draggingId, overId, onHandlePointerDown],
  )

  return (
    <ReorderContext.Provider value={value}>
      <div className={className} role="list">
        {items.map((item, index) => {
          const id = getId(item)
          const dragging = draggingId === id
          const over = overId === id && draggingId != null && draggingId !== id
          const extra =
            typeof itemClassName === 'function' ? itemClassName(item, index) : (itemClassName ?? '')
          return (
            <div
              key={id}
              role="listitem"
              data-reorder-list={listId}
              data-reorder-id={id}
              className={`reorder-row ${dragging ? 'is-dragging' : ''} ${over ? 'is-drop-target' : ''} ${extra}`}
            >
              {children(item, index)}
            </div>
          )
        })}
      </div>
    </ReorderContext.Provider>
  )
}

export function ReorderHandle({ label = 'Drag to reorder' }: { label?: string }) {
  const ctx = useContext(ReorderContext)
  if (!ctx) return null

  const style: CSSProperties = { touchAction: 'none' }

  return (
    <button
      type="button"
      className="reorder-handle"
      aria-label={label}
      title={label}
      style={style}
      onPointerDown={(e) => {
        const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-reorder-id]')
        const id = row?.dataset.reorderId
        if (id) ctx.onHandlePointerDown(id, e)
      }}
      onClick={(e) => e.preventDefault()}
    >
      <GripVertical size={16} strokeWidth={1.5} aria-hidden />
    </button>
  )
}
