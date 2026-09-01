/**
 * When a satellite must show Unlock & pull for YouTube / News extras.
 * Mini (the book) never needs this — it already holds the list.
 */

import { hasSessionSyncPassphrase } from './sessionPassphrase'
import { isBookDevice, loadSyncConfig, type SyncConfig } from './syncService'

export function satelliteNeedsMediaUnlock(
  cfg: SyncConfig = loadSyncConfig(),
  status?: { state: string },
  unlocked: boolean = hasSessionSyncPassphrase(),
): boolean {
  if (isBookDevice(cfg) || unlocked) return false
  // Any sync footprint — including Automatic off — still needs Unlock & pull.
  // First-run empty slate (no URL / lastSync) stays quiet.
  void status
  return Boolean(cfg.enabled || cfg.remoteUrl.trim() || cfg.lastSyncAt)
}
