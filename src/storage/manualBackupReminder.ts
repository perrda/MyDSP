/** Device-local hourly “Create Manual Backup now?” prompt. Does not sync. */

import { LAST_MANUAL_BACKUP_AT_KEY } from './backupStore'

const KEY = 'mydsp.manual-backup-reminder.v1'
export const MANUAL_BACKUP_REMINDER_MS = 60 * 60 * 1000

type ReminderState = {
  armedAt: string
  snoozeUntil: string
}

function readState(): ReminderState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ReminderState>
    if (typeof parsed.armedAt !== 'string' || typeof parsed.snoozeUntil !== 'string') return null
    return { armedAt: parsed.armedAt, snoozeUntil: parsed.snoozeUntil }
  } catch {
    return null
  }
}

function writeState(next: ReminderState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}

function lastManualBackupMs(): number {
  try {
    const raw = localStorage.getItem(LAST_MANUAL_BACKUP_AT_KEY)
    const at = raw ? Date.parse(raw) : NaN
    return Number.isFinite(at) ? at : 0
  } catch {
    return 0
  }
}

/** First visit arms a 1-hour snooze so the modal is not immediate. */
export function armManualBackupReminder(now = Date.now()): ReminderState {
  const existing = readState()
  if (existing) return existing
  const next = {
    armedAt: new Date(now).toISOString(),
    snoozeUntil: new Date(now + MANUAL_BACKUP_REMINDER_MS).toISOString(),
  }
  writeState(next)
  return next
}

export function dueManualBackupPrompt(now = Date.now()): boolean {
  const state = armManualBackupReminder(now)
  if (now - lastManualBackupMs() < MANUAL_BACKUP_REMINDER_MS) return false
  const snooze = Date.parse(state.snoozeUntil)
  if (Number.isFinite(snooze) && snooze > now) return false
  return true
}

export function snoozeManualBackupPrompt(now = Date.now()): void {
  const state = armManualBackupReminder(now)
  writeState({
    ...state,
    snoozeUntil: new Date(now + MANUAL_BACKUP_REMINDER_MS).toISOString(),
  })
}
