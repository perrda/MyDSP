/**
 * Calendar-month dismissals for nag banners / launch toasts.
 * After the user acknowledges an alert, hide it until `until` (ISO date, exclusive end).
 */

const PREFIX = 'mydsp_alert_dismiss_v1:'

export type AlertDismissRecord = {
  /** Hide while today < until (YYYY-MM-DD). */
  until: string
  dismissedAt: string
}

/** First day of the calendar month after next (≈ one full calendar month of quiet). */
export function calendarMonthDismissUntil(now = new Date()): string {
  const y = now.getFullYear()
  const m = now.getMonth()
  // Dismiss mid-July → hide through August → show again 1 Sep
  const until = new Date(y, m + 2, 1)
  const yy = until.getFullYear()
  const mm = String(until.getMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}-01`
}

function todayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function storageKey(id: string): string {
  return `${PREFIX}${id}`
}

export function isAlertDismissed(id: string, now = new Date()): boolean {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return false
    const parsed = JSON.parse(raw) as AlertDismissRecord
    if (!parsed?.until || typeof parsed.until !== 'string') return false
    return todayKey(now) < parsed.until
  } catch {
    return false
  }
}

export function dismissAlertForCalendarMonth(id: string, now = new Date()): AlertDismissRecord {
  const record: AlertDismissRecord = {
    until: calendarMonthDismissUntil(now),
    dismissedAt: now.toISOString(),
  }
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(record))
    window.dispatchEvent(new CustomEvent('mydsp-alert-dismiss', { detail: { id, ...record } }))
  } catch {
    /* ignore */
  }
  return record
}

export function clearAlertDismiss(id: string): void {
  try {
    localStorage.removeItem(storageKey(id))
  } catch {
    /* ignore */
  }
}

/** Stable id for a concentration hit (symbol-scoped so other names can still alert). */
export function concentrationDismissId(symbol: string): string {
  return `concentration:${symbol.trim().toUpperCase()}`
}

export const BACKUP_NUDGE_DISMISS_ID = 'backup-nudge'
