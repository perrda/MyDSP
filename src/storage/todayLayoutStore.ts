/** Customizable Today cards. Syncs through fullArchive using updatedAt LWW. */

const KEY = 'mydsp.today.layout.v1'
const EVENT = 'mydsp-today-layout'

export const TODAY_ACCORDION_OPTIONS = [
  { id: 'next', label: 'To-dos' },
  { id: 'dailyPlan', label: 'Daily plan' },
  { id: 'bills', label: 'Bills' },
  { id: 'goals', label: 'Goals' },
  { id: 'careerPulse', label: 'Career pulse' },
] as const

export const TODAY_LAYOUT_CARD_OPTIONS = [
  ...TODAY_ACCORDION_OPTIONS,
  { id: 'tax', label: 'Tax' },
  { id: 'media', label: 'Media' },
  { id: 'budget', label: 'Budget' },
  { id: 'gettingStarted', label: 'Getting started' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'charts', label: 'Charts' },
  { id: 'activity', label: 'Activity' },
] as const

export type TodaySectionId = (typeof TODAY_ACCORDION_OPTIONS)[number]['id']
export type TodayCardId = (typeof TODAY_LAYOUT_CARD_OPTIONS)[number]['id']

export const DEFAULT_TODAY_SECTION_ORDER: readonly TodaySectionId[] =
  TODAY_ACCORDION_OPTIONS.map((option) => option.id)

export type TodayLayout = {
  order: TodaySectionId[]
  hidden: TodayCardId[]
  updatedAt: string
}

const SECTION_IDS = new Set<string>(DEFAULT_TODAY_SECTION_ORDER)
const CARD_IDS = new Set<string>(TODAY_LAYOUT_CARD_OPTIONS.map((option) => option.id))

function normalizeUniqueIds<T extends string>(
  raw: unknown,
  valid: Set<string>,
): T[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const normalized: T[] = []
  for (const value of raw) {
    if (typeof value !== 'string' || !valid.has(value) || seen.has(value)) continue
    seen.add(value)
    normalized.push(value as T)
  }
  return normalized
}

function normalizeLayout(raw: unknown): TodayLayout {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const suppliedOrder = normalizeUniqueIds<TodaySectionId>(record.order, SECTION_IDS)
  const order = [...suppliedOrder]
  for (const id of DEFAULT_TODAY_SECTION_ORDER) {
    if (!order.includes(id)) order.push(id)
  }
  // `hiddenCards` is the pre-v1.2.114 local-only shape.
  const hidden = normalizeUniqueIds<TodayCardId>(
    record.hidden ?? record.hiddenCards,
    CARD_IDS,
  )
  return {
    order,
    hidden,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : new Date(0).toISOString(),
  }
}

export function loadTodayLayout(): TodayLayout {
  try {
    const raw = localStorage.getItem(KEY)
    return raw
      ? normalizeLayout(JSON.parse(raw))
      : normalizeLayout(null)
  } catch {
    return normalizeLayout(null)
  }
}

export function saveTodayLayout(
  layout: Pick<TodayLayout, 'order' | 'hidden'>,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): TodayLayout {
  const next = normalizeLayout({
    ...layout,
    updatedAt: new Date().toISOString(),
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* private mode */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((module) =>
      module.markWorkspaceChangedForSync(),
    )
  }
  return next
}

export function resetTodayLayout(): TodayLayout {
  return saveTodayLayout({ order: [...DEFAULT_TODAY_SECTION_ORDER], hidden: [] })
}

export type TodayLayoutPresetId = 'work' | 'money' | 'quiet'

export const TODAY_LAYOUT_PRESETS: Record<
  TodayLayoutPresetId,
  { label: string; order: TodaySectionId[]; hidden: TodayCardId[] }
> = {
  work: {
    label: 'Work',
    order: ['next', 'dailyPlan', 'careerPulse', 'goals', 'bills'],
    hidden: ['charts', 'activity', 'gettingStarted'],
  },
  money: {
    label: 'Money',
    order: ['bills', 'next', 'goals', 'dailyPlan', 'careerPulse'],
    hidden: ['careerPulse', 'media', 'gettingStarted', 'reminders'],
  },
  quiet: {
    label: 'Quiet',
    order: ['next', 'dailyPlan', 'bills', 'goals', 'careerPulse'],
    hidden: [
      'tax',
      'media',
      'budget',
      'gettingStarted',
      'alerts',
      'reminders',
      'charts',
      'activity',
      'careerPulse',
      'goals',
    ],
  },
}

export function applyTodayLayoutPreset(id: TodayLayoutPresetId): TodayLayout {
  const preset = TODAY_LAYOUT_PRESETS[id]
  return saveTodayLayout({ order: [...preset.order], hidden: [...preset.hidden] })
}

export function subscribeTodayLayout(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

export function exportTodayLayoutForBackup(): TodayLayout | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeLayout(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function importTodayLayoutFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = normalizeLayout(raw)
  const local = exportTodayLayoutForBackup()
  const remoteAt = Date.parse(remote.updatedAt) || 0
  const localAt = Date.parse(local?.updatedAt ?? '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(KEY, JSON.stringify(remote))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* private mode */
  }
}
