/** Allocation chart palettes — default vs colour-blind safe (blue/orange/vermillion). */

import { loadA11yChartColourBlind } from './a11yPrefs'

export const DEFAULT_CHART_COLORS = [
  'var(--accent)',
  '#86efac',
  '#c4b5fd',
  '#67e8f9',
  '#fcd34d',
  '#f9a8d4',
  '#93c5fd',
  '#a3a3a3',
]

/** Okabe–Ito inspired: blue / orange / vermillion-safe for common CVD. */
export const COLORBLIND_SAFE_COLORS = [
  '#0072B2',
  '#E69F00',
  '#D55E00',
  '#009E73',
  '#56B4E9',
  '#F0E442',
  '#CC79A7',
  '#000000',
]

export function getChartPalette(): string[] {
  return loadA11yChartColourBlind() ? COLORBLIND_SAFE_COLORS : DEFAULT_CHART_COLORS
}
