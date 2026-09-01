/**
 * A satellite that already has Mini’s Remote URL but has not pulled yet
 * must not silently seed factory News tags / Markets tickers. Those defaults
 * union into Mini on the first extras push after Unlock.
 */

const CONFIG_KEY = 'mydsp_sync_config'

function readSatelliteSyncCfg(): {
  remoteUrl?: string
  thisDeviceIsTheBook?: boolean
  lastSyncAt?: string
  lastWorkspaceExtrasSyncAt?: string
} | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      remoteUrl?: string
      thisDeviceIsTheBook?: boolean
      lastSyncAt?: string
      lastWorkspaceExtrasSyncAt?: string
    }
  } catch {
    return null
  }
}

export function satelliteAwaitingFirstPull(): boolean {
  const cfg = readSatelliteSyncCfg()
  if (!cfg) return false
  if (cfg.thisDeviceIsTheBook === true) return false
  if (!String(cfg.remoteUrl ?? '').trim()) return false
  return !cfg.lastSyncAt
}

/**
 * First extras apply on a satellite must REPLACE leftover YouTube / News / Markets
 * (the 8 local channels on Live 1.2.147). Later pulls union + tombstones.
 */
export function satelliteShouldReplaceExtrasOnImport(): boolean {
  const cfg = readSatelliteSyncCfg()
  if (!cfg) return false
  if (cfg.thisDeviceIsTheBook === true) return false
  if (!String(cfg.remoteUrl ?? '').trim()) return false
  return !cfg.lastWorkspaceExtrasSyncAt
}

/** Satellites with Mini’s URL keep Mini’s watchlist — never refill factory FX/index. */
export function satelliteMustNotRefillFactoryTickers(): boolean {
  const cfg = readSatelliteSyncCfg()
  if (!cfg) return false
  if (cfg.thisDeviceIsTheBook === true) return false
  return Boolean(String(cfg.remoteUrl ?? '').trim())
}
