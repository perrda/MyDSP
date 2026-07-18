/**
 * Device-local toggle to show Markets tag chips + Yield % sort.
 * Default false (quieter chrome from 1.2.75).
 */

const KEY = 'mydsp_markets_show_tag_yield_v1'

export function loadShowMarketsTagYieldChips(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveShowMarketsTagYieldChips(show: boolean): void {
  try {
    localStorage.setItem(KEY, show ? '1' : '0')
    window.dispatchEvent(new CustomEvent('mydsp-markets-tag-yield'))
  } catch {
    /* ignore */
  }
}

export function subscribeShowMarketsTagYieldChips(onChange: () => void): () => void {
  const handler = () => onChange()
  window.addEventListener('mydsp-markets-tag-yield', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('mydsp-markets-tag-yield', handler)
    window.removeEventListener('storage', handler)
  }
}
