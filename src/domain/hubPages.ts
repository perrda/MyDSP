/** Door lists for Money / Plan / Household hubs. Secondary pages stay as routes. */

export type HubDoor = {
  to: string
  label: string
  detail: string
}

/** Four cockpit doors. Leftover + runway sit above these on /money. */
export const MONEY_DOORS: readonly HubDoor[] = [
  { to: '/spending', label: 'Spend', detail: 'Ledger, budgets, bills' },
  { to: '/crypto', label: 'Holdings', detail: 'Crypto and equities' },
  { to: '/tax', label: 'Tax', detail: 'Capital gains pack' },
  { to: '/import', label: 'Import', detail: 'CSV and opening balances' },
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
