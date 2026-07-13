import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { SecurityProvider } from './components/SecurityProvider'
import { ToastProvider } from './components/ToastProvider'
import { AchievementWatcher } from './components/AchievementWatcher'
import { InstallPrompt } from './components/InstallPrompt'
import { SkipToContent, ScreenReaderAnnouncer } from './components/Accessibility'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './pages/Dashboard'
import { CryptoPage } from './pages/CryptoPage'
import { EquitiesPage } from './pages/EquitiesPage'
import { LiabilitiesPage } from './pages/LiabilitiesPage'
import { GoalsPage } from './pages/Goals'
import { SpendingPage } from './pages/SpendingPage'
import { JournalPage } from './pages/JournalPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { RecurringPage } from './pages/RecurringPage'
import { MonthlyReviewPage } from './pages/MonthlyReviewPage'
import { TripsPage } from './pages/TripsPage'
import { ImportPage } from './pages/ImportPage'
import { EnhancedImportPage } from './pages/EnhancedImportPage'
import { RulesPage } from './pages/RulesPage'
import { OptimizerPage } from './pages/OptimizerPage'
import { FirePage } from './pages/FirePage'
import { TaxPage } from './pages/TaxPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { PlanningPage } from './pages/PlanningPage'
import { AchievementsPage } from './pages/AchievementsPage'
import { StakingPage } from './pages/StakingPage'
import { FamilyPage } from './pages/FamilyPage'
import { HistoryPage } from './pages/HistoryPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { LiabilityDetailPage } from './pages/LiabilityDetailPage'
import { HoldingDetailPage } from './pages/HoldingDetailPage'
import { ComparePage } from './pages/ComparePage'
import { OpeningBalanceWizardPage } from './pages/OpeningBalanceWizardPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodosPage } from './pages/TodosPage'
import { JobsPage } from './pages/JobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { PredictiveAnalyticsPage } from './pages/PredictiveAnalyticsPage'
import { ApiAutomationPage } from './pages/ApiAutomationPage'
import { SmartInsightsPage } from './pages/SmartInsightsPage'

export default function App() {
  return (
    <ThemeProvider>
      <PortfolioProvider>
        <SecurityProvider>
          <BrowserRouter basename={__BASE_PATH__ === '/' ? undefined : __BASE_PATH__.replace(/\/$/, '')}>
            <SkipToContent />
            <ScreenReaderAnnouncer />
            <ToastProvider>
              <AchievementWatcher />
              <InstallPrompt />
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Dashboard />} />
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
            </ToastProvider>
          </BrowserRouter>
        </SecurityProvider>
      </PortfolioProvider>
    </ThemeProvider>
  )
}
