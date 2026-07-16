/** Larger text / Dynamic Type preference for prices, holdings, Markets. */

export const LARGE_TEXT_STORAGE_KEY = 'mydsp_large_text'

export function loadLargeText(): boolean {
  try {
    return localStorage.getItem(LARGE_TEXT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveLargeText(on: boolean): void {
  try {
    localStorage.setItem(LARGE_TEXT_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}

export function applyLargeTextDom(on: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('large-text', on)
}
