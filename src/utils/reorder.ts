/** List reorder helpers — custom sortOrder + id arrays. */

export function moveIndex<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Stable display order: explicit sortOrder, then optional tie-break, then id. */
export function sortBySortOrder<T extends { id?: number; sortOrder?: number }>(
  items: T[],
  tieBreak?: (a: T, b: T) => number,
): T[] {
  return [...items].sort((a, b) => {
    const ao = a.sortOrder ?? 1_000_000 + (a.id ?? 0)
    const bo = b.sortOrder ?? 1_000_000 + (b.id ?? 0)
    if (ao !== bo) return ao - bo
    return tieBreak?.(a, b) ?? (a.id ?? 0) - (b.id ?? 0)
  })
}

/** Write contiguous sortOrder 0..n-1 after a manual reorder. */
export function applySortOrder<T extends { sortOrder?: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }))
}

export function orderByIds<T>(items: T[], getId: (item: T) => string, orderedIds: string[]): T[] {
  const map = new Map(items.map((item) => [getId(item), item]))
  const seen = new Set<string>()
  const ordered: T[] = []
  for (const id of orderedIds) {
    const item = map.get(id)
    if (item) {
      ordered.push(item)
      seen.add(id)
    }
  }
  for (const item of items) {
    const id = getId(item)
    if (!seen.has(id)) ordered.push(item)
  }
  return ordered
}
