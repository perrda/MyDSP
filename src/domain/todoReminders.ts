import type { TodoItem } from './todo-types'
import { notificationManager } from '../utils/notifications'

const FIRED_KEY = 'mydsp_todo_reminders_fired'

export interface TodoReminderScheduleItem {
  id: number
  key: string
  title: string
  fireAt: number
  priority?: string
}

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveFired(set: Set<string>) {
  const arr = [...set].slice(-200)
  localStorage.setItem(FIRED_KEY, JSON.stringify(arr))
}

export function reminderKey(item: TodoItem): string {
  return `${item.id}:${item.reminderDate}:${item.reminderTime || '00:00'}`
}

/** Parse YYYY-MM-DD + HH:mm as local wall-clock time (avoids UTC midnight skew). */
export function parseReminderMs(item: TodoItem): number | null {
  if (!item.reminderDate || !/^\d{4}-\d{2}-\d{2}$/.test(item.reminderDate)) return null
  const [y, mo, d] = item.reminderDate.split('-').map(Number)
  const time = item.reminderTime && /^\d{1,2}:\d{2}/.test(item.reminderTime) ? item.reminderTime : '09:00'
  const [hh, mm] = time.split(':').map(Number)
  const dt = new Date(y, mo - 1, d, hh || 9, mm || 0, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt.getTime()
}

export async function ensureDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  return Notification.requestPermission()
}

/** Upcoming + recently due reminders for the service worker scheduler. */
export function buildReminderSchedule(items: TodoItem[]): TodoReminderScheduleItem[] {
  const now = Date.now()
  const fired = loadFired()
  const out: TodoReminderScheduleItem[] = []

  for (const item of items) {
    if (item.status === 'done' || item.status === 'archived') continue
    const at = parseReminderMs(item)
    if (at == null) continue
    const key = reminderKey(item)
    if (fired.has(key)) continue
    // Keep a 24h lookback so SW can still fire missed ones on wake
    if (at < now - 24 * 60 * 60 * 1000) continue
    // Don't schedule more than 30 days out (keeps SW payload small)
    if (at > now + 30 * 24 * 60 * 60 * 1000) continue
    out.push({
      id: item.id,
      key,
      title: item.title,
      fireAt: at,
      priority: item.priority,
    })
  }

  return out.sort((a, b) => a.fireAt - b.fireAt)
}

/**
 * Post reminder schedule to the controlling service worker and request
 * Background Sync / Periodic Sync when available.
 */
export async function syncTodoRemindersToServiceWorker(items: TodoItem[]): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const reminders = buildReminderSchedule(items)
  const message = { type: 'SCHEDULE_TODO_REMINDERS', reminders }

  try {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage(message)
    // Also notify any waiting controller
    navigator.serviceWorker.controller?.postMessage(message)

    // Background Sync: wake SW soon after going offline/online
    const syncManager = (reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> }
    }).sync
    if (syncManager && reminders.length > 0) {
      try {
        await syncManager.register('todo-reminders')
      } catch {
        /* unsupported or permission denied */
      }
    }

    // Periodic Background Sync (Chrome) — re-check due reminders hourly
    const periodic = (reg as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, opts?: { minInterval?: number }) => Promise<void>
      }
    }).periodicSync
    if (periodic && reminders.length > 0) {
      try {
        await periodic.register('todo-reminders', { minInterval: 60 * 60 * 1000 })
      } catch {
        /* requires permission / not supported */
      }
    }
  } catch {
    /* SW not ready */
  }
}

/**
 * Fire due todo reminders (in-app + optional desktop Notification).
 * Idempotent per reminder timestamp via localStorage.
 * Also used as a foreground fallback when SW isn't controlling.
 */
export function checkTodoReminders(
  items: TodoItem[],
  opts?: { onToast?: (title: string, message: string) => void },
): number {
  const now = Date.now()
  const fired = loadFired()
  let count = 0

  notificationManager.updateSettings({
    enabled: true,
    desktopEnabled: typeof Notification !== 'undefined' && Notification.permission === 'granted',
    categories: { todos: true },
  })

  for (const item of items) {
    if (item.status === 'done' || item.status === 'archived') continue
    const at = parseReminderMs(item)
    if (at == null) continue
    if (at > now) continue
    if (now - at > 24 * 60 * 60 * 1000) continue

    const key = reminderKey(item)
    if (fired.has(key)) continue
    fired.add(key)
    count++

    notificationManager.add({
      type: 'reminder',
      priority: item.priority === 'high' ? 'high' : 'medium',
      title: 'To Do reminder',
      message: item.title,
      actionUrl: '/todos',
      actionLabel: "Open To Do's",
      category: 'todos',
      dismissible: true,
    })
    // Toast only when desktop notifications unavailable (avoid duplicate UX)
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      opts?.onToast?.(item.title, 'Reminder due')
    }
  }

  if (count > 0) saveFired(fired)
  return count
}

/** Mark a reminder key fired (shared with SW via postMessage). */
export function markReminderFired(key: string): void {
  const fired = loadFired()
  if (fired.has(key)) return
  fired.add(key)
  saveFired(fired)
}
