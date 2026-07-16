/** Persist the 3 customizable middle bottom-nav tabs (Overview + Settings stay fixed). */

const KEY = 'mydsp_bottom_nav_slots_v1'

/** Default middle tabs matching the phone bottom bar: Markets · To Do · Equities */
export const DEFAULT_BOTTOM_NAV_MIDDLE = ['/markets', '/todos', '/equities'] as const

export const BOTTOM_NAV_FIXED_START = '/'
export const BOTTOM_NAV_FIXED_END = '/settings'

/** Paths the user may assign to the three middle slots (keep in sync with BOTTOM_NAV_CATALOG). */
export const BOTTOM_NAV_SLOT_CHOICES = [
  '/markets',
  '/spending',
  '/goals',
  '/crypto',
  '/equities',
  '/todos',
  '/jobs',
  '/news',
  '/youtube',
  '/liabilities',
  '/tax',
] as const

export function bottomNavSlotChoices(): string[] {
  return [...BOTTOM_NAV_SLOT_CHOICES]
}

export function isValidBottomNavSlot(path: string): boolean {
  return (BOTTOM_NAV_SLOT_CHOICES as readonly string[]).includes(path)
}

function normalizeSlots(raw: unknown): string[] {
  const choices = new Set<string>(BOTTOM_NAV_SLOT_CHOICES)
  const out: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(raw)) {
    for (const p of raw) {
      if (typeof p !== 'string' || !choices.has(p) || seen.has(p)) continue
      out.push(p)
      seen.add(p)
      if (out.length >= 3) break
    }
  }
  for (const d of DEFAULT_BOTTOM_NAV_MIDDLE) {
    if (out.length >= 3) break
    if (seen.has(d)) continue
    out.push(d)
    seen.add(d)
  }
  for (const p of BOTTOM_NAV_SLOT_CHOICES) {
    if (out.length >= 3) break
    if (seen.has(p)) continue
    out.push(p)
    seen.add(p)
  }
  return out.slice(0, 3)
}

export function loadBottomNavMiddleSlots(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...DEFAULT_BOTTOM_NAV_MIDDLE]
    return normalizeSlots(JSON.parse(raw))
  } catch {
    return [...DEFAULT_BOTTOM_NAV_MIDDLE]
  }
}

export function saveBottomNavMiddleSlots(slots: string[]): void {
  const next = normalizeSlots(slots)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('mydsp-nav-order'))
  } catch {
    /* private mode */
  }
}

export function resetBottomNavMiddleSlots(): void {
  saveBottomNavMiddleSlots([...DEFAULT_BOTTOM_NAV_MIDDLE])
}

/** Snapshot for backup / sync (null if never customized). */
export function exportBottomNavSlotsForBackup(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return normalizeSlots(JSON.parse(raw))
  } catch {
    return null
  }
}

export function importBottomNavSlotsFromBackup(raw: unknown): void {
  if (!Array.isArray(raw)) return
  saveBottomNavMiddleSlots(normalizeSlots(raw))
}
