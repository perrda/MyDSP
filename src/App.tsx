import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { GlassProvider } from './context/GlassContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { SecurityProvider } from './components/SecurityProvider'
import { ToastProvider } from './components/ToastProvider'
import { AchievementWatcher } from './components/AchievementWatcher'
import { InstallPrompt } from './components/InstallPrompt'
import { SyncConflictSheet } from './components/SyncConflictSheet'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { LaunchRedirect } from './components/LaunchRedirect'
import { UpdateBanner } from './components/UpdateBanner'
import { SkipToContent, ScreenReaderAnnouncer } from './components/Accessibility'
import { ScrollToTop } from './components/ScrollToTop'
import { AppShell } from './components/layout/AppShell'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { withPerformanceMonitoring } from './components/PerformanceMonitor'

// Eager-load critical pages
import { Dashboard as DashboardBase } from './pages/Dashboard'
import { SettingsPage as SettingsPageBase } from './pages/SettingsPage'

// Wrap critical pages with performance monitoring
const Dashboard = withPerformanceMonitoring(DashboardBase, 'Dashboard')
const SettingsPage = withPerformanceMonitoring(SettingsPageBase, 'Settings')

// Lazy-load all other pages
const CryptoPage = lazy(() => import('./pages/CryptoPage').then(m => ({ default: m.CryptoPage })))
const EquitiesPage = lazy(() => import('./pages/EquitiesPage').then(m => ({ default: m.EquitiesPage })))
const LiabilitiesPage = lazy(() => import('./pages/LiabilitiesPage').then(m => ({ default: m.LiabilitiesPage })))
const GoalsPage = lazy(() => import('./pages/Goals').then(m => ({ default: m.GoalsPage })))
const SpendingPage = lazy(() => import('./pages/SpendingPage').then(m => ({ default: m.SpendingPage })))
const JournalPage = lazy(() => import('./pages/JournalPage').then(m => ({ default: m.JournalPage })))
const BudgetsPage = lazy(() => import('./pages/BudgetsPage').then(m => ({ default: m.BudgetsPage })))
const RecurringPage = lazy(() => import('./pages/RecurringPage').then(m => ({ default: m.RecurringPage })))
const MonthlyReviewPage = lazy(() => import('./pages/MonthlyReviewPage').then(m => ({ default: m.MonthlyReviewPage })))
const TripsPage = lazy(() => import('./pages/TripsPage').then(m => ({ default: m.TripsPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })))
const EnhancedImportPage = lazy(() => import('./pages/EnhancedImportPage').then(m => ({ default: m.EnhancedImportPage })))
const RulesPage = lazy(() => import('./pages/RulesPage').then(m => ({ default: m.RulesPage })))
const OptimizerPage = lazy(() => import('./pages/OptimizerPage').then(m => ({ default: m.OptimizerPage })))
const FirePage = lazy(() => import('./pages/FirePage').then(m => ({ default: m.FirePage })))
const TaxPage = lazy(() => import('./pages/TaxPage').then(m => ({ default: m.TaxPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const PlanningPage = lazy(() => import('./pages/PlanningPage').then(m => ({ default: m.PlanningPage })))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const StakingPage = lazy(() => import('./pages/StakingPage').then(m => ({ default: m.StakingPage })))
const FamilyPage = lazy(() => import('./pages/FamilyPage').then(m => ({ default: m.FamilyPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })))
const LiabilityDetailPage = lazy(() => import('./pages/LiabilityDetailPage').then(m => ({ default: m.LiabilityDetailPage })))
const HoldingDetailPage = lazy(() => import('./pages/HoldingDetailPage').then(m => ({ default: m.HoldingDetailPage })))
const ComparePage = lazy(() => import('./pages/ComparePage').then(m => ({ default: m.ComparePage })))
const OpeningBalanceWizardPage = lazy(() => import('./pages/OpeningBalanceWizardPage').then(m => ({ default: m.OpeningBalanceWizardPage })))
const TodosPage = lazy(() => import('./pages/TodosPage').then(m => ({ default: m.TodosPage })))
const JobsPage = lazy(() => import('./pages/JobsPage').then(m => ({ default: m.JobsPage })))
const JobDetailPage = lazy(() => import('./pages/JobDetailPage').then(m => ({ default: m.JobDetailPage })))
const PredictiveAnalyticsPage = lazy(() => import('./pages/PredictiveAnalyticsPage').then(m => ({ default: m.PredictiveAnalyticsPage })))
const ApiAutomationPage = lazy(() => import('./pages/ApiAutomationPage').then(m => ({ default: m.ApiAutomationPage })))
const SmartInsightsPage = lazy(() => import('./pages/SmartInsightsPage').then(m => ({ default: m.SmartInsightsPage })))
const MarketsPage = lazy(() => import('./pages/MarketsPage').then(m => ({ default: m.MarketsPage })))
const NewsPage = lazy(() => import('./pages/NewsPage').then(m => ({ default: m.NewsPage })))
const YouTubePage = lazy(() => import('./pages/YouTubePage').then(m => ({ default: m.YouTubePage })))

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GlassProvider>
          <PortfolioProvider>
            <SecurityProvider>
              <BrowserRouter basename={__BASE_PATH__ === '/' ? undefined : __BASE_PATH__.replace(/\/$/, '')}>
                <ScrollToTop />
                <LaunchRedirect />
                <SkipToContent />
                <ScreenReaderAnnouncer />
                <ToastProvider>
                  <AchievementWatcher />
                  <InstallPrompt />
                  <SyncConflictSheet />
                  <KeyboardShortcutsHelp />
                  <UpdateBanner />
                  <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                      <Route element={<AppShell />}>
                        <Route index element={<Dashboard />} />
                        <Route path="markets" element={<MarketsPage />} />
                        <Route path="news" element={<NewsPage />} />
                        <Route path="youtube" element={<YouTubePage />} />
                        <Route path="crypto" element={<CryptoPage />} />
                        <Route path="crypto/:id" element={<HoldingDetailPage />} />
                        <Route path="equities" element={<EquitiesPage />} />
                        <Route path="equities/:id" element={<HoldingDetailPage />} />
                        <Route path="staking" element={<StakingPage />} />
                        <Route path="liabilities" element={<LiabilitiesPage />} />
                        <Route path="liabilities/:kind/:id" element={<LiabilityDetailPage />} />
                        <Route path="goals" element={<GoalsPage />} />
                        <Route path="spending" element={<SpendingPage />} />
                        <Route path="journal" element={<JournalPage />} />
                        <Route path="budgets" element={<BudgetsPage />} />
                        <Route path="recurring" element={<RecurringPage />} />
                        <Route path="review" element={<MonthlyReviewPage />} />
                        <Route path="trips" element={<TripsPage />} />
                        <Route path="family" element={<FamilyPage />} />
                        <Route path="history" element={<HistoryPage />} />
                        <Route path="documents" element={<DocumentsPage />} />
                        <Route path="import" element={<EnhancedImportPage />} />
                        <Route path="import/legacy" element={<ImportPage />} />
                        <Route path="rules" element={<RulesPage />} />
                        <Route path="optimizer" element={<OptimizerPage />} />
                        <Route path="fire" element={<FirePage />} />
                        <Route path="planning" element={<PlanningPage />} />
                        <Route path="achievements" element={<AchievementsPage />} />
                        <Route path="tax" element={<TaxPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="analytics/predictive" element={<PredictiveAnalyticsPage />} />
                        <Route path="compare" element={<ComparePage />} />
                        <Route path="setup/opening" element={<OpeningBalanceWizardPage />} />
                        <Route path="todos" element={<TodosPage />} />
                        <Route path="jobs" element={<JobsPage />} />
                        <Route path="jobs/:id" element={<JobDetailPage />} />
                        <Route path="api" element={<ApiAutomationPage />} />
                        <Route path="insights" element={<SmartInsightsPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="accounts" element={<Navigate to="/crypto" replace />} />
                        <Route path="transactions" element={<Navigate to="/spending" replace />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </ToastProvider>
              </BrowserRouter>
            </SecurityProvider>
          </PortfolioProvider>
        </GlassProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
