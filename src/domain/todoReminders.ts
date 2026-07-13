import type { TodoItem } from './todo-types'
import { notificationManager } from '../utils/notifications'

const FIRED_KEY = 'mydsp_todo_reminders_fired'

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

function reminderKey(item: TodoItem): string {
  return `${item.id}:${item.reminderDate}:${item.reminderTime || '00:00'}`
}

function parseReminderMs(item: TodoItem): number | null {
  if (!item.reminderDate) return null
  const time = item.reminderTime && /^\d{1,2}:\d{2}/.test(item.reminderTime) ? item.reminderTime : '09:00'
  const [hh, mm] = time.split(':').map(Number)
  const d = new Date(item.reminderDate)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(hh || 9, mm || 0, 0, 0)
  return d.getTime()
}

export async function ensureDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  return Notification.requestPermission()
}

/**
 * Fire due todo reminders (in-app + optional desktop Notification).
 * Idempotent per reminder timestamp via localStorage.
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
    // Only fire within a 24h window after due (avoid ancient backlog spam)
    if (now - at > 24 * 60 * 60 * 1000) continue

    const key = reminderKey(item)
    if (fired.has(key)) continue
    fired.add(key)
    count++

    notificationManager.add({
      type: 'reminder',
      priority: item.priority === 'high' ? 'high' : 'medium',
      title: 'Todo reminder',
      message: item.title,
      actionUrl: '/todos',
      actionLabel: 'Open Todos',
      category: 'todos',
      dismissible: true,
    })
    opts?.onToast?.(item.title, 'Reminder due')
  }

  if (count > 0) saveFired(fired)
  return count
}
