/**
 * A satellite that already has Mini’s Remote URL but has not pulled yet
 * must not silently seed factory News tags / Markets tickers. Those defaults
 * union into Mini on the first extras push after Unlock.
 */

const CONFIG_KEY = 'mydsp_sync_config'

export function satelliteAwaitingFirstPull(): boolean {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return false
    const cfg = JSON.parse(raw) as {
      remoteUrl?: string
      thisDeviceIsTheBook?: boolean
      lastSyncAt?: string
    }
    if (cfg.thisDeviceIsTheBook === true) return false
    if (!String(cfg.remoteUrl ?? '').trim()) return false
    return !cfg.lastSyncAt
  } catch {
    return false
  }
}
