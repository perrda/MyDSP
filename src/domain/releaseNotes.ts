/**
 * In-app release notes shown on the PWA UpdateBanner when a new version is ready.
 * Keep 3 short bullets aligned with the latest CHANGELOG section.
 */
export const RELEASE_NOTES: readonly string[] = [
  'Today next-action stack · NW 7d/30d sparkline',
  'Spending category sparklines · Tax year progress ring',
  'Compare: how to add a second portfolio',
]

/** Return up to `n` bullets for the banner. */
export function releaseNotesBullets(n = 3): string[] {
  return RELEASE_NOTES.slice(0, n)
}
