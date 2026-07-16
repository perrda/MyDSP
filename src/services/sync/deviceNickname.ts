/** Editable per-install device nickname for sync activity / conflict UI. */

import { getLocalDeviceId } from './syncService'

export const DEVICE_NICKNAME_KEY = 'mydsp_device_nickname'

/** Short form of a device id (strip `dev_` prefix, first 8 chars). */
export function shortDeviceId(id: string): string {
  const raw = (id || '').replace(/^dev_/, '')
  return (raw || 'device').slice(0, 8)
}

/** Default nickname derived from this install's device id. */
export function defaultDeviceNickname(): string {
  return shortDeviceId(getLocalDeviceId())
}

export function loadDeviceNickname(): string {
  try {
    const raw = localStorage.getItem(DEVICE_NICKNAME_KEY)
    if (raw != null && raw.trim()) return raw.trim()
  } catch {
    /* ignore */
  }
  return defaultDeviceNickname()
}

export function saveDeviceNickname(name: string): string {
  const next = name.trim() || defaultDeviceNickname()
  try {
    localStorage.setItem(DEVICE_NICKNAME_KEY, next)
  } catch {
    /* ignore */
  }
  return next
}

/** Hint used when appending local sync activity. */
export function getLocalDeviceHint(): string {
  return loadDeviceNickname()
}
