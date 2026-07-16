/** Colour helpers for Markets heat-map density view. */

/**
 * Map day-change % to a heat cell background (red ↔ green).
 * Flat (~0) stays muted so the grid still reads as a composition.
 */
export function heatColorForChangePct(pct: number): string {
  if (!Number.isFinite(pct)) return 'hsl(220 6% 42% / 0.22)'
  const clamped = Math.max(-5, Math.min(5, pct))
  if (Math.abs(clamped) < 0.05) return 'hsl(220 6% 42% / 0.22)'
  const t = Math.abs(clamped) / 5
  if (clamped > 0) {
    const sat = 42 + t * 38
    const light = 28 + t * 14
    return `hsl(145 ${sat}% ${light}%)`
  }
  const sat = 42 + t * 38
  const light = 32 + t * 12
  return `hsl(0 ${sat}% ${light}%)`
}

export function heatTextClassForChangePct(pct: number): string {
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) return 'text-text'
  return 'text-white'
}
