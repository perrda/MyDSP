import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LAST_MANUAL_BACKUP_AT_KEY } from '../storage/backupStore'
import {
  armManualBackupReminder,
  dueManualBackupPrompt,
  MANUAL_BACKUP_REMINDER_MS,
  snoozeManualBackupPrompt,
} from '../storage/manualBackupReminder'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('MyDSP 1.2.134 hourly manual backup prompt', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
    vi.unstubAllGlobals()
  })

  it('first visit arms a one-hour snooze — not an immediate popup', () => {
    const t0 = Date.parse('2026-08-30T12:00:00.000Z')
    expect(dueManualBackupPrompt(t0)).toBe(false)
    expect(dueManualBackupPrompt(t0 + MANUAL_BACKUP_REMINDER_MS - 1)).toBe(false)
    expect(dueManualBackupPrompt(t0 + MANUAL_BACKUP_REMINDER_MS + 1)).toBe(true)
  })

  it('No snoozes another hour; a fresh manual backup also blocks', () => {
    const t0 = Date.parse('2026-08-30T12:00:00.000Z')
    armManualBackupReminder(t0)
    snoozeManualBackupPrompt(t0 + MANUAL_BACKUP_REMINDER_MS + 5)
    expect(dueManualBackupPrompt(t0 + MANUAL_BACKUP_REMINDER_MS + 10)).toBe(false)
    expect(dueManualBackupPrompt(t0 + 2 * MANUAL_BACKUP_REMINDER_MS + 10)).toBe(true)

    mem.set(LAST_MANUAL_BACKUP_AT_KEY, new Date(t0 + 2 * MANUAL_BACKUP_REMINDER_MS + 20).toISOString())
    expect(dueManualBackupPrompt(t0 + 2 * MANUAL_BACKUP_REMINDER_MS + 30)).toBe(false)
  })

  it('AppShell mounts the Yes/No dialog and Settings still has Backup now', () => {
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/ManualBackupReminder/)
    const reminder = read('../components/ManualBackupReminder.tsx')
    expect(reminder).toMatch(/Create Manual Backup now\?/)
    expect(reminder).toMatch(/confirmLabel="Yes"/)
    expect(reminder).toMatch(/cancelLabel="No"/)
    expect(reminder).toMatch(/createFullBackup\('manual'/)
    expect(read('../components/ui/Modal.tsx')).toMatch(/cancelLabel/)
    expect(read('../storage/backupStore.ts')).toMatch(/LAST_MANUAL_BACKUP_AT_KEY/)
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.134\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Hourly manual backup/)
  })
})
