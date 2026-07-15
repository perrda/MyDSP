/** Brief haptic-style edge flash after Sync / Trade / Backup success (reduce-motion safe via CSS). */

const FLASH_CLASS = 'success-haptic-flash'
const FLASH_MS = 520

let flashTimer: number | null = null

export function triggerSuccessFlash(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove(FLASH_CLASS)
  // Restart animation if already flashing
  void root.offsetWidth
  root.classList.add(FLASH_CLASS)
  if (flashTimer != null) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    root.classList.remove(FLASH_CLASS)
    flashTimer = null
  }, FLASH_MS)
}

/** True when a Settings banner message is a Sync / Trade / Backup success. */
export function isSyncTradeBackupSuccess(message: string): boolean {
  return /\b(sync|synced|backup|trade|pushed|pulled|restored|devices synced)\b/i.test(message)
}
