/**
 * Natural-language quick-add for todos: "Pay rent Friday" → title + dueDate.
 * Supports today / tomorrow / next week / weekday names (Mon–Sun).
 */

export type ParsedTodoQuickAdd = {
  title: string
  dueDate?: string
  priority?: 'high' | 'medium' | 'low'
  tags?: string[]
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nextWeekday(from: Date, targetDow: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const current = d.getDay()
  let delta = (targetDow - current + 7) % 7
  if (delta === 0) delta = 7 // "Friday" on Friday → next Friday
  d.setDate(d.getDate() + delta)
  return d
}

/**
 * Parse a quick-add line into title + optional YYYY-MM-DD due date.
 * Date tokens are stripped from the title when matched.
 */
export function parseTodoQuickAdd(
  input: string,
  now: Date = new Date(),
): ParsedTodoQuickAdd {
  let raw = input.trim().replace(/\s+/g, ' ')
  if (!raw) return { title: '' }
  const tags = Array.from(raw.matchAll(/(^|\s)#([A-Za-z0-9_-]+)/g), (m) => m[2]!)
  raw = raw.replace(/(^|\s)#[A-Za-z0-9_-]+/g, ' ').replace(/\s+/g, ' ').trim()

  let priority: ParsedTodoQuickAdd['priority']
  if (/(^|\s)(!|p1)(\s|$)/i.test(raw)) priority = 'high'
  else if (/(^|\s)p2(\s|$)/i.test(raw)) priority = 'medium'
  else if (/(^|\s)p3(\s|$)/i.test(raw)) priority = 'low'
  raw = raw.replace(/(^|\s)(!|p1|p2|p3)(\s|$)/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!raw) return { title: '', priority, tags }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const withMeta = (title: string, dueDate?: string): ParsedTodoQuickAdd => ({
    title,
    dueDate,
    priority,
    tags,
  });

  // tomorrow
  {
    const m = raw.match(/^(.*?)\s+tomorrow$/i) || raw.match(/^tomorrow\s+(.+)$/i)
    if (m) {
      const title = (m[1] ?? '').trim()
      if (title) {
        const d = new Date(today)
        d.setDate(d.getDate() + 1)
        return withMeta(title, toLocalYmd(d))
      }
    }
  }

  // today
  {
    const m = raw.match(/^(.*?)\s+today$/i) || raw.match(/^today\s+(.+)$/i)
    if (m) {
      const title = (m[1] ?? '').trim()
      if (title) return withMeta(title, toLocalYmd(today))
    }
  }

  // next week
  {
    const m =
      raw.match(/^(.*?)\s+next\s+week$/i) || raw.match(/^next\s+week\s+(.+)$/i)
    if (m) {
      const title = (m[1] ?? '').trim()
      if (title) {
        const d = new Date(today)
        d.setDate(d.getDate() + 7)
        return withMeta(title, toLocalYmd(d))
      }
    }
  }

  // weekday at end or start: "Pay rent Friday" / "Friday Pay rent"
  {
    const end = raw.match(
      /^(.*?)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)$/i,
    )
    if (end) {
      const title = end[1]!.trim()
      const key = end[2]!.toLowerCase()
      const dow = WEEKDAYS[key]
      if (title && dow !== undefined) {
        return withMeta(title, toLocalYmd(nextWeekday(today, dow)))
      }
    }
    const start = raw.match(
      /^(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\s+(.+)$/i,
    )
    if (start) {
      const key = start[1]!.toLowerCase()
      const title = start[2]!.trim()
      const dow = WEEKDAYS[key]
      if (title && dow !== undefined) {
        return withMeta(title, toLocalYmd(nextWeekday(today, dow)))
      }
    }
  }

  return withMeta(raw)
}
