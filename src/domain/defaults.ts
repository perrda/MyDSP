import type { PortfolioData } from './types'

/** Empty clean slate — used after reset. */
export function createEmptyPortfolio(): PortfolioData {
  return {
    version: 1,
    crypto: [],
    equities: [],
    creditCards: [],
    loans: [],
    paidOff: [],
    goals: [],
    journal: [],
    spending: [],
    recurringTransactions: [],
    budgetGoals: {},
    trips: [],
    splitSettings: {
      person1: { name: 'You', color: 'green' },
      person2: { name: 'Partner', color: 'blue' },
    },
    targetAllocations: { equity: 70, crypto: 25, cash: 5 },
    merchantRules: [],
    staking: { pool: { name: 'NORTH5', ticker: 'NORTH5' }, rewards: [] },
    family: {
      members: [
        { id: 'primary', name: 'You', role: 'Primary', type: 'primary', isActive: true },
      ],
      settings: { combined: true, shareDebt: true, familyPrivacy: false },
    },
    history: [],
    disposals: [],
    fireInputs: {
      expenses: 25000,
      savings: 1000,
      returnRate: 7,
      age: 35,
      swr: 4,
      pensionAge: 65,
    },
    monthlyIncome: 0,
    monthlyExpenses: 0,
    settings: {
      theme: 'dark',
      privacy: false,
      currency: 'GBP',
      taxResidency: 'GB',
      collapsed: {},
    },
    customCategories: [],
    documents: [],
    todoLists: [],
    todoItems: [],
    jobApplications: [],
    extras: {},
  }
}

/**
 * Sample portfolio for first run (FCC-shaped demo data).
 * Prefer importing live `dfc_data_v3` when present.
 */
export function createSamplePortfolio(): PortfolioData {
  return {
    version: 1,
    crypto: [
      { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 0, cost: 2000 },
      { id: 2, symbol: 'ETH', name: 'Ethereum', qty: 1.5, price: 0, cost: 3500 },
      { id: 3, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 },
    ],
    equities: [
      { id: 1, symbol: 'VWRL', name: 'Vanguard FTSE All-World', shares: 50, avgCost: 95, livePrice: 0 },
      { id: 2, symbol: 'VUSA', name: 'Vanguard S&P 500', shares: 30, avgCost: 75, livePrice: 0 },
    ],
    creditCards: [
      { id: 1, name: 'Credit Card A', balance: 500, apr: 21.9, minPay: 50, limit: 3000 },
    ],
    loans: [
      { id: 1, name: 'Student Loan', balance: 3000, apr: 1.5, minPay: 50, original: 5000 },
    ],
    paidOff: [{ name: 'Car Loan', original: 6000, paidDate: '2025-01-01' }],
    goals: [
      {
        id: 1,
        name: 'Pay off credit cards',
        type: 'debt',
        target: 0,
        metric: 'cc',
        deadline: '2027-12-31',
        created: '2026-01-01',
      },
      {
        id: 2,
        name: 'Emergency fund',
        type: 'networth',
        target: 10000,
        metric: 'cash',
        deadline: '2027-06-30',
        created: '2026-01-01',
      },
      {
        id: 3,
        name: 'Investment portfolio',
        type: 'investment',
        target: 50000,
        metric: 'equity',
        deadline: '2029-12-31',
        created: '2026-01-01',
      },
    ],
    journal: [],
    spending: [],
    recurringTransactions: [
      {
        id: 1,
        name: 'Streaming subscription',
        amount: 12.99,
        frequency: 'monthly',
        category: 'subscriptions',
        nextDue: '2026-09-01',
        createdAt: '2026-01-01',
      },
      {
        id: 2,
        name: 'Rent',
        amount: 1200,
        frequency: 'monthly',
        category: 'bills',
        nextDue: '2026-09-01',
        createdAt: '2026-01-01',
      },
    ],
    budgetGoals: {
      food: 450,
      transport: 150,
      shopping: 200,
      entertainment: 100,
      bills: 2200,
      subscriptions: 80,
    },
    trips: [],
    splitSettings: {
      person1: { name: 'You', color: 'green' },
      person2: { name: 'Partner', color: 'blue' },
    },
    targetAllocations: { equity: 70, crypto: 25, cash: 5 },
    merchantRules: [
      { id: 1, pattern: 'tesco', matchType: 'contains', category: 'food', priority: 10 },
      { id: 2, pattern: 'uber', matchType: 'contains', category: 'transport', priority: 10 },
    ],
    staking: {
      pool: { name: 'NORTH5', ticker: 'NORTH5', margin: 2.5 },
      rewards: [],
    },
    family: {
      members: [
        { id: 'primary', name: 'You', role: 'Primary', type: 'primary', isActive: true },
        {
          id: 'partner',
          name: 'Partner',
          role: 'Partner',
          type: 'partner',
          isActive: true,
          networth: 2500,
          assets: 3000,
          debt: 500,
        },
      ],
      settings: { combined: true, shareDebt: true, familyPrivacy: false },
    },
    history: [],
    disposals: [],
    fireInputs: {
      expenses: 30000,
      savings: 1500,
      returnRate: 7,
      age: 45,
      swr: 4,
      pensionAge: 60,
    },
    monthlyIncome: 4200,
    monthlyExpenses: 2500,
    settings: {
      theme: 'dark',
      privacy: false,
      currency: 'GBP',
      taxResidency: 'GB',
      collapsed: {},
    },
    customCategories: [],
    documents: [],
    todoLists: [],
    todoItems: [],
    jobApplications: [],
    extras: {},
  }
}
