/** Normalized MyDSP / FCC-compatible portfolio domain types. */

import type { TodoItem, TodoList } from './todo-types'
import type { JobApplication } from './job-types'

export type GoalType = 'debt' | 'networth' | 'investment'
export type GoalMetric = 'cc' | 'networth' | 'debt' | 'equity' | 'crypto'

export type JournalType = 'buy' | 'sell' | 'staking' | 'transfer' | string

export type SpendingCategory =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'bills'
  | 'health'
  | 'travel'
  | 'subscriptions'
  | 'cash'
  | 'other'
  | string

export type PaymentMethod = 'credit' | 'debit' | 'cash' | 'transfer' | string

export type RagStatus = 'red' | 'amber' | 'green'

/** Timestamped progress notes (liabilities, holdings, goals). */
export interface ProgressCommentary {
  id: number
  text: string
  createdAt: string
  updatedAt: string
}

/** @deprecated Prefer ProgressCommentary — kept for FCC-compatible naming. */
export type LiabilityCommentary = ProgressCommentary

export interface CryptoHolding {
  id: number
  symbol: string
  name: string
  qty: number
  price: number
  cost: number
  includeInPortfolio?: boolean
  sortOrder?: number
  ragStatus?: RagStatus
  commentaries?: ProgressCommentary[]
  platform?: string
  contactUrl?: string
}

export interface EquityHolding {
  id: number
  symbol: string
  name: string
  shares: number
  avgCost: number
  livePrice: number
  includeInPortfolio?: boolean
  sortOrder?: number
  ragStatus?: RagStatus
  commentaries?: ProgressCommentary[]
  platform?: string
  contactUrl?: string
}

export interface CreditCard {
  id: number
  name: string
  balance: number
  apr: number
  minPay: number
  limit: number
  includeInPortfolio?: boolean
  contactPhone?: string
  contactEmail?: string
  contactUrl?: string
  ragStatus?: RagStatus
  commentaries?: ProgressCommentary[]
  sortOrder?: number
}

export interface Loan {
  id: number
  name: string
  balance: number
  apr: number
  minPay: number
  original: number
  includeInPortfolio?: boolean
  contactPhone?: string
  contactEmail?: string
  contactUrl?: string
  ragStatus?: RagStatus
  commentaries?: ProgressCommentary[]
  sortOrder?: number
}

export interface PaidOffDebt {
  name: string
  original: number
  paidDate: string
}

export interface Goal {
  id: number
  name: string
  type: GoalType
  target: number
  metric: GoalMetric
  deadline: string
  created: string
  startVal?: number
  ragStatus?: RagStatus
  commentaries?: ProgressCommentary[]
  sortOrder?: number
  notes?: string
}

export interface JournalEntry {
  id: number
  date: string
  type: JournalType
  asset: string
  qty: number
  price: number
  fees: number
  total: number
  notes?: string
  tags?: string[]
  platform?: string
  sortOrder?: number
}

export interface SpendingEntry {
  id: number
  date: string
  amount: number
  description: string
  category: SpendingCategory
  method: PaymentMethod
  location?: string
  tripId?: number | null
  paidBy?: string
  split?: string
  notes?: string
  createdAt?: string
}

export interface HistoryPoint {
  date: string
  /** ISO datetime for intraday points (1D charts). */
  at?: string
  netWorth: number
  assets?: number
  crypto?: number
  equity?: number
  liabilities?: number
  notes?: string
  source?: 'auto' | 'manual' | 'import'
}

export interface PortfolioSettings {
  theme: 'dark' | 'light'
  privacy: boolean
  /** Display currency. Internal amounts are always GBP. */
  currency: string
  /**
   * ISO 3166-1 alpha-2 tax residency (default GB).
   * Stored per portfolio so family workspaces can differ.
   */
  taxResidency?: string
  collapsed: Record<string, boolean>
  finnhubKey?: string
  lastBackup?: string
  lastPriceUpdate?: string
  manualCryptoPrices?: Record<string, number>
}

export interface Disposal {
  id: number
  date: string
  assetType: 'crypto' | 'equity'
  symbol: string
  qty: number
  proceeds: number
  cost: number
}

export interface FireInputsState {
  expenses: number
  savings: number
  returnRate: number
  age: number
  swr: number
  pensionAge: number
}

export interface RecurringTransaction {
  id: number
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly'
  category: SpendingCategory
  nextDue: string
  createdAt?: string
}

export interface BudgetGoal {
  category: string
  limit: number
}

export interface Trip {
  id: number
  name: string
  startDate?: string
  endDate?: string | null
  budget?: number | null
  icon?: string
  notes?: string
  completed: boolean
  createdAt: string
  sortOrder?: number
}

export interface SplitPerson {
  name: string
  color?: string
}

export interface SplitSettings {
  person1: SplitPerson
  person2: SplitPerson
}

export interface TargetAllocations {
  equity: number
  crypto: number
  cash: number
}

export type MerchantMatchType = 'contains' | 'startsWith' | 'regex'

export interface MerchantRule {
  id: number
  pattern: string
  matchType: MerchantMatchType
  category: SpendingCategory
  priority?: number
}

export interface StakingPool {
  name: string
  ticker?: string
  margin?: number
  pledge?: number
}

export interface StakingReward {
  epoch: number
  amount: number
  date: string
  stake?: number
  priceAtTime?: number
  notes?: string
  pool?: string
  addedAt?: string
  sortOrder?: number
}

export interface StakingState {
  pool: StakingPool
  rewards: StakingReward[]
}

export type FamilyMemberType = 'primary' | 'partner' | 'child' | 'other'

export interface FamilyMember {
  id: string
  name: string
  role: string
  type: FamilyMemberType
  isActive: boolean
  portfolioId?: string
  networth?: number
  assets?: number
  debt?: number
}

export interface FamilySettings {
  combined: boolean
  shareDebt: boolean
  familyPrivacy: boolean
}

export interface FamilyState {
  members: FamilyMember[]
  settings: FamilySettings
}

export interface DocumentNote {
  id: number
  name: string
  note?: string
  createdAt: string
  sortOrder?: number
  fileName?: string
  mimeType?: string
  size?: number
  hasBlob?: boolean
  linkedKind?: 'card' | 'loan' | 'crypto' | 'equity' | 'trip' | 'goal' | 'job'
  linkedId?: number
}

export interface PortfolioData {
  version: number
  crypto: CryptoHolding[]
  equities: EquityHolding[]
  creditCards: CreditCard[]
  loans: Loan[]
  paidOff: PaidOffDebt[]
  goals: Goal[]
  journal: JournalEntry[]
  spending: SpendingEntry[]
  recurringTransactions: RecurringTransaction[]
  /** category → monthly limit (FCC budgetGoals map) */
  budgetGoals: Record<string, number>
  trips: Trip[]
  splitSettings: SplitSettings
  targetAllocations: TargetAllocations
  merchantRules: MerchantRule[]
  staking: StakingState
  family: FamilyState
  history: HistoryPoint[]
  disposals: Disposal[]
  fireInputs: FireInputsState
  monthlyIncome: number
  monthlyExpenses: number
  settings: PortfolioSettings
  /** User-defined spending categories (merged into CATEGORIES selects) */
  customCategories: string[]
  /** Lightweight document notes (no file upload) */
  documents: DocumentNote[]
  /** TODO lists and items */
  todoLists: TodoList[]
  todoItems: TodoItem[]
  /** Job applications tracker */
  jobApplications: JobApplication[]
  /** Raw passthrough for fields we have not modelled yet */
  extras: Record<string, unknown>
}

export interface PortfolioMeta {
  id: string
  name: string
  createdAt: string
}

export interface AssetTotals {
  value: number
  cost: number
  pnl: number
  pct: number
}

export interface LiabilityTotals {
  cc: number
  loans: number
  total: number
  monthly: number
}

export interface NetWorthBreakdown {
  netWorth: number
  assets: number
  liabilities: number
  crypto: AssetTotals
  equity: AssetTotals
  liability: LiabilityTotals
}
