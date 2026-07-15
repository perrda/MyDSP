import { createEmptyPortfolio } from './defaults'
import type {
  CreditCard,
  CryptoHolding,
  Disposal,
  DocumentNote,
  EquityHolding,
  FamilyMember,
  FamilyState,
  FireInputsState,
  Goal,
  HistoryPoint,
  JournalEntry,
  Loan,
  MerchantRule,
  PaidOffDebt,
  PortfolioData,
  PortfolioSettings,
  SpendingEntry,
  SplitSettings,
  StakingReward,
  StakingState,
  TargetAllocations,
  Trip,
} from './types'
import { emptyFamily } from './family'
import { emptyStaking } from './staking'

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function bool(v: unknown, fallback = true): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function normalizeCrypto(raw: unknown): CryptoHolding[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      id: num(r.id, i + 1),
      symbol: str(r.symbol, '???').toUpperCase(),
      name: str(r.name, str(r.symbol, 'Unknown')),
      qty: num(r.qty ?? r.quantity),
      price: num(r.price ?? r.livePrice),
      cost: num(r.cost),
      includeInPortfolio: bool(r.includeInPortfolio, true),
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
      ragStatus: normalizeRag(r.ragStatus),
      commentaries: (() => { const c = normalizeCommentaries(r.commentaries); return c.length ? c : undefined })(),
      platform: optionalContact(r.platform),
      contactUrl: optionalContact(r.contactUrl),
    }
  })
}

function normalizeEquities(raw: unknown): EquityHolding[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const yieldRaw = r.yieldPct
    const yieldPct =
      typeof yieldRaw === 'number' && Number.isFinite(yieldRaw) && yieldRaw > 0
        ? yieldRaw
        : undefined
    return {
      id: num(r.id, i + 1),
      symbol: str(r.symbol, '???').toUpperCase(),
      name: str(r.name, str(r.symbol, 'Unknown')),
      shares: num(r.shares ?? r.qty ?? r.quantity),
      avgCost: num(r.avgCost),
      livePrice: num(r.livePrice ?? r.price ?? r.avgCost),
      includeInPortfolio: bool(r.includeInPortfolio, true),
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
      ragStatus: normalizeRag(r.ragStatus),
      commentaries: (() => { const c = normalizeCommentaries(r.commentaries); return c.length ? c : undefined })(),
      platform: optionalContact(r.platform),
      contactUrl: optionalContact(r.contactUrl),
      yieldPct,
    }
  })
}

function normalizeCommentaries(raw: unknown): import('./types').LiabilityCommentary[] {
  return asArray(raw)
    .map((item, i) => {
      const r = (item ?? {}) as Record<string, unknown>
      const created = str(r.createdAt, new Date().toISOString())
      const text = str(r.text ?? r.note ?? r.body)
      if (!text) return null
      return {
        id: num(r.id, i + 1),
        text,
        createdAt: created,
        updatedAt: str(r.updatedAt, created),
      }
    })
    .filter((c): c is import('./types').LiabilityCommentary => c != null)
}

function normalizeRag(raw: unknown): import('./types').RagStatus | undefined {
  const s = str(raw).toLowerCase()
  if (s === 'red' || s === 'amber' || s === 'green') return s
  return undefined
}

function optionalContact(v: unknown): string | undefined {
  const s = str(v).trim()
  return s || undefined
}

function normalizeCreditCards(raw: unknown): CreditCard[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const commentaries = normalizeCommentaries(r.commentaries)
    return {
      id: num(r.id, i + 1),
      name: str(r.name, 'Card'),
      balance: num(r.balance),
      apr: num(r.apr),
      minPay: num(r.minPay),
      limit: num(r.limit),
      includeInPortfolio: bool(r.includeInPortfolio, true),
      contactPhone: optionalContact(r.contactPhone),
      contactEmail: optionalContact(r.contactEmail),
      contactUrl: optionalContact(r.contactUrl),
      ragStatus: normalizeRag(r.ragStatus),
      commentaries: commentaries.length ? commentaries : undefined,
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
    }
  })
}

function normalizeLoans(raw: unknown): Loan[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const commentaries = normalizeCommentaries(r.commentaries)
    return {
      id: num(r.id, i + 1),
      name: str(r.name, 'Loan'),
      balance: num(r.balance),
      apr: num(r.apr),
      minPay: num(r.minPay),
      original: num(r.original ?? r.balance),
      includeInPortfolio: bool(r.includeInPortfolio, true),
      contactPhone: optionalContact(r.contactPhone),
      contactEmail: optionalContact(r.contactEmail),
      contactUrl: optionalContact(r.contactUrl),
      ragStatus: normalizeRag(r.ragStatus),
      commentaries: commentaries.length ? commentaries : undefined,
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
    }
  })
}

function normalizePaidOff(raw: unknown): PaidOffDebt[] {
  return asArray(raw).map((item) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      name: str(r.name, 'Paid off'),
      original: num(r.original),
      paidDate: str(r.paidDate),
    }
  })
}

function normalizeGoals(raw: unknown): Goal[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      id: num(r.id, i + 1),
      name: str(r.name, 'Goal'),
      type: str(r.type, 'networth') as Goal['type'],
      target: num(r.target),
      metric: str(r.metric, 'networth') as Goal['metric'],
      deadline: str(r.deadline),
      created: str(r.created),
      startVal: r.startVal !== undefined ? num(r.startVal) : undefined,
      ragStatus: normalizeRag(r.ragStatus),
      commentaries: (() => { const c = normalizeCommentaries(r.commentaries); return c.length ? c : undefined })(),
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
      notes: r.notes !== undefined ? str(r.notes) : undefined,
    }
  })
}

function normalizeJournal(raw: unknown): JournalEntry[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const qty = num(r.qty ?? r.quantity)
    const price = num(r.price)
    const fees = num(r.fees ?? r.fee)
    const total = num(r.total, qty * price)
    return {
      id: num(r.id, i + 1),
      date: str(r.date),
      type: str(r.type, 'buy'),
      asset: str(r.asset).toUpperCase(),
      qty,
      price,
      fees,
      total,
      notes: r.notes !== undefined ? str(r.notes) : undefined,
      tags: Array.isArray(r.tags) ? r.tags.map(String) : undefined,
      platform: r.platform !== undefined ? str(r.platform) : undefined,
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
    }
  })
}

function normalizeSpending(raw: unknown): SpendingEntry[] {
  // FCC sometimes stores spending as { transactions: [], budgets: [] }
  let source: unknown = raw
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.transactions)) source = obj.transactions
    else return []
  }
  return asArray(source).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      id: num(r.id, i + 1),
      date: str(r.date),
      amount: num(r.amount),
      description: str(r.description ?? r.merchant, 'Expense'),
      category: str(r.category, 'other'),
      method: str(r.method, 'debit'),
      location: r.location !== undefined ? str(r.location) : undefined,
      tripId: (r.tripId as number | null | undefined) ?? null,
      paidBy: r.paidBy !== undefined ? str(r.paidBy) : undefined,
      split: r.split !== undefined ? str(r.split) : undefined,
      notes: r.notes !== undefined ? str(r.notes) : undefined,
      createdAt: r.createdAt !== undefined ? str(r.createdAt) : undefined,
    }
  })
}

function normalizeRecurring(raw: unknown): import('./types').RecurringTransaction[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const freq = str(r.frequency, 'monthly')
    return {
      id: num(r.id, i + 1),
      name: str(r.name, 'Recurring'),
      amount: num(r.amount),
      frequency:
        freq === 'weekly' || freq === 'yearly' ? freq : 'monthly',
      category: str(r.category, 'other'),
      nextDue: str(r.nextDue, new Date().toISOString().slice(0, 10)),
      createdAt: r.createdAt !== undefined ? str(r.createdAt) : undefined,
    }
  })
}

function normalizeBudgetGoals(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim().toLowerCase()
    if (!key) continue
    const n = num(v)
    if (n > 0) out[key] = Math.max(out[key] ?? 0, n)
  }
  return out
}

function normalizeTrips(raw: unknown): Trip[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      id: num(r.id, i + 1),
      name: str(r.name, 'Trip'),
      startDate: r.startDate !== undefined ? str(r.startDate) : undefined,
      endDate: r.endDate === null ? null : r.endDate !== undefined ? str(r.endDate) : undefined,
      budget: r.budget === null || r.budget === undefined ? null : num(r.budget),
      icon: r.icon !== undefined ? str(r.icon) : undefined,
      notes: r.notes !== undefined ? str(r.notes) : undefined,
      completed: bool(r.completed, false),
      createdAt: str(r.createdAt, new Date().toISOString()),
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
    }
  })
}

function normalizeSplitSettings(raw: unknown): SplitSettings {
  const empty = createEmptyPortfolio().splitSettings
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const p1 = (r.person1 ?? {}) as Record<string, unknown>
  const p2 = (r.person2 ?? {}) as Record<string, unknown>
  return {
    person1: {
      name: str(p1.name, empty.person1.name),
      color: p1.color !== undefined ? str(p1.color) : empty.person1.color,
    },
    person2: {
      name: str(p2.name, empty.person2.name),
      color: p2.color !== undefined ? str(p2.color) : empty.person2.color,
    },
  }
}

function normalizeTargetAllocations(raw: unknown): TargetAllocations {
  const empty = createEmptyPortfolio().targetAllocations
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    equity: num(r.equity, empty.equity),
    crypto: num(r.crypto, empty.crypto),
    cash: num(r.cash, empty.cash),
  }
}

function normalizeMerchantRules(raw: unknown): MerchantRule[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const matchType = str(r.matchType, 'contains')
    return {
      id: num(r.id, i + 1),
      pattern: str(r.pattern),
      matchType:
        matchType === 'startsWith' || matchType === 'regex' ? matchType : 'contains',
      category: str(r.category, 'other'),
      priority: r.priority !== undefined ? num(r.priority) : undefined,
    }
  })
}

function normalizeHistory(raw: unknown): HistoryPoint[] {
  return asArray(raw).map((item) => {
    const r = (item ?? {}) as Record<string, unknown>
    const source = str(r.source, '')
    return {
      date: str(r.date).slice(0, 10),
      netWorth: num(r.netWorth ?? r.networth),
      assets: r.assets !== undefined ? num(r.assets) : undefined,
      crypto: r.crypto !== undefined ? num(r.crypto) : undefined,
      equity: r.equity !== undefined ? num(r.equity ?? r.equities) : undefined,
      liabilities: r.liabilities !== undefined ? num(r.liabilities) : undefined,
      notes: r.notes !== undefined ? str(r.notes) : undefined,
      source:
        source === 'manual' || source === 'import' || source === 'auto' ? source : undefined,
    }
  })
}

function normalizeStaking(raw: unknown, legacyRewards: unknown): StakingState {
  const empty = emptyStaking()
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    const pool = (r.pool ?? {}) as Record<string, unknown>
    const rewards = asArray(r.rewards).map((item) => {
      const x = (item ?? {}) as Record<string, unknown>
      return {
        epoch: num(x.epoch),
        amount: num(x.amount),
        date: str(x.date),
        stake: x.stake !== undefined ? num(x.stake) : undefined,
        priceAtTime: x.priceAtTime !== undefined ? num(x.priceAtTime) : undefined,
        notes: x.notes !== undefined ? str(x.notes) : undefined,
        pool: x.pool !== undefined ? str(x.pool) : undefined,
        addedAt: x.addedAt !== undefined ? str(x.addedAt) : undefined,
        sortOrder: x.sortOrder !== undefined ? num(x.sortOrder) : undefined,
      } satisfies StakingReward
    })
    return {
      pool: {
        name: str(pool.name, empty.pool.name),
        ticker: pool.ticker !== undefined ? str(pool.ticker) : empty.pool.ticker,
        margin: pool.margin !== undefined ? num(pool.margin) : undefined,
        pledge: pool.pledge !== undefined ? num(pool.pledge) : undefined,
      },
      rewards,
    }
  }
  if (Array.isArray(legacyRewards) && legacyRewards.length) {
    return {
      ...empty,
      rewards: asArray(legacyRewards).map((item) => {
        const x = (item ?? {}) as Record<string, unknown>
        return {
          epoch: num(x.epoch),
          amount: num(x.amount),
          date: str(x.date),
          stake: x.stake !== undefined ? num(x.stake) : undefined,
          priceAtTime: x.priceAtTime !== undefined ? num(x.priceAtTime) : undefined,
          notes: x.notes !== undefined ? str(x.notes) : undefined,
        }
      }),
    }
  }
  return empty
}

function normalizeFamily(raw: unknown): FamilyState {
  const empty = emptyFamily()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const settings = (r.settings ?? {}) as Record<string, unknown>
  const members = asArray(r.members).map((item, i) => {
    const m = (item ?? {}) as Record<string, unknown>
    const type = str(m.type, 'other')
    return {
      id: str(m.id, `member_${i}`),
      name: str(m.name, 'Member'),
      role: str(m.role, 'Member'),
      type:
        type === 'primary' || type === 'partner' || type === 'child' || type === 'other'
          ? type
          : 'other',
      isActive: bool(m.isActive, true),
      portfolioId: m.portfolioId !== undefined ? str(m.portfolioId) : undefined,
      networth: m.networth !== undefined ? num(m.networth) : undefined,
      assets: m.assets !== undefined ? num(m.assets) : undefined,
      debt: m.debt !== undefined ? num(m.debt) : undefined,
    } satisfies FamilyMember
  })
  return {
    members: members.length ? members : empty.members,
    settings: {
      combined: bool(settings.combined, true),
      shareDebt: bool(settings.shareDebt, true),
      familyPrivacy: bool(settings.familyPrivacy, false),
    },
  }
}

function normalizeCustomDocuments(
  raw: unknown,
): import('./job-types').JobApplication['customDocuments'] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((d, i) => ({
      name: str(d.name, `Document ${i + 1}`),
      url: typeof d.url === 'string' && d.url.trim() ? d.url.trim() : undefined,
      notes: typeof d.notes === 'string' && d.notes.trim() ? d.notes.trim() : undefined,
      blobDocId: typeof d.blobDocId === 'number' ? d.blobDocId : num(d.blobDocId) || undefined,
      fileName: typeof d.fileName === 'string' ? d.fileName : undefined,
      mimeType: typeof d.mimeType === 'string' ? d.mimeType : undefined,
      size: typeof d.size === 'number' ? d.size : undefined,
      hasBlob: Boolean(d.hasBlob),
    }))
    .filter((d) => d.name)
}

const DOC_LINKED_KINDS = new Set(['card', 'loan', 'crypto', 'equity', 'trip', 'goal', 'job'])
const JOB_STATUSES = new Set([
  'wishlist',
  'researching',
  'applying',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'archived',
])

function normalizeDocuments(raw: unknown): DocumentNote[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    const kindRaw = r.linkedKind !== undefined ? str(r.linkedKind) : ''
    return {
      id: num(r.id, i + 1),
      name: str(r.name, 'Document'),
      note: r.note !== undefined ? str(r.note) : undefined,
      createdAt: str(r.createdAt, new Date().toISOString()),
      sortOrder: r.sortOrder !== undefined ? num(r.sortOrder, i) : undefined,
      fileName: r.fileName !== undefined ? str(r.fileName) : undefined,
      mimeType: r.mimeType !== undefined ? str(r.mimeType) : undefined,
      size: r.size !== undefined ? num(r.size) : undefined,
      hasBlob: Boolean(r.hasBlob),
      linkedKind: DOC_LINKED_KINDS.has(kindRaw)
        ? (kindRaw as DocumentNote['linkedKind'])
        : undefined,
      linkedId: r.linkedId !== undefined ? num(r.linkedId) : undefined,
    }
  })
}

function normalizeCustomCategories(raw: unknown): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of asArray(raw)) {
    const c = str(item).trim().toLowerCase()
    if (!c || seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

function normalizeDisposals(raw: unknown): Disposal[] {
  return asArray(raw).map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>
    return {
      id: num(r.id, i + 1),
      date: str(r.date),
      assetType: r.assetType === 'equity' ? 'equity' : 'crypto',
      symbol: str(r.symbol ?? r.asset, '???').toUpperCase(),
      qty: num(r.qty ?? r.quantity),
      proceeds: num(r.proceeds),
      cost: num(r.cost),
    }
  })
}

function normalizeFireInputs(raw: unknown): FireInputsState {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    expenses: num(r.expenses, 30000),
    savings: num(r.savings, 1500),
    returnRate: num(r.returnRate, 7),
    age: num(r.age, 40),
    swr: num(r.swr, 4),
    pensionAge: num(r.pensionAge, 60),
  }
}

const TAX_RESIDENCY_RE = /^[A-Za-z]{2}$/

export function normalizeTaxResidency(raw: unknown): string {
  const v = str(raw, 'GB').toUpperCase()
  if (v === 'OTHER' || v === 'XX') return 'XX'
  return TAX_RESIDENCY_RE.test(v) ? v : 'GB'
}

function normalizeSettings(raw: unknown): PortfolioSettings {
  const r = (raw ?? {}) as Record<string, unknown>
  const currency = str(r.currency, 'GBP').toUpperCase() || 'GBP'
  return {
    theme: r.theme === 'light' ? 'light' : 'dark',
    privacy: Boolean(r.privacy),
    currency,
    taxResidency: normalizeTaxResidency(r.taxResidency),
    collapsed:
      r.collapsed && typeof r.collapsed === 'object'
        ? (r.collapsed as Record<string, boolean>)
        : {},
    finnhubKey: r.finnhubKey !== undefined ? str(r.finnhubKey) : undefined,
    lastBackup: r.lastBackup !== undefined ? str(r.lastBackup) : undefined,
    lastPriceUpdate: r.lastPriceUpdate !== undefined ? str(r.lastPriceUpdate) : undefined,
    manualCryptoPrices:
      r.manualCryptoPrices && typeof r.manualCryptoPrices === 'object'
        ? (r.manualCryptoPrices as Record<string, number>)
        : undefined,
  }
}

const KNOWN_KEYS = new Set([
  'crypto',
  'equities',
  'equity',
  'creditCards',
  'loans',
  'paidOff',
  'goals',
  'journal',
  'transactions',
  'spending',
  'recurringTransactions',
  'budgetGoals',
  'trips',
  'splitSettings',
  'targetAllocations',
  'merchantRules',
  'staking',
  'family',
  'familyMembers',
  'familySettings',
  'history',
  'disposals',
  'fireInputs',
  'monthlyIncome',
  'monthlyExpenses',
  'settings',
  'version',
  'documents',
  'customCategories',
  'stakingRewards',
  'alerts',
  'versions',
  'todoLists',
  'todoItems',
  'jobApplications',
])

function normalizeTodoLists(raw: unknown): import('./todo-types').TodoList[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x, i) => ({
      id: num(x.id, Date.now() + i),
      name: str(x.name, 'Untitled list'),
      description: typeof x.description === 'string' ? x.description : undefined,
      color: typeof x.color === 'string' ? x.color : undefined,
      icon: typeof x.icon === 'string' ? x.icon : undefined,
      sortOrder: typeof x.sortOrder === 'number' ? x.sortOrder : i,
      createdAt: str(x.createdAt, new Date().toISOString()),
      updatedAt: str(x.updatedAt, new Date().toISOString()),
    }))
}

function normalizeTodoItems(raw: unknown): import('./todo-types').TodoItem[] {
  if (!Array.isArray(raw)) return []
  const priorities = new Set(['high', 'medium', 'low'])
  const statuses = new Set(['todo', 'in-progress', 'done', 'archived'])
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x, i) => {
      const priority = priorities.has(String(x.priority)) ? (x.priority as 'high' | 'medium' | 'low') : 'medium'
      const status = statuses.has(String(x.status))
        ? (x.status as 'todo' | 'in-progress' | 'done' | 'archived')
        : 'todo'
      return {
        id: num(x.id, Date.now() + i),
        listId: num(x.listId, 0),
        title: str(x.title, 'Untitled'),
        description: typeof x.description === 'string' ? x.description : undefined,
        priority,
        status,
        dueDate: typeof x.dueDate === 'string' ? x.dueDate : undefined,
        dueTime: typeof x.dueTime === 'string' ? x.dueTime : undefined,
        reminderDate: typeof x.reminderDate === 'string' ? x.reminderDate : undefined,
        reminderTime: typeof x.reminderTime === 'string' ? x.reminderTime : undefined,
        tags: Array.isArray(x.tags) ? x.tags.map(String) : [],
        isFinanceRelated: bool(x.isFinanceRelated, false),
        estimatedMinutes: typeof x.estimatedMinutes === 'number' ? x.estimatedMinutes : undefined,
        actualMinutes: typeof x.actualMinutes === 'number' ? x.actualMinutes : undefined,
        completedAt: typeof x.completedAt === 'string' ? x.completedAt : undefined,
        createdAt: str(x.createdAt, new Date().toISOString()),
        updatedAt: str(x.updatedAt, new Date().toISOString()),
        sortOrder: typeof x.sortOrder === 'number' ? x.sortOrder : undefined,
        linkedJobId: (() => {
          const n = num(x.linkedJobId, NaN)
          return Number.isFinite(n) && n > 0 ? n : undefined
        })(),
      }
    })
}

function normalizeJobApplications(raw: unknown): import('./job-types').JobApplication[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x, i) => {
      const base = {
        id: num(x.id, Date.now() + i),
        companyName: str(x.companyName, 'Unknown company'),
        jobTitle: str(x.jobTitle, 'Untitled role'),
        status: (JOB_STATUSES.has(String(x.status))
          ? String(x.status)
          : 'wishlist') as import('./job-types').JobStatus,
        priority: (['high', 'medium', 'low'].includes(String(x.priority))
          ? x.priority
          : 'medium') as 'high' | 'medium' | 'low',
        jobUrl: typeof x.jobUrl === 'string' ? x.jobUrl : undefined,
        companyWebsite: typeof x.companyWebsite === 'string' ? x.companyWebsite : undefined,
        linkedInUrl: typeof x.linkedInUrl === 'string' ? x.linkedInUrl : undefined,
        applicationPortalUrl: typeof x.applicationPortalUrl === 'string' ? x.applicationPortalUrl : undefined,
        appliedDate: typeof x.appliedDate === 'string' ? x.appliedDate : undefined,
        deadline: typeof x.deadline === 'string' ? x.deadline : undefined,
        source: str(x.source, 'Direct'),
        referralContact: typeof x.referralContact === 'string' ? x.referralContact : undefined,
        salaryMin: typeof x.salaryMin === 'number' ? x.salaryMin : undefined,
        salaryMax: typeof x.salaryMax === 'number' ? x.salaryMax : undefined,
        salaryCurrency: str(x.salaryCurrency, 'GBP'),
        salaryPeriod: (typeof x.salaryPeriod === 'string' ? x.salaryPeriod : 'annual') as import('./job-types').SalaryPeriod,
        equity: typeof x.equity === 'string' ? x.equity : undefined,
        benefits: typeof x.benefits === 'string' ? x.benefits : undefined,
        location: str(x.location, 'Unknown'),
        remote: (['onsite', 'hybrid', 'remote'].includes(String(x.remote))
          ? x.remote
          : 'onsite') as 'onsite' | 'hybrid' | 'remote',
        jobType: (['full-time', 'part-time', 'contract', 'internship'].includes(String(x.jobType))
          ? x.jobType
          : 'full-time') as 'full-time' | 'part-time' | 'contract' | 'internship',
        description: typeof x.description === 'string' ? x.description : undefined,
        requirements: typeof x.requirements === 'string' ? x.requirements : undefined,
        responsibilities: typeof x.responsibilities === 'string' ? x.responsibilities : undefined,
        cvVersion: typeof x.cvVersion === 'string' ? x.cvVersion : undefined,
        coverLetterVersion: typeof x.coverLetterVersion === 'string' ? x.coverLetterVersion : undefined,
        portfolioUrl: typeof x.portfolioUrl === 'string' ? x.portfolioUrl : undefined,
        customDocuments: normalizeCustomDocuments(x.customDocuments),
        interviews: Array.isArray(x.interviews) ? (x.interviews as import('./job-types').JobApplication['interviews']) : [],
        notes: Array.isArray(x.notes) ? (x.notes as import('./job-types').JobApplication['notes']) : [],
        contacts: Array.isArray(x.contacts) ? (x.contacts as import('./job-types').JobApplication['contacts']) : [],
        tasks: Array.isArray(x.tasks) ? (x.tasks as import('./job-types').JobApplication['tasks']) : [],
        rating: num(x.rating, 0),
        pros: typeof x.pros === 'string' ? x.pros : undefined,
        cons: typeof x.cons === 'string' ? x.cons : undefined,
        tags: Array.isArray(x.tags) ? x.tags.map(String) : [],
        createdAt: str(x.createdAt, new Date().toISOString()),
        updatedAt: str(x.updatedAt, new Date().toISOString()),
        sortOrder: typeof x.sortOrder === 'number' ? x.sortOrder : undefined,
        rejectionReason: typeof x.rejectionReason === 'string' ? x.rejectionReason : undefined,
        offerDetails: typeof x.offerDetails === 'string' ? x.offerDetails : undefined,
      }
      return base
    })
}

export function normalizePortfolio(raw: unknown): PortfolioData {
  const empty = createEmptyPortfolio()
  if (!raw || typeof raw !== 'object') return empty

  const r = raw as Record<string, unknown>
  const journalSource = asArray(r.journal).length ? r.journal : r.transactions

  const extras: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(r)) {
    if (!KNOWN_KEYS.has(k)) extras[k] = v
  }

  const familyRaw =
    r.family ??
    (r.familyMembers || r.familySettings
      ? { members: r.familyMembers, settings: r.familySettings }
      : extras.family)

  return {
    version: num(r.version, 1),
    crypto: normalizeCrypto(r.crypto),
    equities: normalizeEquities(r.equities ?? r.equity),
    creditCards: normalizeCreditCards(r.creditCards),
    loans: normalizeLoans(r.loans),
    paidOff: normalizePaidOff(r.paidOff),
    goals: normalizeGoals(r.goals),
    journal: normalizeJournal(journalSource),
    spending: normalizeSpending(r.spending),
    recurringTransactions: normalizeRecurring(r.recurringTransactions),
    budgetGoals: normalizeBudgetGoals(r.budgetGoals),
    trips: normalizeTrips(r.trips ?? extras.trips),
    splitSettings: normalizeSplitSettings(r.splitSettings ?? extras.splitSettings),
    targetAllocations: normalizeTargetAllocations(
      r.targetAllocations ?? extras.targetAllocations,
    ),
    merchantRules: normalizeMerchantRules(r.merchantRules ?? extras.merchantRules),
    staking: normalizeStaking(r.staking ?? extras.staking, r.stakingRewards ?? extras.stakingRewards),
    family: normalizeFamily(familyRaw),
    history: normalizeHistory(r.history),
    disposals: normalizeDisposals(r.disposals),
    fireInputs: normalizeFireInputs(r.fireInputs),
    monthlyIncome: num(r.monthlyIncome),
    monthlyExpenses: num(r.monthlyExpenses),
    settings: normalizeSettings(r.settings),
    customCategories: normalizeCustomCategories(r.customCategories ?? extras.customCategories),
    documents: normalizeDocuments(r.documents ?? extras.documents),
    todoLists: normalizeTodoLists(r.todoLists),
    todoItems: normalizeTodoItems(r.todoItems),
    jobApplications: normalizeJobApplications(r.jobApplications),
    extras: Object.fromEntries(
      Object.entries(extras).filter(
        ([k]) =>
          ![
            'trips',
            'splitSettings',
            'targetAllocations',
            'merchantRules',
            'staking',
            'family',
            'stakingRewards',
            'customCategories',
            'documents',
            'todoLists',
            'todoItems',
            'jobApplications',
          ].includes(k),
      ),
    ),
  }
}

export function toStorageShape(data: PortfolioData): Record<string, unknown> {
  const journal = data.journal.map((j) => ({
    ...j,
    quantity: j.qty,
    fee: j.fees,
  }))
  return {
    ...data.extras,
    version: data.version,
    crypto: data.crypto,
    equities: data.equities,
    creditCards: data.creditCards,
    loans: data.loans,
    paidOff: data.paidOff,
    goals: data.goals,
    journal,
    transactions: journal,
    spending: data.spending,
    recurringTransactions: data.recurringTransactions,
    budgetGoals: data.budgetGoals,
    trips: data.trips,
    splitSettings: data.splitSettings,
    targetAllocations: data.targetAllocations,
    merchantRules: data.merchantRules,
    staking: data.staking,
    family: data.family,
    familyMembers: data.family.members,
    familySettings: data.family.settings,
    history: data.history.map((h) => ({
      ...h,
      networth: h.netWorth,
    })),
    disposals: data.disposals,
    fireInputs: data.fireInputs,
    monthlyIncome: data.monthlyIncome,
    monthlyExpenses: data.monthlyExpenses,
    customCategories: data.customCategories,
    documents: data.documents,
    todoLists: data.todoLists ?? [],
    todoItems: data.todoItems ?? [],
    jobApplications: data.jobApplications ?? [],
    settings: {
      ...data.settings,
      _explicitCurrency: true,
    },
  }
}
