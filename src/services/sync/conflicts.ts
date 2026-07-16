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
  | 'todoItems'
  | 'todoLists'
  | 'jobApplications'
  | 'documents'

export interface FieldDiff {
  field: string
  local: string
  remote: string
}

export interface SyncConflict {
  portfolioId: string
  collection: ConflictCollection
  id: number
  localLabel: string
  remoteLabel: string
  /** Changed fields for clearer resolution UX */
  fieldDiffs?: FieldDiff[]
}

export type ConflictChoice = 'local' | 'remote'

function stableHash(value: unknown): string {
  const s = value === undefined ? 'undefined' : JSON.stringify(value) ?? 'null'
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function labelOf(item: Record<string, unknown>, collection: ConflictCollection): string {
  if (collection === 'jobApplications') {
    const company = typeof item.companyName === 'string' ? item.companyName : ''
    const title = typeof item.jobTitle === 'string' ? item.jobTitle : ''
    return [company, title].filter(Boolean).join(' — ') || `#${item.id}`
  }
  if (collection === 'todoItems') {
    return (typeof item.title === 'string' && item.title) || `#${item.id}`
  }
  if (collection === 'todoLists') {
    return (typeof item.name === 'string' && item.name) || `#${item.id}`
  }
  const symbol = typeof item.symbol === 'string' ? item.symbol : ''
  const name = typeof item.name === 'string' ? item.name : ''
  const desc = typeof item.description === 'string' ? item.description : ''
  const asset = typeof item.asset === 'string' ? item.asset : ''
  return symbol || name || desc || asset || `#${item.id}`
}

const SKIP_FIELDS = new Set(['updatedAt', 'createdAt', 'sortOrder'])

export function diffFields(local: Record<string, unknown>, remote: Record<string, unknown>): FieldDiff[] {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const diffs: FieldDiff[] = []
  for (const field of keys) {
    if (SKIP_FIELDS.has(field)) continue
    const lv = local[field]
    const rv = remote[field]
    if (stableHash(lv) === stableHash(rv)) continue
    const fmt = (v: unknown) => {
      if (v == null) return '—'
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
      try {
        const s = JSON.stringify(v)
        return s.length > 80 ? `${s.slice(0, 77)}…` : s
      } catch {
        return String(v)
      }
    }
    diffs.push({ field, local: fmt(lv), remote: fmt(rv) })
  }
  return diffs.slice(0, 12)
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
  'todoItems',
  'todoLists',
  'jobApplications',
  'documents',
]

export function detectConflicts(
  portfolioId: string,
  local: PortfolioData,
  remote: PortfolioData,
): SyncConflict[] {
  const out: SyncConflict[] = []
  for (const collection of COLLECTIONS) {
    const localArr = (local[collection] as { id: number }[] | undefined) ?? []
    const remoteArr = (remote[collection] as { id: number }[] | undefined) ?? []
    const remoteMap = new Map(remoteArr.map((x) => [x.id, x]))
    for (const loc of localArr) {
      const rem = remoteMap.get(loc.id)
      if (!rem) continue
      if (stableHash(loc) === stableHash(rem)) continue
      out.push({
        portfolioId,
        collection,
        id: loc.id,
        localLabel: labelOf(loc as unknown as Record<string, unknown>, collection),
        remoteLabel: labelOf(rem as unknown as Record<string, unknown>, collection),
        fieldDiffs: diffFields(
          loc as unknown as Record<string, unknown>,
          rem as unknown as Record<string, unknown>,
        ),
      })
    }
  }
  return out
}

export function conflictKey(c: Pick<SyncConflict, 'collection' | 'id'>): string {
  return `${c.collection}:${c.id}`
}

const COLLECTION_LABEL: Record<ConflictCollection, string> = {
  crypto: 'crypto holding',
  equities: 'equity holding',
  creditCards: 'credit card',
  loans: 'loan',
  spending: 'spending row',
  goals: 'goal',
  journal: 'journal entry',
  disposals: 'disposal',
  todoItems: "To Do",
  todoLists: "To Do list",
  jobApplications: 'job application',
  documents: 'document',
}

/** One-line plain-English summary for conflict review UI. */
export function summarizeConflict(c: SyncConflict): string {
  const kind = COLLECTION_LABEL[c.collection] ?? c.collection
  const label = c.localLabel || c.remoteLabel || `#${c.id}`
  const fields = (c.fieldDiffs ?? []).slice(0, 3).map((d) => d.field)
  if (fields.length === 0) {
    return `This ${kind} (“${label}”) differs between devices.`
  }
  return `This ${kind} (“${label}”) changed on ${fields.join(', ')} — pick which device to keep.`
}

/** Short portfolio-level blurb for a conflict batch. */
export function summarizeConflictBatch(conflicts: SyncConflict[]): string {
  if (conflicts.length === 0) return 'No conflicts.'
  const byCollection = new Map<string, number>()
  for (const c of conflicts) {
    byCollection.set(c.collection, (byCollection.get(c.collection) ?? 0) + 1)
  }
  const parts = [...byCollection.entries()].map(([col, n]) => {
    const label = COLLECTION_LABEL[col as ConflictCollection] ?? col
    return `${n} ${label}${n === 1 ? '' : 's'}`
  })
  return `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}: ${parts.join(', ')}.`
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
    todoItems: apply('todoItems', base.todoItems ?? [], local.todoItems ?? [], remote.todoItems ?? []),
    todoLists: apply('todoLists', base.todoLists ?? [], local.todoLists ?? [], remote.todoLists ?? []),
    jobApplications: apply(
      'jobApplications',
      base.jobApplications ?? [],
      local.jobApplications ?? [],
      remote.jobApplications ?? [],
    ),
    documents: apply('documents', base.documents ?? [], local.documents ?? [], remote.documents ?? []),
  }
}
