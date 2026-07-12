/** Detect sync entity conflicts between local and remote portfolios. */

import type { PortfolioData } from '../../domain/types'
import { mergePortfolio } from './merge'

export type ConflictCollection =
  | 'crypto'
  | 'equities'
  | 'creditCards'
  | 'loans'
  | 'spending'
  | 'goals'
  | 'journal'
  | 'disposals'

export interface SyncConflict {
  portfolioId: string
  collection: ConflictCollection
  id: number
  localLabel: string
  remoteLabel: string
}

export type ConflictChoice = 'local' | 'remote'

function stableHash(value: unknown): string {
  const s = JSON.stringify(value)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function labelOf(item: Record<string, unknown>): string {
  const symbol = typeof item.symbol === 'string' ? item.symbol : ''
  const name = typeof item.name === 'string' ? item.name : ''
  const desc = typeof item.description === 'string' ? item.description : ''
  const asset = typeof item.asset === 'string' ? item.asset : ''
  return symbol || name || desc || asset || `#${item.id}`
}

const COLLECTIONS: ConflictCollection[] = [
  'crypto',
  'equities',
  'creditCards',
  'loans',
  'spending',
  'goals',
  'journal',
  'disposals',
]

export function detectConflicts(
  portfolioId: string,
  local: PortfolioData,
  remote: PortfolioData,
): SyncConflict[] {
  const out: SyncConflict[] = []
  for (const collection of COLLECTIONS) {
    const localArr = local[collection] as { id: number }[]
    const remoteArr = remote[collection] as { id: number }[]
    const remoteMap = new Map(remoteArr.map((x) => [x.id, x]))
    for (const loc of localArr) {
      const rem = remoteMap.get(loc.id)
      if (!rem) continue
      if (stableHash(loc) === stableHash(rem)) continue
      out.push({
        portfolioId,
        collection,
        id: loc.id,
        localLabel: labelOf(loc as unknown as Record<string, unknown>),
        remoteLabel: labelOf(rem as unknown as Record<string, unknown>),
      })
    }
  }
  return out
}

export function conflictKey(c: Pick<SyncConflict, 'collection' | 'id'>): string {
  return `${c.collection}:${c.id}`
}

/**
 * Apply union merge, then overwrite conflicting IDs per user choice.
 * Default (no choice) keeps local for conflicting rows.
 */
export function mergeWithResolutions(
  local: PortfolioData,
  remote: PortfolioData,
  resolutions: Record<string, ConflictChoice> = {},
): PortfolioData {
  const base = mergePortfolio(local, remote)

  const apply = <T extends { id: number }>(
    collection: ConflictCollection,
    merged: T[],
    localArr: T[],
    remoteArr: T[],
  ): T[] => {
    const localMap = new Map(localArr.map((x) => [x.id, x]))
    const remoteMap = new Map(remoteArr.map((x) => [x.id, x]))
    return merged.map((row) => {
      const key = `${collection}:${row.id}`
      const choice = resolutions[key]
      if (!choice) {
        // Prefer local when both sides differ
        if (localMap.has(row.id) && remoteMap.has(row.id)) {
          const loc = localMap.get(row.id)!
          const rem = remoteMap.get(row.id)!
          if (stableHash(loc) !== stableHash(rem)) return loc
        }
        return row
      }
      if (choice === 'local') return localMap.get(row.id) ?? row
      return remoteMap.get(row.id) ?? row
    })
  }

  return {
    ...base,
    crypto: apply('crypto', base.crypto, local.crypto, remote.crypto),
    equities: apply('equities', base.equities, local.equities, remote.equities),
    creditCards: apply('creditCards', base.creditCards, local.creditCards, remote.creditCards),
    loans: apply('loans', base.loans, local.loans, remote.loans),
    spending: apply('spending', base.spending, local.spending, remote.spending),
    goals: apply('goals', base.goals, local.goals, remote.goals),
    journal: apply('journal', base.journal, local.journal, remote.journal),
    disposals: apply('disposals', base.disposals, local.disposals, remote.disposals),
  }
}
