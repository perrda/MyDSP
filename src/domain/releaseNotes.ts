/**
 * In-app release notes shown on the PWA UpdateBanner when a new version is ready.
 * Keep 3 short bullets aligned with the latest CHANGELOG section.
 */
export const RELEASE_NOTES: readonly string[] = [
  'Page transitions · pull-to-refresh on Today & Markets only',
  'Jobs pipeline mini-card · Todos “Pay rent Friday” quick-add',
  'Settings split section nav on iPad (≥900px)',
]

/** Return up to `n` bullets for the banner. */
export function releaseNotesBullets(n = 3): string[] {
  return RELEASE_NOTES.slice(0, n)
}
