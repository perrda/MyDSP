/** Glass Mode preference — Apple-style frosted surfaces across MyDSP. */

export const GLASS_STORAGE_KEY = 'mydsp_glass_mode'

export function loadGlassMode(): boolean {
  try {
    return localStorage.getItem(GLASS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveGlassMode(on: boolean): void {
  try {
    localStorage.setItem(GLASS_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}

export function applyGlassDom(on: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('glass', on)
}
