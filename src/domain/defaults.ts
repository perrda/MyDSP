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
      expenses: 30000,
      savings: 1500,
      returnRate: 7,
      age: 40,
      swr: 4,
      pensionAge: 60,
    },
    monthlyIncome: 0,
    monthlyExpenses: 0,
    settings: {
      theme: 'dark',
      privacy: false,
      currency: 'GBP',
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
      { id: 1, symbol: 'ADA', name: 'Cardano', qty: 481942, price: 0.31, cost: 521196 },
      { id: 2, symbol: 'BTC', name: 'Bitcoin', qty: 0.615, price: 69467, cost: 25000 },
      { id: 3, symbol: 'USDC', name: 'USD Coin', qty: 44560, price: 0.79, cost: 35200 },
      { id: 4, symbol: 'NIGHT', name: 'Midnight', qty: 260000, price: 0.0635, cost: 0 },
    ],
    equities: [
      { id: 1, symbol: 'TSLA', name: 'Tesla Inc', shares: 3149, avgCost: 37.87, livePrice: 260 },
      { id: 2, symbol: 'MSTR', name: 'Strategy Inc', shares: 2872, avgCost: 151.16, livePrice: 244 },
    ],
    creditCards: [
      { id: 1, name: 'Lloyds Bank (3353)', balance: 2386, apr: 33.9, minPay: 1580, limit: 5000 },
      { id: 2, name: 'MBNA (3181)', balance: 9827, apr: 29.31, minPay: 330, limit: 12400 },
      { id: 3, name: 'MBNA (6853)', balance: 9213, apr: 26.59, minPay: 290, limit: 10600 },
    ],
    loans: [
      { id: 1, name: 'Barclays', balance: 39850, apr: 5.99, minPay: 983, original: 50000 },
      { id: 2, name: 'Starling Bank (BBL)', balance: 39000, apr: 2.5, minPay: 25, original: 40000 },
      { id: 3, name: 'HMRC', balance: 29974, apr: 2.43, minPay: 300, original: 30889 },
      { id: 4, name: 'CCB Community Bank', balance: 19775, apr: 0, minPay: 479, original: 19500 },
      { id: 5, name: 'Moorcroft (ex-Santander)', balance: 19431, apr: 0, minPay: 200, original: 19500 },
      { id: 6, name: 'Monzo Flex', balance: 18739, apr: 15, minPay: 255, original: 25000 },
      { id: 7, name: 'Tesla Finance', balance: 13547, apr: 3.99, minPay: 774, original: 48000 },
    ],
    paidOff: [{ name: 'V12 Retail Finance (DFS Sofa)', original: 1750, paidDate: '2024-11-01' }],
    goals: [
      {
        id: 1,
        name: 'Pay off credit cards',
        type: 'debt',
        target: 0,
        metric: 'cc',
        deadline: '2025-12-31',
        created: '2024-01-01',
      },
      {
        id: 2,
        name: 'Net Worth £2M',
        type: 'networth',
        target: 2000000,
        metric: 'networth',
        deadline: '2027-12-31',
        created: '2024-01-01',
      },
      {
        id: 3,
        name: 'SIPP Value £2M',
        type: 'investment',
        target: 2000000,
        metric: 'equity',
        deadline: '2028-12-31',
        created: '2024-01-01',
      },
    ],
    journal: [],
    spending: [],
    recurringTransactions: [
      {
        id: 1,
        name: 'Netflix',
        amount: 15.99,
        frequency: 'monthly',
        category: 'subscriptions',
        nextDue: '2026-08-01',
        createdAt: '2026-01-01',
      },
      {
        id: 2,
        name: 'Rent',
        amount: 1850,
        frequency: 'monthly',
        category: 'bills',
        nextDue: '2026-08-01',
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
          networth: 120000,
          assets: 150000,
          debt: 30000,
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
