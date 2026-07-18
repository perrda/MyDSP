/** Persist the 3 customizable middle bottom-nav tabs (Overview + Settings stay fixed).
 *  Syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_bottom_nav_slots_v1'
const META_KEY = 'mydsp_bottom_nav_slots_meta_v1'

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

export type BottomNavSlotsBackup = {
  slots: string[]
  updatedAt: string
}

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

export function saveBottomNavMiddleSlots(
  slots: string[],
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const next = normalizeSlots(slots)
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ slots: next, updatedAt }))
    }
    window.dispatchEvent(new Event('mydsp-nav-order'))
  } catch {
    /* private mode */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function resetBottomNavMiddleSlots(): void {
  saveBottomNavMiddleSlots([...DEFAULT_BOTTOM_NAV_MIDDLE])
}

/** Snapshot for backup / sync (null if never customized). */
export function exportBottomNavSlotsForBackup(): BottomNavSlotsBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as BottomNavSlotsBackup
      if (Array.isArray(parsed.slots)) {
        return {
          slots: normalizeSlots(parsed.slots),
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return {
      slots: normalizeSlots(JSON.parse(raw)),
      updatedAt: new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function importBottomNavSlotsFromBackup(raw: unknown): void {
  if (!raw) return
  // Legacy: plain string[] from older backups
  if (Array.isArray(raw)) {
    const local = exportBottomNavSlotsForBackup()
    if (local && Date.parse(local.updatedAt || '') > 0) return
    const slots = normalizeSlots(raw)
    try {
      localStorage.setItem(KEY, JSON.stringify(slots))
      localStorage.setItem(
        META_KEY,
        JSON.stringify({ slots, updatedAt: new Date(0).toISOString() }),
      )
      window.dispatchEvent(new Event('mydsp-nav-order'))
    } catch {
      /* ignore */
    }
    return
  }
  if (typeof raw !== 'object') return
  const remote = raw as BottomNavSlotsBackup
  if (!Array.isArray(remote.slots)) return
  const local = exportBottomNavSlotsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const slots = normalizeSlots(remote.slots)
  try {
    localStorage.setItem(KEY, JSON.stringify(slots))
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        slots,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
    window.dispatchEvent(new Event('mydsp-nav-order'))
  } catch {
    /* ignore */
  }
}
