/**
 * In-app release notes shown on the PWA UpdateBanner when a new version is ready.
 * Keep 3 short bullets aligned with the latest CHANGELOG section.
 */
export const RELEASE_NOTES: readonly string[] = [
  'Markets Heat density + per-section quote refresh',
  'Corporate action notes on equities · Add from holding',
  'FX triangle check when cross rates disagree',
]

/** Return up to `n` bullets for the banner. */
export function releaseNotesBullets(n = 3): string[] {
  return RELEASE_NOTES.slice(0, n)
}
