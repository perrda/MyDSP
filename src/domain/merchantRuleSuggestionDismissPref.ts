/** Dismissed merchant-rule suggestion patterns — syncs via fullArchive (LWW). */

const KEY = 'mydsp_merchant_rule_suggestion_dismiss_v1'
const EVENT = 'mydsp-merchant-rule-suggestion-dismiss'

export type MerchantRuleSuggestionDismissBackup = {
  patterns: string[]
  updatedAt: string
}

function normalizePattern(pattern: string): string {
  return pattern.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function readPayload(): MerchantRuleSuggestionDismissBackup {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as
      | Partial<MerchantRuleSuggestionDismissBackup>
      | null
    const patterns = Array.isArray(parsed?.patterns)
      ? [...new Set(parsed.patterns.map((p) => normalizePattern(String(p))).filter(Boolean))]
      : []
    return {
      patterns,
      updatedAt:
        typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return { patterns: [], updatedAt: new Date(0).toISOString() }
  }
}

function writePayload(payload: MerchantRuleSuggestionDismissBackup, opts?: { markDirty?: boolean; fromSync?: boolean }): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* private mode */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function loadDismissedMerchantRulePatterns(): string[] {
  return readPayload().patterns
}

export function isMerchantRuleSuggestionDismissed(pattern: string): boolean {
  const key = normalizePattern(pattern)
  return key ? loadDismissedMerchantRulePatterns().includes(key) : false
}

export function dismissMerchantRuleSuggestion(
  pattern: string,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): string[] {
  const key = normalizePattern(pattern)
  if (!key) return loadDismissedMerchantRulePatterns()
  const current = readPayload()
  if (current.patterns.includes(key)) return current.patterns
  const next = {
    patterns: [...current.patterns, key],
    updatedAt: new Date().toISOString(),
  }
  writePayload(next, opts)
  return next.patterns
}

export function clearMerchantRuleSuggestionDismissals(
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  writePayload({ patterns: [], updatedAt: new Date().toISOString() }, opts)
}

export function subscribeMerchantRuleSuggestionDismiss(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

export function exportMerchantRuleSuggestionDismissForBackup(): MerchantRuleSuggestionDismissBackup | null {
  try {
    if (localStorage.getItem(KEY) == null) return null
    return readPayload()
  } catch {
    return null
  }
}

export function importMerchantRuleSuggestionDismissFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as Partial<MerchantRuleSuggestionDismissBackup>
  if (!Array.isArray(remote.patterns)) return
  const local = exportMerchantRuleSuggestionDismissForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  writePayload(
    {
      patterns: [...new Set(remote.patterns.map((p) => normalizePattern(String(p))).filter(Boolean))],
      updatedAt:
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date().toISOString(),
    },
    { markDirty: false, fromSync: true },
  )
}
