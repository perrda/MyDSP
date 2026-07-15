/**
 * In-app release notes shown on the PWA UpdateBanner when a new version is ready.
 * Keep 3 short bullets aligned with the latest CHANGELOG section.
 */
export const RELEASE_NOTES: readonly string[] = [
  'Settings search: fuzzy match + recent section jumps',
  'Printable household snapshot (NW + allocation)',
  'Markets Cached mode banner · bundle budget · update notes',
]

/** Return up to `n` bullets for the banner. */
export function releaseNotesBullets(n = 3): string[] {
  return RELEASE_NOTES.slice(0, n)
}
