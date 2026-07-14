/** Vite manualChunks helper — kept pure so we can unit-test chunk assignment. */

export function resolveManualChunk(id: string): string | undefined {
  // Vendor chunks — order matters: `lucide-react` contains the substring
  // "react", so it must be matched BEFORE the React packages. Otherwise
  // Lucide icons merge into react-vendor, minified exports collide with React
  // internals, and pages like YouTube crash rendering Video/Pencil/Trash.
  if (id.includes('node_modules')) {
    if (id.includes('lucide-react')) {
      return 'icon-vendor'
    }
    if (
      id.includes('node_modules/react/') ||
      id.includes('node_modules/react-dom') ||
      id.includes('node_modules/react-router') ||
      id.includes('node_modules\\react\\') ||
      id.includes('node_modules\\react-dom') ||
      id.includes('node_modules\\react-router')
    ) {
      return 'react-vendor'
    }
    if (id.includes('recharts')) {
      return 'chart-vendor'
    }
    return 'vendor'
  }

  if (id.includes('/pages/')) {
    if (
      id.includes('Dashboard') ||
      id.includes('CryptoPage') ||
      id.includes('EquitiesPage') ||
      id.includes('LiabilitiesPage')
    ) {
      return 'portfolio-pages'
    }
    if (
      id.includes('SpendingPage') ||
      id.includes('JournalPage') ||
      id.includes('BudgetsPage') ||
      id.includes('RecurringPage')
    ) {
      return 'transaction-pages'
    }
    if (
      id.includes('AnalyticsPage') ||
      id.includes('PredictiveAnalyticsPage') ||
      id.includes('SmartInsightsPage') ||
      id.includes('TaxPage')
    ) {
      return 'analysis-pages'
    }
    if (
      id.includes('GoalsPage') ||
      id.includes('FirePage') ||
      id.includes('PlanningPage') ||
      id.includes('OptimizerPage')
    ) {
      return 'planning-pages'
    }
    if (
      id.includes('TodosPage') ||
      id.includes('JobsPage') ||
      id.includes('ImportPage') ||
      id.includes('EnhancedImportPage')
    ) {
      return 'tools-pages'
    }
    if (
      id.includes('YouTubePage') ||
      id.includes('NewsPage') ||
      id.includes('MarketsPage')
    ) {
      return 'media-pages'
    }
  }

  return undefined
}
