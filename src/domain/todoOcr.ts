import { createTodoItem } from './todos'
import type { TodoItem, TodoPriority } from './todo-types'

/** Noise / chrome lines commonly OCR'd from todo app screenshots. */
const NOISE_PATTERNS = [
  /^(todos?|tasks?|reminders?|today|upcoming|inbox|all lists?|my list)$/i,
  /^(add|new|create|search|filter|sort|settings?|edit|done|complete)$/i,
  /^(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i,
  /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i,
  /^\d{1,2}[:.]\d{2}\s*(am|pm)?$/i,
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,
  /^[•·●○◦▪▫■□☐☑✓✔✕×x+-]$/i,
  /^https?:\/\//i,
  /^www\./i,
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
  raw: string
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

    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    candidates.push({
      title: text,
      priority: detectPriority(text),
      completed,
      raw,
    })
  }

  return candidates
}

export function candidatesToTodoItems(
  candidates: Array<Pick<ParsedTodoCandidate, 'title' | 'priority' | 'completed'>>,
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
