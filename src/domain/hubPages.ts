/** Door lists for Money / Plan / Household hubs. Secondary pages stay as routes. */

export type HubDoor = {
  to: string
  label: string
  detail: string
}

export const MONEY_DOORS: readonly HubDoor[] = [
  { to: '/cashflow', label: 'Cashflow', detail: 'In, out, leftover, runway' },
  { to: '/spending', label: 'Spending', detail: 'Ledger and categories' },
  { to: '/budgets', label: 'Budgets', detail: 'Monthly limits' },
  { to: '/recurring', label: 'Recurring', detail: 'Bills and income' },
  { to: '/liabilities', label: 'Liabilities', detail: 'Debt and cards' },
  { to: '/tax', label: 'Tax', detail: 'Capital gains pack' },
  { to: '/journal', label: 'Journal', detail: 'Trades and notes' },
  { to: '/crypto', label: 'Crypto', detail: 'Holdings' },
  { to: '/equities', label: 'Equities', detail: 'Holdings' },
  { to: '/commodities', label: 'Commodities', detail: 'Paper book' },
  { to: '/staking', label: 'Staking', detail: 'Yield positions' },
  { to: '/import', label: 'Import', detail: 'CSV and opening balances' },
  { to: '/rules', label: 'Merchant rules', detail: 'Spending aliases' },
]

export const PLAN_DOORS: readonly HubDoor[] = [
  { to: '/goals', label: 'Goals', detail: 'Targets and surplus' },
  { to: '/fire', label: 'FIRE', detail: 'Independence inputs' },
  { to: '/planning', label: 'Planning', detail: 'Rebalance and Monte Carlo' },
  { to: '/optimizer', label: 'Debt tools', detail: 'Avalanche and snowball' },
  { to: '/analytics', label: 'Analytics', detail: 'Health and spend' },
  { to: '/analytics/predictive', label: 'Predictive', detail: 'Runway and FIRE years' },
  { to: '/insights', label: 'Smart Insights', detail: 'Suggestions' },
  { to: '/achievements', label: 'Scorebook', detail: 'XP, level, unlocks' },
  { to: '/history', label: 'History', detail: 'Snapshots' },
]

export const HOUSEHOLD_DOORS: readonly HubDoor[] = [
  { to: '/todos', label: "To Do's", detail: 'Tasks and lists' },
  { to: '/jobs', label: 'Jobs', detail: 'Career tracker' },
  { to: '/documents', label: 'Documents', detail: 'Vault' },
  { to: '/compare', label: 'Compare', detail: 'Portfolios and snapshot' },
  { to: '/trips', label: 'Trips', detail: 'Splits' },
  { to: '/review', label: 'Monthly review', detail: 'Close the month' },
]
