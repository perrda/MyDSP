/** Notification settings — syncs via fullArchive (LWW by updatedAt).
 *  OS Notification.permission stays device-local. */

import {
  notificationManager,
  type NotificationSettings,
} from '../utils/notifications'

export const NOTIFICATION_SETTINGS_KEY = 'mydsp_notification_settings'
export const NOTIFICATION_SETTINGS_META_KEY = 'mydsp_notification_settings_meta_v1'

export type NotificationSettingsBackup = {
  enabled: boolean
  soundEnabled: boolean
  desktopEnabled: boolean
  categories: Record<string, boolean>
  priorityThreshold: NotificationSettings['priorityThreshold']
  quietHoursStart?: string
  quietHoursEnd?: string
  updatedAt: string
}

const DEFAULTS: Omit<NotificationSettingsBackup, 'updatedAt'> = {
  enabled: true,
  soundEnabled: false,
  desktopEnabled: false,
  categories: {},
  priorityThreshold: 'critical',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

function normalize(raw: Partial<NotificationSettings> | null | undefined): Omit<
  NotificationSettingsBackup,
  'updatedAt'
> {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }
  return {
    enabled: raw.enabled !== false,
    soundEnabled: Boolean(raw.soundEnabled),
    desktopEnabled: Boolean(raw.desktopEnabled),
    categories:
      raw.categories && typeof raw.categories === 'object'
        ? { ...raw.categories }
        : {},
    priorityThreshold:
      raw.priorityThreshold === 'low' ||
      raw.priorityThreshold === 'medium' ||
      raw.priorityThreshold === 'high' ||
      raw.priorityThreshold === 'critical'
        ? raw.priorityThreshold
        : 'critical',
    quietHoursStart:
      typeof raw.quietHoursStart === 'string' ? raw.quietHoursStart : DEFAULTS.quietHoursStart,
    quietHoursEnd:
      typeof raw.quietHoursEnd === 'string' ? raw.quietHoursEnd : DEFAULTS.quietHoursEnd,
  }
}

export function touchNotificationSettingsMeta(opts?: { markDirty?: boolean }): void {
  const flags = normalize(notificationManager.getSettings())
  const next: NotificationSettingsBackup = {
    ...flags,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportNotificationSettingsForBackup(): NotificationSettingsBackup | null {
  try {
    const metaRaw = localStorage.getItem(NOTIFICATION_SETTINGS_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as NotificationSettingsBackup
      const flags = normalize(parsed)
      return {
        ...flags,
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { ...normalize(notificationManager.getSettings()), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importNotificationSettingsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as NotificationSettingsBackup
  const local = exportNotificationSettingsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const flags = normalize(remote)
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(flags))
    localStorage.setItem(
      NOTIFICATION_SETTINGS_META_KEY,
      JSON.stringify({
        ...flags,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
  notificationManager.applySettingsFromSync(flags)
}
