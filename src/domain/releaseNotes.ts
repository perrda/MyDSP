/**
 * In-app release notes shown on the PWA UpdateBanner when a new version is ready.
 * Keep 3 short bullets aligned with the latest CHANGELOG section.
 */
export const RELEASE_NOTES: readonly string[] = [
  'Dry-run pull + device nickname on sync activity',
  'Biometric unlock timeout: Immediate / 1m / 5m / 15m',
  'Sync setup URL share (no passphrase) · auto-resume after pause',
]

/** Return up to `n` bullets for the banner. */
export function releaseNotesBullets(n = 3): string[] {
  return RELEASE_NOTES.slice(0, n)
}
