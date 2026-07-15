/** Lightweight passphrase strength scoring for Settings sync UI. */

export type PassphraseStrength = {
  /** 0 (empty/weak) … 4 (strong) */
  score: number
  label: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong'
}

/**
 * Score length + character variety (upper/lower/digit/symbol).
 * Min recommended sync passphrase is 8 characters.
 */
export function scorePassphraseStrength(passphrase: string): PassphraseStrength {
  const p = passphrase ?? ''
  if (!p) return { score: 0, label: 'Empty' }

  let score = 0
  if (p.length >= 8) score += 1
  if (p.length >= 12) score += 1
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1
  if (/\d/.test(p)) score += 1
  if (/[^A-Za-z0-9]/.test(p)) score += 1
  // Cap at 4; empty already returned
  score = Math.min(4, score)

  const label: PassphraseStrength['label'] =
    score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'
  return { score, label }
}
