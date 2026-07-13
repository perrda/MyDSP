import { createTodoItem } from './todos'
import type { TodoItem, TodoPriority } from './todo-types'

/** Noise / chrome lines commonly OCR'd from todo app screenshots. */
const NOISE_PATTERNS = [
  /^(todos?|tasks?|reminders?|today|upcoming|inbox|all lists?|my list|scheduled|flagged)$/i,
  /^(add|new|create|search|filter|sort|settings?|edit|done|complete|reminders)$/i,
  /^(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i,
  /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i,
  /^\d{1,2}[:.]\d{2}\s*(am|pm)?$/i,
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,
  /^[•·●○◦▪▫■□☐☑✓✔✕×x+-]$/i,
  /^https?:\/\//i,
  /^www\./i,
  /^(iPhone|iPad|Android|Google\s*Keep|Apple\s*Reminders)$/i,
]

const CHECKBOX_PREFIX =
  /^(?:[☐☑□■▪▫•·●○◦*✓✔]|\-\s+|–\s+|—\s+|[0-9]+[.)]\s*|[\[\(]\s*[xX✓✔☑ ]?\s*[\]\)]\s*)\s*/

const COMPLETED_PREFIX = /^(?:[\[\(]\s*[xX✓✔☑]\s*[\]\)]|[☑✓✔])\s*/

const PRIORITY_HINTS: Array<{ re: RegExp; priority: TodoPriority }> = [
  { re: /\b(urgent|asap|critical|high\s*priority|!!!)\b/i, priority: 'high' },
  { re: /\b(low\s*priority|someday|nice\s*to\s*have)\b/i, priority: 'low' },
]

export interface ParsedTodoCandidate {
  title: string
  priority: TodoPriority
  completed: boolean
  dueDate?: string
  raw: string
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
}

/** Extract and strip a due date from a task line (Apple/Google Reminders style). */
export function extractDueDate(text: string): { title: string; dueDate?: string } {
  const patterns: Array<{ re: RegExp; parse: (m: RegExpMatchArray) => string | undefined }> = [
    {
      re: /\b(today)\b/i,
      parse: () => new Date().toISOString().slice(0, 10),
    },
    {
      re: /\b(tomorrow)\b/i,
      parse: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return d.toISOString().slice(0, 10)
      },
    },
    {
      // 13/07/2026 or 13-07-26
      re: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/,
      parse: (m) => {
        const day = Number(m[1])
        const month = Number(m[2])
        let year = Number(m[3])
        if (year < 100) year += 2000
        if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      },
    },
    {
      // Jul 13, 2026 or 13 Jul
      re: /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b(?:\s*,?\s*(\d{4}))?/i,
      parse: (m) => {
        const day = Number(m[1])
        const month = MONTHS[m[2].toLowerCase().slice(0, 3)]
        const year = m[3] ? Number(m[3]) : new Date().getFullYear()
        if (month == null || day < 1 || day > 31) return undefined
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      },
    },
    {
      re: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i,
      parse: (m) => {
        const month = MONTHS[m[1].toLowerCase().slice(0, 3)]
        const day = Number(m[2])
        const year = m[3] ? Number(m[3]) : new Date().getFullYear()
        if (month == null || day < 1 || day > 31) return undefined
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      },
    },
  ]

  for (const { re, parse } of patterns) {
    const m = text.match(re)
    if (!m) continue
    const dueDate = parse(m)
    if (!dueDate) continue
    const title = text.replace(m[0], '').replace(/\s{2,}/g, ' ').replace(/^[\s\-–—,]+|[\s\-–—,]+$/g, '').trim()
    return { title: title || text, dueDate }
  }
  return { title: text }
}

export function cleanOcrLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[|│┃]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripTaskPrefix(line: string): { text: string; completed: boolean } {
  const cleaned = cleanOcrLine(line)
  const completed = COMPLETED_PREFIX.test(cleaned)
  const text = cleaned.replace(CHECKBOX_PREFIX, '').trim()
  return { text, completed }
}

export function isNoiseLine(line: string): boolean {
  const t = cleanOcrLine(line)
  if (!t) return true
  if (t.length < 2) return true
  if (t.length > 200) return true
  if (/^[\d\s:./\-–—]+$/.test(t)) return true
  if (NOISE_PATTERNS.some((re) => re.test(t))) return true
  // Mostly punctuation / symbols
  if ((t.match(/[A-Za-z0-9]/g) ?? []).length < 2) return true
  return false
}

export function detectPriority(title: string): TodoPriority {
  for (const hint of PRIORITY_HINTS) {
    if (hint.re.test(title)) return hint.priority
  }
  return 'medium'
}

/**
 * Turn raw OCR text from a todo-app screenshot into candidate tasks.
 * Conservative: one meaningful line ≈ one task; user can edit before import.
 */
export function parseOcrTextToCandidates(ocrText: string): ParsedTodoCandidate[] {
  const lines = ocrText
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(Boolean)

  const seen = new Set<string>()
  const candidates: ParsedTodoCandidate[] = []

  for (const raw of lines) {
    if (isNoiseLine(raw)) continue
    const { text, completed } = stripTaskPrefix(raw)
    if (isNoiseLine(text)) continue

    const { title, dueDate } = extractDueDate(text)
    if (isNoiseLine(title)) continue

    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    candidates.push({
      title,
      priority: detectPriority(title),
      completed,
      dueDate,
      raw,
    })
  }

  return candidates
}

export function candidatesToTodoItems(
  candidates: Array<Pick<ParsedTodoCandidate, 'title' | 'priority' | 'completed' | 'dueDate'>>,
  listId: number,
  options?: { tag?: string },
): TodoItem[] {
  const tag = options?.tag ?? 'imported'
  const now = Date.now()

  return candidates
    .map((c, idx) => {
      const title = c.title.trim()
      if (!title) return null
      return createTodoItem({
        id: now + idx,
        listId,
        title,
        priority: c.priority,
        status: c.completed ? 'done' : 'todo',
        dueDate: c.dueDate,
        completedAt: c.completed ? new Date().toISOString() : undefined,
        tags: [tag, 'ocr'],
      })
    })
    .filter((x): x is TodoItem => x != null)
}

/** Move items to another list; returns updated items array. */
export function moveTodoItemsToList(
  items: TodoItem[],
  ids: Iterable<number>,
  targetListId: number,
): TodoItem[] {
  const idSet = new Set(ids)
  const now = new Date().toISOString()
  return items.map((item) =>
    idSet.has(item.id)
      ? { ...item, listId: targetListId, updatedAt: now }
      : item,
  )
}
