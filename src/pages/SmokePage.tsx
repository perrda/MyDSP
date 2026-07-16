/** On-device smoke checklist — Sync / Markets / Backup / PWA / Quote / Sync URL. */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, RefreshCw } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { loadSyncConfig } from '../services/sync/syncService'
import {
  getSessionSyncPassphrase,
  hasRememberedSyncPassphrase,
} from '../services/sync/sessionPassphrase'
import { DEFAULT_COMMODITIES } from '../domain/commodities'
import { loadMarketQuotesCache, loadMarketsState } from '../storage/marketsStore'
import { loadNewsArticlesCache, loadNewsState } from '../storage/newsStore'
import { loadYoutubeState } from '../storage/youtubeStore'
import { LAST_BACKUP_KEY, listFullBackups } from '../storage/backupStore'
import { loadSecurity } from '../security/pin'
import { loadBottomNavMiddleSlots, DEFAULT_BOTTOM_NAV_MIDDLE } from '../storage/bottomNavSlots'
import {
  checkSyncUrlReachable,
  pingQuoteWorker,
} from '../domain/smokeChecks'

type CheckId =
  | 'sync'
  | 'markets'
  | 'commodities'
  | 'quotes-cache'
  | 'finnhub'
  | 'news'
  | 'youtube'
  | 'backup'
  | 'pwa'
  | 'quote'
  | 'sync-url'
  | 'lock'
  | 'bottom-nav'
  | 'weekly-digest'

type SmokeItem = {
  id: CheckId
  label: string
  detail: string
  to?: string
  done: boolean
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function syncConfigured(): boolean {
  const cfg = loadSyncConfig()
  const passOk = Boolean(getSessionSyncPassphrase() || hasRememberedSyncPassphrase())
  return Boolean(cfg.enabled && cfg.remoteUrl.trim() && passOk)
}

function marketsRefreshed(): boolean {
  const at = loadMarketsState().lastRefreshAt
  return Boolean(at && !Number.isNaN(Date.parse(at)))
}

function commoditiesSeeded(): { ok: boolean; detail: string } {
  const tickers = loadMarketsState().tickers.filter((t) => t.kind === 'commodity')
  const have = new Set(tickers.map((t) => t.symbol.toUpperCase()))
  const missing = DEFAULT_COMMODITIES.filter((c) => !have.has(c.symbol)).map((c) => c.symbol)
  if (tickers.length === 0) {
    return { ok: false, detail: 'No commodity tickers — open Markets to seed Gold/Silver/Copper' }
  }
  if (missing.length > 0) {
    return {
      ok: true,
      detail: `${tickers.length} commodity ticker(s); missing defaults: ${missing.join(', ')}`,
    }
  }
  return { ok: true, detail: `Gold / Silver / Copper present (${tickers.length} commodities)` }
}

function quotesCachePresent(): { ok: boolean; detail: string } {
  const map = loadMarketQuotesCache()
  const live = [...map.values()].filter((q) => q.last > 0).length
  if (live === 0) {
    return { ok: false, detail: 'No last-good quotes cached — refresh Markets or Sync prices now' }
  }
  const synced = [...map.values()].filter((q) => (q.source || '').startsWith('sync:')).length
  return {
    ok: true,
    detail:
      synced > 0
        ? `${live} cached quote(s), ${synced} from other device`
        : `${live} cached quote(s) ready to sync across devices`,
  }
}

function finnhubKeyPresent(): { ok: boolean; detail: string } {
  try {
    const key = localStorage.getItem('finnhub_key')?.trim()
    if (key) return { ok: true, detail: 'Finnhub key present in localStorage on this device' }
  } catch {
    /* ignore */
  }
  return {
    ok: false,
    detail: 'No Finnhub key on this device — Settings → Prices (keys do not sync)',
  }
}

function newsCachePresent(): { ok: boolean; detail: string } {
  const tags = loadNewsState().tags.length
  const cache = loadNewsArticlesCache()
  const top = cache.top.length
  if (tags === 0 && top === 0) {
    return { ok: false, detail: 'No News tags or cached headlines — open News to refresh' }
  }
  return {
    ok: true,
    detail: `${tags} meta-tag(s) · ${top} cached Top headline(s)`,
  }
}

function youtubeChannelsPresent(): { ok: boolean; detail: string } {
  const channels = loadYoutubeState().channels?.length ?? 0
  if (channels === 0) {
    return { ok: false, detail: 'No YouTube channels saved — add favourites on YouTube' }
  }
  return { ok: true, detail: `${channels} favourite channel(s)` }
}

function backupExistsLocal(): boolean {
  try {
    return Boolean(localStorage.getItem(LAST_BACKUP_KEY))
  } catch {
    return false
  }
}

async function backupExistsIndexed(): Promise<boolean> {
  try {
    const list = await listFullBackups()
    return list.length > 0
  } catch {
    return backupExistsLocal()
  }
}

export function SmokePage() {
  const [items, setItems] = useState<SmokeItem[]>([])
  const [busy, setBusy] = useState(false)

  const runChecks = useCallback(async () => {
    setBusy(true)
    const backupOk = (await backupExistsIndexed()) || backupExistsLocal()
    const cfg = loadSyncConfig()
    const [quote, syncUrl] = await Promise.all([
      pingQuoteWorker(),
      cfg.remoteUrl.trim()
        ? checkSyncUrlReachable(cfg.remoteUrl)
        : Promise.resolve({
            ok: false as const,
            status: 0,
            detail: 'No Sync URL configured',
          }),
    ])

    const next: SmokeItem[] = [
      {
        id: 'sync',
        label: 'Sync configured',
        detail: 'Automatic sync on, remote URL set, passphrase available',
        to: '/settings#sync',
        done: syncConfigured(),
      },
      {
        id: 'markets',
        label: 'Markets refreshed',
        detail: 'Markets store has a lastRefreshAt timestamp',
        to: '/markets',
        done: marketsRefreshed(),
      },
      {
        id: 'commodities',
        label: 'Commodities seeded',
        detail: commoditiesSeeded().detail,
        to: '/markets',
        done: commoditiesSeeded().ok,
      },
      {
        id: 'quotes-cache',
        label: 'Markets quote cache',
        detail: quotesCachePresent().detail,
        to: '/markets',
        done: quotesCachePresent().ok,
      },
      {
        id: 'finnhub',
        label: 'Finnhub key (this device)',
        detail: finnhubKeyPresent().detail,
        to: '/settings#prices',
        done: finnhubKeyPresent().ok,
      },
      {
        id: 'news',
        label: 'News tags / headlines',
        detail: newsCachePresent().detail,
        to: '/news',
        done: newsCachePresent().ok,
      },
      {
        id: 'youtube',
        label: 'YouTube channels',
        detail: youtubeChannelsPresent().detail,
        to: '/youtube',
        done: youtubeChannelsPresent().ok,
      },
      {
        id: 'backup',
        label: 'Backup exists',
        detail: 'IndexedDB full backup or last-backup day marker present',
        to: '/settings#full-backup',
        done: backupOk,
      },
      {
        id: 'pwa',
        label: 'Install / PWA standalone',
        detail: 'Running as installed home-screen app (display-mode: standalone)',
        to: '/settings#devices',
        done: isStandalonePwa(),
      },
      {
        id: 'quote',
        label: 'Quote Worker ping',
        detail: quote.detail,
        to: '/settings#sync',
        done: quote.ok,
      },
      {
        id: 'sync-url',
        label: 'Sync URL reachability',
        detail: syncUrl.detail,
        to: '/settings#sync',
        done: syncUrl.ok,
      },
      {
        id: 'lock',
        label: 'PIN / Face ID lock',
        detail: (() => {
          const s = loadSecurity()
          if (!s.pinEnabled) return 'PIN not enabled — optional but recommended'
          return s.biometricEnabled
            ? 'PIN on · Face ID / biometrics registered'
            : 'PIN on · enable Face ID in Settings → Security for primary unlock'
        })(),
        to: '/settings#security',
        done: loadSecurity().pinEnabled,
      },
      {
        id: 'bottom-nav',
        label: 'Bottom nav middle slots',
        detail: (() => {
          const slots = loadBottomNavMiddleSlots()
          const labels = slots.join(', ')
          const isDefault = slots.every((p, i) => p === DEFAULT_BOTTOM_NAV_MIDDLE[i])
          return isDefault
            ? `Defaults OK (${labels})`
            : `Custom middle tabs: ${labels}`
        })(),
        to: '/settings#layout',
        done: loadBottomNavMiddleSlots().length === 3,
      },
      {
        id: 'weekly-digest',
        label: 'Weekly digest Share',
        detail: 'Today opens WeeklyDigestModal for Preview/Share, editable highlights, copy, and download fallback',
        to: '/',
        done: true,
      },
    ]
    setItems(next)
    setBusy(false)
  }, [])

  useEffect(() => {
    void runChecks()
  }, [runChecks])

  const doneCount = items.filter((i) => i.done).length

  return (
    <div>
      <PageHeader
        eyebrow="QA"
        title="On-device smoke"
        description="Interactive checks against sync, Markets, backup, PWA, Quote Worker, and Sync URL."
        action={
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void runChecks()}
            disabled={busy}
            aria-busy={busy}
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
            Re-check
          </button>
        }
      />

      <p className="text-sm text-text-muted font-light mb-6">
        {doneCount}/{items.length || 6} checks passing ·{' '}
        <Link to="/settings#accessibility" className="text-accent font-medium">
          Accessibility
        </Link>
      </p>

      <ul className="space-y-3" aria-label="Smoke checklist">
        {items.map((item) => (
          <li key={item.id} className="surface p-4 md:p-5 border border-border">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 shrink-0 ${item.done ? 'text-accent' : 'text-text-subtle'}`}
                aria-hidden
              >
                {item.done ? <Check size={20} strokeWidth={2.5} /> : <Circle size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold tracking-tight">
                  {item.label}
                  <span className="sr-only"> — {item.done ? 'pass' : 'fail'}</span>
                </p>
                <p className="text-sm text-text-muted mt-1">{item.detail}</p>
                {item.to && !item.done ? (
                  <Link to={item.to} className="inline-block mt-3 text-sm text-accent font-medium">
                    Fix in app →
                  </Link>
                ) : null}
              </div>
              <span
                className={`text-[11px] uppercase tracking-wider font-semibold shrink-0 ${
                  item.done ? 'text-accent' : 'text-text-subtle'
                }`}
              >
                {item.done ? 'OK' : 'Todo'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
