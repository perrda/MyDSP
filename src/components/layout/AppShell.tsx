import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { usePortfolio } from '../../context/PortfolioContext'
import { DISPLAY_CURRENCIES } from '../../services/fx'
import { loadSyncConfig } from '../../services/sync/syncService'
import {
  getAutoSyncStatus,
  subscribeAutoSync,
  syncNow,
} from '../../services/sync/autoSyncService'
import { getSessionSyncPassphrase } from '../../services/sync/sessionPassphrase'
import {
  checkTodoReminders,
  markReminderFired,
  syncTodoRemindersToServiceWorker,
} from '../../domain/todoReminders'
import { MenuButton, Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ToolbarControls } from './ToolbarControls'
import { SyncStatusChip } from '../SyncStatusChip'
import { PullToRefresh } from '../ui/PullToRefresh'
import { PageRouteTransition } from './PageRouteTransition'
import { formatDateTime } from '../../utils/format'
import { useShowBottomNav } from '../../hooks/useShowBottomNav'
import { useIdlePrefetch } from '../../hooks/useIdlePrefetch'
import { triggerSuccessFlash } from '../../utils/successFlash'

/** Pull-to-refresh on Today, Markets, holdings, and News (indicator only — no page jump). */
function allowPullToRefresh(pathname: string): boolean {
  if (pathname === '/' || pathname === '/markets') return true
  if (pathname === '/equities' || pathname === '/crypto' || pathname === '/news') return true
  if (pathname.startsWith('/equities/') || pathname.startsWith('/crypto/')) return true
  return false
}

const titles: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Portfolio', title: 'Overview' },
  '/markets': { eyebrow: 'Watchlist', title: 'Markets' },
  '/news': { eyebrow: 'Insights', title: 'News' },
  '/youtube': { eyebrow: 'Media', title: 'YouTube' },
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
  '/todos': { eyebrow: 'Tasks', title: "To Do's" },
  '/jobs': { eyebrow: 'Career', title: 'Job Tracker' },
  '/import': { eyebrow: 'Import', title: 'CSV Import' },
  '/rules': { eyebrow: 'Import', title: 'Merchant rules' },
  '/optimizer': { eyebrow: 'Planning', title: 'Debt optimizer' },
  '/fire': { eyebrow: 'Planning', title: 'FIRE' },
  '/planning': { eyebrow: 'Planning', title: 'Rebalance & Monte Carlo' },
  '/achievements': { eyebrow: 'Progress', title: 'Achievements' },
  '/tax': { eyebrow: 'Tax', title: 'Capital gains' },
  '/analytics': { eyebrow: 'Insights', title: 'Analytics' },
  '/analytics/predictive': { eyebrow: 'Insights', title: 'Predictive Analytics' },
  '/compare': { eyebrow: 'Compare', title: 'Compare Portfolios' },
  '/api': { eyebrow: 'Integration', title: 'API & Automation' },
  '/insights': { eyebrow: 'Intelligence', title: 'Smart Insights' },
  '/setup/opening': { eyebrow: 'Setup', title: 'Opening balances' },
  '/import/legacy': { eyebrow: 'Import', title: 'Legacy CSV' },
  '/settings': { eyebrow: 'System', title: 'Settings' },
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const showBottomNav = useShowBottomNav()

  useEffect(() => {
    document.documentElement.classList.toggle('has-bottom-nav', showBottomNav)
    return () => document.documentElement.classList.remove('has-bottom-nav')
  }, [showBottomNav])
  useIdlePrefetch()
  const { pathname } = useLocation()
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

  const meta = (() => {
    if (pathname === '/tax') {
      const residency = data.settings.taxResidency || 'GB'
      return {
        eyebrow: 'Tax',
        title: residency === 'GB' ? 'UK CGT' : `Capital gains (${residency})`,
      }
    }
    return (
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
    )
  })()
  const [syncCfg, setSyncCfg] = useState(() => loadSyncConfig())
  const [priceMsg, setPriceMsg] = useState<string | null>(null)

  useEffect(() => {
    return subscribeAutoSync(() => setSyncCfg(loadSyncConfig()))
  }, [])

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
    // Always refresh Markets / News / YouTube feeds — even when prices are
    // gated by privacy mode or throttle (those pages do not need holdings prices).
    try {
      window.dispatchEvent(new CustomEvent('mydsp-global-refresh'))
    } catch {
      /* ignore */
    }

    const r = await refreshPrices()
    if (r.skipped === 'privacy') {
      setPriceMsg('Feeds updated · turn off privacy to refresh live prices')
    } else if (r.skipped === 'throttle') {
      setPriceMsg(lastPriceError ?? 'Feeds updated · please wait before refreshing prices again')
    } else {
      await refreshFx()
      setPriceMsg(`Updated ${r.crypto} crypto · ${r.equities} equities · FX`)
    }
    window.setTimeout(() => setPriceMsg(null), 4000)
  }

  const lastSyncAt = (() => {
    const candidates = [syncCfg.lastSyncAt, data.settings.lastPriceUpdate].filter(
      (v): v is string => Boolean(v),
    )
    if (candidates.length === 0) return null
    return candidates.sort((a, b) => a.localeCompare(b)).at(-1) ?? null
  })()

  /** Pull-down on iPhone/iPad → refresh feeds + cloud sync when configured. */
  const onPullToSync = useCallback(async () => {
    try {
      window.dispatchEvent(new CustomEvent('mydsp-global-refresh'))
    } catch {
      /* ignore */
    }

    const cfg = loadSyncConfig()
    if (!cfg.remoteUrl.trim() || !cfg.enabled || !getSessionSyncPassphrase()) {
      // Still refresh prices/FX locally when sync isn't ready
      const r = await refreshPrices()
      if (!r.skipped) await refreshFx()
      setPriceMsg(
        !cfg.remoteUrl.trim()
          ? 'Feeds refreshed · set Remote URL in Cloud Sync'
          : !cfg.enabled
            ? 'Feeds refreshed · turn on Automatic sync'
            : 'Feeds refreshed · enter sync passphrase in Settings',
      )
      window.setTimeout(() => setPriceMsg(null), 4500)
      return
    }
    setPriceMsg('Syncing across devices…')
    await syncNow()
    setSyncCfg(loadSyncConfig())
    const st = getAutoSyncStatus()
    if (st.state === 'error' || st.state === 'needs-passphrase' || st.state === 'conflict') {
      setPriceMsg(
        st.state === 'conflict'
          ? `${st.message ?? 'Sync conflicts'} — open Settings → Sync to resolve`
          : (st.message ?? 'Sync needs attention — open Settings'),
      )
    } else {
      setPriceMsg(st.message ?? 'Devices synced')
      triggerSuccessFlash()
    }
    window.setTimeout(() => setPriceMsg(null), 4500)
  }, [refreshPrices, refreshFx])

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="app-main">
        <header className="app-header" role="banner" aria-label="App header">
          <div className="app-header-row">
            <MenuButton onClick={() => setOpen(true)} />
            <div className="hidden sm:flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="hidden sm:block w-[3px] h-7 bg-accent shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="eyebrow tracking-[0.2em]">{meta.eyebrow}</p>
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate leading-tight">
                  {meta.title}
                </h1>
              </div>
            </div>
            {/* Phone: title lives in PageHeader — keep row = menu + toolbar only (no overlap) */}
            <div className="sm:hidden flex-1 min-w-0" aria-hidden />
            {/* Tablet/desktop: sync chip sits beside title, never over the menu */}
            <div className="hidden sm:flex items-center justify-end shrink-0 min-w-0 max-w-[11rem] mr-1 empty:hidden">
              <SyncStatusChip />
            </div>

            <ToolbarControls
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              privacy={privacy}
              onPrivacyToggle={() => setPrivacy(!privacy)}
              portfolioSelect={
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
              }
              currencySelect={
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
              }
            />
          </div>
          {/* Phone sync strip — own row under the toolbar so it never covers the burger */}
          <div className="app-header-sync-strip sm:hidden empty:hidden">
            <SyncStatusChip compact />
          </div>
          {(priceMsg || lastPriceError) && (
            <div className="app-header-meta">
              <p
                className={`text-xs truncate ${lastPriceError && !priceMsg ? 'text-accent' : 'text-text-subtle'}`}
                role="status"
              >
                {priceMsg?.includes('Settings → Sync') ? (
                  <Link to="/settings#sync" className="text-accent hover:underline">
                    {priceMsg}
                  </Link>
                ) : (
                  (priceMsg ?? lastPriceError)
                )}
              </p>
            </div>
          )}
          {/* Idle “Last Sync …” on tablet/desktop only — phone uses the sync strip */}
          {!priceMsg && !lastPriceError && lastSyncAt ? (
            <div className="app-header-meta hidden sm:block">
              <p className="text-xs truncate text-text-subtle" role="status">
                Last Sync {formatDateTime(lastSyncAt)}
              </p>
            </div>
          ) : null}
        </header>

        <main
          id="main-content"
          role="main"
          aria-label="Main content"
          className={`app-content${showBottomNav ? ' app-content-with-bottom-nav' : ''}`}
        >
          <PullToRefresh
            onRefresh={onPullToSync}
            refreshingLabel="Syncing devices…"
            disabled={allowPullToRefresh(pathname) ? undefined : true}
          >
            <PageRouteTransition>
              <Outlet />
            </PageRouteTransition>
          </PullToRefresh>
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
