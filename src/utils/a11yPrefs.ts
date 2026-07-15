/** Accessibility preferences — persist as mydsp_a11y_* and apply html classes. */

export const A11Y_REDUCED_MOTION_KEY = 'mydsp_a11y_reduced_motion'
export const A11Y_HIGH_CONTRAST_KEY = 'mydsp_a11y_high_contrast'
export const A11Y_CHART_CB_KEY = 'mydsp_a11y_chart_cb'

export const A11Y_REDUCED_MOTION_CLASS = 'a11y-reduce-motion'
export const A11Y_HIGH_CONTRAST_CLASS = 'a11y-high-contrast'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}

export function loadA11yReducedMotion(): boolean {
  return readFlag(A11Y_REDUCED_MOTION_KEY)
}

export function saveA11yReducedMotion(on: boolean): void {
  writeFlag(A11Y_REDUCED_MOTION_KEY, on)
}

export function loadA11yHighContrast(): boolean {
  return readFlag(A11Y_HIGH_CONTRAST_KEY)
}

export function saveA11yHighContrast(on: boolean): void {
  writeFlag(A11Y_HIGH_CONTRAST_KEY, on)
}

export function loadA11yChartColourBlind(): boolean {
  return readFlag(A11Y_CHART_CB_KEY)
}

export function saveA11yChartColourBlind(on: boolean): void {
  writeFlag(A11Y_CHART_CB_KEY, on)
}

export function applyA11yReducedMotionDom(on: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(A11Y_REDUCED_MOTION_CLASS, on)
}

export function applyA11yHighContrastDom(on: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(A11Y_HIGH_CONTRAST_CLASS, on)
}

/** Apply all a11y html classes from storage (boot / Settings). */
export function applyA11yPrefsDom(): void {
  applyA11yReducedMotionDom(loadA11yReducedMotion())
  applyA11yHighContrastDom(loadA11yHighContrast())
}
