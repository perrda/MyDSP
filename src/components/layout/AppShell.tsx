import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { usePortfolio } from '../../context/PortfolioContext'
import { DISPLAY_CURRENCIES } from '../../services/fx'
import { loadSyncConfig } from '../../services/sync/syncService'
import {
  checkTodoReminders,
  markReminderFired,
  syncTodoRemindersToServiceWorker,
} from '../../domain/todoReminders'
import { PrivacyToggle } from '../PrivacyToggle'
import { ThemeToggle } from '../ThemeToggle'
import { MenuButton, Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { GlobalSearch } from '../GlobalSearch'
import { formatDateTime } from '../../utils/format'

const titles: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Portfolio', title: 'Overview' },
  '/crypto': { eyebrow: 'Holdings', title: 'Crypto' },
  '/equities': { eyebrow: 'Holdings', title: 'Equities' },
  '/staking': { eyebrow: 'Crypto', title: 'Staking' },
  '/liabilities': { eyebrow: 'Debt', title: 'Liabilities' },
  '/goals': { eyebrow: 'Targets', title: 'Goals' },
  '/spending': { eyebrow: 'Activity', title: 'Spending' },
  '/journal': { eyebrow: 'Activity', title: 'Journal' },
  '/budgets': { eyebrow: 'Spending', title: 'Budgets' },
  '/recurring': { eyebrow: 'Activity', title: 'Recurring' },
  '/review': { eyebrow: 'Insights', title: 'Monthly review' },
  '/trips': { eyebrow: 'Activity', title: 'Trips & splits' },
  '/family': { eyebrow: 'Household', title: 'Family' },
  '/history': { eyebrow: 'Insights', title: 'History' },
  '/documents': { eyebrow: 'Vault', title: 'Documents' },
  '/todos': { eyebrow: 'Tasks', title: 'Todo Lists' },
  '/jobs': { eyebrow: 'Career', title: 'Job Applications' },
  '/import': { eyebrow: 'Import', title: 'Bank CSV' },
  '/rules': { eyebrow: 'Import', title: 'Merchant rules' },
  '/optimizer': { eyebrow: 'Planning', title: 'Debt optimizer' },
  '/fire': { eyebrow: 'Planning', title: 'FIRE' },
  '/planning': { eyebrow: 'Planning', title: 'Rebalance & Monte Carlo' },
  '/achievements': { eyebrow: 'Progress', title: 'Achievements' },
  '/tax': { eyebrow: 'Tax', title: 'UK CGT' },
  '/analytics': { eyebrow: 'Insights', title: 'Analytics' },
  '/analytics/predictive': { eyebrow: 'Insights', title: 'Predictive Analytics' },
  '/compare': { eyebrow: 'Compare', title: 'Compare Portfolios' },
  '/api': { eyebrow: 'Integration', title: 'API & Automation' },
  '/insights': { eyebrow: 'Intelligence', title: 'Smart Insights' },
  '/settings': { eyebrow: 'System', title: 'Settings' },
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const meta =
    titles[pathname] ??
    (pathname.startsWith('/liabilities/')
      ? { eyebrow: 'Debt', title: 'Liability detail' }
      : pathname.startsWith('/crypto/')
        ? { eyebrow: 'Holdings', title: 'Crypto detail' }
        : pathname.startsWith('/equities/')
          ? { eyebrow: 'Holdings', title: 'Equity detail' }
          : pathname.startsWith('/jobs/')
            ? { eyebrow: 'Career', title: 'Job Application' }
            : { eyebrow: 'MyDSP', title: 'App' })
  const syncCfg = loadSyncConfig()
  const {
    portfolios,
    activeId,
    switchPortfolio,
    privacy,
    setPrivacy,
    refreshPrices,
    refreshing,
    lastPriceError,
    data,
    setCurrency,
    refreshFx,
  } = usePortfolio()
  const [priceMsg, setPriceMsg] = useState<string | null>(null)

  // Keep SW reminder schedule in sync app-wide (not only while Todos is open)
  useEffect(() => {
    const items = data.todoItems ?? []
    void syncTodoRemindersToServiceWorker(items)
    checkTodoReminders(items)
    const id = window.setInterval(() => checkTodoReminders(items), 60_000)
    return () => window.clearInterval(id)
  }, [data.todoItems])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'TODO_REMINDER_FIRED' && typeof msg.key === 'string') {
        markReminderFired(msg.key)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  const onRefresh = async () => {
    const r = await refreshPrices()
    if (r.skipped === 'privacy') {
      setPriceMsg('Turn off privacy mode to refresh live prices')
    } else if (r.skipped === 'throttle') {
      setPriceMsg(lastPriceError ?? 'Please wait before refreshing again')
    } else {
      await refreshFx()
      setPriceMsg(`Updated ${r.crypto} crypto · ${r.equities} equities · FX`)
    }
    window.setTimeout(() => setPriceMsg(null), 4000)
  }

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="app-main">
        <header className="app-header">
          <div className="app-header-row">
            <MenuButton onClick={() => setOpen(true)} />
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="hidden sm:block w-[3px] h-7 bg-accent shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="eyebrow text-[10px] tracking-[0.2em]">{meta.eyebrow}</p>
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate leading-tight">
                  {meta.title}
                </h1>
              </div>
            </div>

            <div className="toolbar-cluster" role="toolbar" aria-label="Workspace controls">
              <label className="toolbar-field">
                <span className="sr-only">Portfolio</span>
                <select
                  className="toolbar-select toolbar-select-portfolio"
                  value={activeId}
                  onChange={(e) => switchPortfolio(e.target.value)}
                  aria-label="Active portfolio"
                  title={portfolios.find((p) => p.id === activeId)?.name}
                >
                  {portfolios.map((p) => (
                    <option key={`${p.id}:${p.name}`} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="toolbar-field">
                <span className="sr-only">Display currency</span>
                <select
                  className="toolbar-select toolbar-select-currency"
                  value={data.settings.currency || 'GBP'}
                  onChange={(e) => setCurrency(e.target.value)}
                  aria-label="Display currency"
                >
                  {DISPLAY_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={refreshing}
                className="toolbar-icon"
                title="Refresh live prices"
                aria-label={refreshing ? 'Updating prices' : 'Refresh prices'}
              >
                <RefreshCw
                  size={16}
                  strokeWidth={1.5}
                  className={refreshing ? 'animate-spin' : ''}
                />
              </button>

              <PrivacyToggle privacy={privacy} onToggle={() => setPrivacy(!privacy)} />
              <ThemeToggle />
              <div className="hidden sm:block">
                <GlobalSearch />
              </div>
            </div>
          </div>
          {(priceMsg || lastPriceError || data.settings.lastPriceUpdate || syncCfg.lastSyncAt) && (
            <div className="app-header-meta">
              <p
                className={`text-[11px] truncate ${lastPriceError && !priceMsg ? 'text-accent' : 'text-text-subtle'}`}
                role="status"
              >
                {priceMsg ??
                  lastPriceError ??
                  [
                    data.settings.lastPriceUpdate
                      ? `Last price update ${formatDateTime(data.settings.lastPriceUpdate)}`
                      : null,
                    syncCfg.lastSyncAt
                      ? `Last sync ${formatDateTime(syncCfg.lastSyncAt)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
              </p>
            </div>
          )}
        </header>

        <main className="app-content pb-16 lg:pb-0">
          <Outlet />
        </main>
        
        <BottomNav />
      </div>
    </div>
  )
}
