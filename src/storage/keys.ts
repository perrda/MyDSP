/** Storage keys — must stay compatible with FCC v7.60. */

export const STORAGE = {
  /** Default portfolio blob (FCC) */
  DATA: 'dfc_data_v3',
  /** Additional portfolios: dfc_data_v3_{id} */
  dataKey: (portfolioId: string) =>
    portfolioId === 'default' ? 'dfc_data_v3' : `dfc_data_v3_${portfolioId}`,
  PORTFOLIOS: 'fcc_portfolios',
  ACTIVE: 'fcc_active_portfolio',
  THEME: 'fcc_theme',
  /** MyDSP-only flag: we have completed first-run bootstrap */
  BOOTSTRAPPED: 'mydsp_bootstrapped',
} as const
