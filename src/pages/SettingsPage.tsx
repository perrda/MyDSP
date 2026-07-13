import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useSecurity } from '../components/SecurityProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { holdingHistoryKey, readHoldingHistory } from '../domain/holdingHistory'
import type { HoldingPricePoint } from '../domain/holdingHistory'
import { registerStaticPriceFile } from '../domain/staticPrices'
import {
  clearOfflineQueue,
  enqueueOfflineJob,
  isOnline,
  loadOfflineQueue,
  removeOfflineJob,
  type OfflineJob,
} from '../services/offlineQueue'
import { DISPLAY_CURRENCIES } from '../services/fx'
import { fetchSymbolHistory } from '../services/yahooHistory'
import {
  conflictKey,
  type ConflictChoice,
  type SyncConflict,
} from '../services/sync/conflicts'
import {
  downloadEncryptedBackup,
  importEncryptedFile,
  loadSyncConfig,
  pullAndMerge,
  pushSync,
  saveSyncConfig,
} from '../services/sync/syncService'
import {
  clearBiometricCred,
  hashPin,
  loadSecurity,
  registerBiometric,
  saveSecurity,
  type SecurityState,
} from '../security/pin'
import {
  clearServiceWorkerCaches,
  createFullBackup,
  deleteFullBackup,
  downloadFullBackupFile,
  getFullBackup,
  listFullBackups,
  MAX_BACKUPS,
  saveFullBackupToFolder,
  parseFullBackupFile,
  restoreFullWorkspace,
  shareBackupFile,
  canUseNativeShare,
  type FullBackupMeta,
} from '../storage/backupStore'
import { STORAGE } from '../storage/keys'
import { resetNavOrder } from '../storage/navOrder'
import {
  getSessionSyncPassphrase,
  setSessionSyncPassphrase,
} from '../services/sync/sessionPassphrase'

const TRADE_TEMPLATES = [
  { symbol: 'TSLA', kind: 'equity' as const, href: 'data/templates/trades-TSLA.csv' },
  { symbol: 'MSTR', kind: 'equity' as const, href: 'data/templates/trades-MSTR.csv' },
  { symbol: 'BTC', kind: 'crypto' as const, href: 'data/templates/trades-BTC.csv' },
]

const TAX_RESIDENCIES = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'TH', label: 'Thailand' },
  { code: 'IE', label: 'Ireland' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'SG', label: 'Singapore' },
  { code: 'XX', label: 'Other' },
]

export function SettingsPage() {
  const {
    data,
    portfolios,
    activeId,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    switchPortfolio,
    resetToSample,
    clearAll,
    importJson,
    exportJson,
    fccDataPresent,
    reload,
    setData,
    setCurrency,
    canAddPortfolio,
    maxPortfolios,
    fxRates,
  } = usePortfolio()
  const { refreshSecurity, lock, pinEnabled } = useSecurity()

  const fileRef = useRef<HTMLInputElement>(null)
  const priceFileRef = useRef<HTMLInputElement>(null)
  const fullBackupFileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [backups, setBackups] = useState<FullBackupMeta[]>([])
  const [backupBusy, setBackupBusy] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [backfillKind, setBackfillKind] = useState<'crypto' | 'equity'>('equity')
  const [backfillSymbol, setBackfillSymbol] = useState('TSLA')
  const [backfillFrom, setBackfillFrom] = useState('2020-01-01')
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [queue, setQueue] = useState<OfflineJob[]>(() => loadOfflineQueue())
  const [sec, setSec] = useState<SecurityState>(() => loadSecurity())
  const [syncCfg, setSyncCfg] = useState(loadSyncConfig)
  const [syncPass, setSyncPass] = useState(() => getSessionSyncPassphrase() ?? '')
  const syncFileRef = useRef<HTMLInputElement>(null)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [conflictChoices, setConflictChoices] = useState<Record<string, ConflictChoice>>({})
  const [cloudEmail, setCloudEmail] = useState(() => {
    try {
      return localStorage.getItem('mydsp_cloud_email') ?? ''
    } catch {
      return ''
    }
  })

  const refreshBackupList = () => {
    void listFullBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
  }

  useEffect(() => {
    refreshBackupList()
  }, [])

  const flash = (msg: string) => {
    setMessage(msg)
    window.setTimeout(() => setMessage(null), 5000)
  }

  const persistSecurity = (next: SecurityState) => {
    saveSecurity(next)
    setSec(next)
    refreshSecurity()
  }

  const onExportCsv = () => {
    const header = 'date,description,category,method,amount,tripId,paidBy,split\n'
    const body = data.spending
      .map((s) =>
        [
          s.date,
          `"${s.description.replace(/"/g, '""')}"`,
          s.category,
          s.method,
          s.amount,
          s.tripId ?? '',
          s.paidBy ?? '',
          s.split ?? '',
        ].join(','),
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mydsp-spending-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    flash('Spending CSV downloaded.')
  }

  const onExport = () => {
    const payload = exportJson()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mydsp-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup downloaded.')
  }

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      importJson(raw)
      flash('Import successful — portfolio updated.')
    } catch {
      flash('Import failed — check the JSON file.')
    }
  }

  const onImportFccLive = () => {
    try {
      const raw = localStorage.getItem(STORAGE.DATA)
      if (!raw) {
        flash('No dfc_data_v3 found in this browser.')
        return
      }
      importJson(JSON.parse(raw))
      flash('Imported live FCC data from this browser.')
    } catch {
      flash('Could not read FCC data.')
    }
  }

  const persistPricePoints = (
    kind: 'crypto' | 'equity',
    symbol: string,
    points: HoldingPricePoint[],
  ) => {
    const key = holdingHistoryKey(kind, symbol)
    setData((prev) => {
      const map = readHoldingHistory(prev)
      map[key] = points.sort((a, b) => a.date.localeCompare(b.date))
      return { ...prev, extras: { ...prev.extras, holdingHistory: map } }
    })
    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify({ symbol, series: points.map((p) => [p.date, p.price]) })], {
        type: 'application/json',
      }),
    )
    registerStaticPriceFile(kind, symbol, blobUrl)
  }

  const onImportPriceHistory = async (file: File) => {
    const symbol = backfillSymbol.trim().toUpperCase()
    if (!symbol) {
      flash('Enter a symbol first.')
      return
    }
    try {
      const text = await file.text()
      const json = JSON.parse(text) as {
        series?: [string, number][]
        symbol?: string
      }
      const series = json.series
      if (!Array.isArray(series) || series.length === 0) {
        flash('JSON needs a non-empty series: [["YYYY-MM-DD", price], ...]')
        return
      }
      const points: HoldingPricePoint[] = series
        .filter((row) => Array.isArray(row) && typeof row[0] === 'string' && Number(row[1]) > 0)
        .map(([date, price]) => ({
          date: String(date).slice(0, 10),
          price: Number(price),
          source: 'manual' as const,
        }))
      if (points.length === 0) {
        flash('No valid price rows found.')
        return
      }
      persistPricePoints(backfillKind, symbol, points)
      flash(`Imported ${points.length} daily prices for ${symbol}.`)
    } catch {
      flash('Could not parse price JSON.')
    }
  }

  const onFetchYahoo = async () => {
    const symbol = backfillSymbol.trim().toUpperCase()
    if (!symbol) {
      flash('Enter a symbol first.')
      return
    }
    setBackfillBusy(true)
    try {
      const { points, currency, yahooSymbol } = await fetchSymbolHistory(
        backfillKind,
        symbol,
        backfillFrom || '2015-01-01',
      )
      if (points.length === 0) {
        flash(`No Yahoo data for ${yahooSymbol}. Try another symbol or from-date.`)
        return
      }
      persistPricePoints(
        backfillKind,
        symbol,
        points.map((p) => ({ date: p.date, price: p.price, source: 'manual' as const })),
      )
      flash(`Fetched ${points.length} ${currency} closes for ${symbol} (${yahooSymbol}).`)
    } catch {
      flash('Yahoo fetch failed — check network or try again.')
    } finally {
      setBackfillBusy(false)
    }
  }

  const testSyncEndpoint = async () => {
    if (!syncCfg.remoteUrl) {
      flash('Enter a remote URL first.')
      return
    }
    try {
      const t0 = performance.now()
      const res = await fetch(syncCfg.remoteUrl, { method: 'GET' })
      const ms = Math.round(performance.now() - t0)
      flash(`Endpoint ${res.status} in ${ms}ms${res.ok ? '' : ' — check CORS / auth'}.`)
    } catch {
      flash('Endpoint unreachable (offline or CORS).')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings & data"
        description="Portfolios, FCC import, backup, and privacy. Storage keys stay compatible with FCC v7.60."
      />

      {message && (
        <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6" role="status">
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-px">
        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Layout</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Sidebar menu order</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Drag the grip next to each item in the left menu to rearrange. Order is saved in this
            browser. Reset restores the default sequence.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              resetNavOrder()
              window.dispatchEvent(new Event('mydsp-nav-order'))
              flash('Sidebar menu order reset to defaults.')
            }}
          >
            Reset sidebar order
          </button>
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">FCC bridge</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Import your Financial Command Centre data</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            MyDSP reads the same <code className="text-accent">dfc_data_v3</code> key FCC uses.
            {fccDataPresent
              ? ' Live FCC data was detected in this browser.'
              : ' No live FCC blob detected here — use a JSON backup export from FCC instead.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={onImportFccLive} disabled={!fccDataPresent}>
              Import live FCC data
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              Import JSON backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Display</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Currency &amp; tax residency</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Stored per active portfolio. Amounts stay in GBP internally; display currency uses FX.
            Tax residency flags CGT / reporting context for this workspace.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            <label className="block">
              <span className="label-uppercase block mb-2">Display currency</span>
              <select
                value={data.settings.currency || 'GBP'}
                onChange={(e) => {
                  setCurrency(e.target.value)
                  flash(`Display currency set to ${e.target.value}.`)
                }}
              >
                {DISPLAY_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-uppercase block mb-2">Tax residency</span>
              <select
                value={data.settings.taxResidency || 'GB'}
                onChange={(e) => {
                  const code = e.target.value
                  setData((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, taxResidency: code },
                  }))
                  flash(`Tax residency set to ${code}.`)
                }}
              >
                {TAX_RESIDENCIES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label} ({t.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-text-muted mt-4 label-muted">
            Active portfolio: {portfolios.find((p) => p.id === activeId)?.name ?? activeId}
            {fxRates.USD
              ? ` · GBP/USD ${fxRates.USD.toFixed(4)} (1 GBP = ${fxRates.USD.toFixed(2)} USD)`
              : ''}
          </p>
        </section>

        <section className="surface p-6 sm:p-8" id="trade-history">
          <p className="eyebrow mb-3">David · holdings</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">TSLA / MSTR / BTC trade history</h3>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Download a CSV template, fill your dated buys/sells (GBP unit prices), then open the
            holding → <strong className="text-text">Import history</strong>. Pre-2014 BTC dates use
            the OTC overlay below. For positions without journal legs, use the{' '}
            <Link to="/setup/opening" className="text-accent hover:underline">
              opening-balance wizard
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            {TRADE_TEMPLATES.map((t) => (
              <a
                key={t.symbol}
                className="btn-secondary btn-sm"
                href={`${import.meta.env.BASE_URL}${t.href}`}
                download={`trades-${t.symbol}.csv`}
              >
                {t.symbol} template
              </a>
            ))}
            <Link to="/setup/opening" className="btn-ghost btn-sm">
              Opening wizard
            </Link>
            <Link to="/compare" className="btn-ghost btn-sm">
              Compare portfolios
            </Link>
          </div>
          <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5 max-w-2xl">
            <li>
              Switch header portfolio to <strong className="text-text">David</strong>
            </li>
            <li>Equities → TSLA / MSTR or Crypto → BTC → Import history</li>
            <li>Paste CSV or use multi-row entry; journal rebuilds cost basis</li>
          </ol>
        </section>

        <section className="surface p-6 sm:p-8" id="price-history">
          <p className="eyebrow mb-3">Markets</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Historical prices &amp; OTC</h3>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Bundled daily closes: <strong className="text-text">TSLA</strong> /{' '}
            <strong className="text-text">MSTR</strong> (USD→GBP via GBPUSD),{' '}
            <strong className="text-text">BTC</strong> (GBP). Live equity refreshes convert USD
            quotes to GBP with the daily FX rate. Upload a JSON series for any other symbol, or a
            pre-2014 BTC OTC overlay. Format:{' '}
            <code className="text-accent">{`{ "series": [["2013-01-01", 12.5], ...] }`}</code>
          </p>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Kind
              <select
                className="mt-2 block"
                value={backfillKind}
                onChange={(e) => setBackfillKind(e.target.value as 'crypto' | 'equity')}
              >
                <option value="crypto">Crypto</option>
                <option value="equity">Equity</option>
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Symbol
              <input
                className="mt-2 block uppercase"
                value={backfillSymbol}
                onChange={(e) => setBackfillSymbol(e.target.value.toUpperCase())}
                placeholder="ETH / AAPL"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              From
              <input
                type="date"
                className="mt-2 block"
                value={backfillFrom}
                onChange={(e) => setBackfillFrom(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={backfillBusy}
              onClick={() => void onFetchYahoo()}
            >
              {backfillBusy ? 'Fetching…' : 'Fetch from Yahoo'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => priceFileRef.current?.click()}
            >
              Upload price JSON
            </button>
            <input
              ref={priceFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportPriceHistory(f)
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-xs text-text-subtle font-light max-w-2xl">
            Pre-2014 BTC: upload OTC rows into{' '}
            <code className="text-accent">btc-gbp-otc.json</code> format via Upload, or place the
            file under <code className="text-accent">public/data/prices/</code>. HTTPS host: see{' '}
            <code className="text-accent">DEPLOY.md</code>.
          </p>
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Security</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">PIN lock</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            4-digit PIN with optional biometrics and auto-lock. Compatible with FCC security keys.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-lg">
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              New PIN
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="mt-2"
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle">
              Confirm
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="mt-2"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void (async () => {
                  if (pinDraft.length !== 4 || pinDraft !== pinConfirm) {
                    flash('Enter a matching 4-digit PIN.')
                    return
                  }
                  const pinHash = await hashPin(pinDraft)
                  persistSecurity({ ...sec, pinEnabled: true, pinHash })
                  setPinDraft('')
                  setPinConfirm('')
                  flash('PIN enabled.')
                })()
              }}
            >
              Enable / update PIN
            </button>
            {pinEnabled && (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    persistSecurity({
                      ...sec,
                      pinEnabled: false,
                      pinHash: '',
                      biometricEnabled: false,
                    })
                    clearBiometricCred()
                    flash('PIN disabled.')
                  }}
                >
                  Disable PIN
                </button>
                <button type="button" className="btn-ghost" onClick={() => lock()}>
                  Lock now
                </button>
              </>
            )}
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Auto-lock (minutes)
          </label>
          <select
            className="max-w-xs mb-6"
            value={sec.autoLockMinutes}
            onChange={(e) => {
              const autoLockMinutes = Number(e.target.value)
              persistSecurity({ ...sec, autoLockMinutes })
              flash('Auto-lock updated.')
            }}
          >
            {[0, 1, 5, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'Off' : `${m} min`}
              </option>
            ))}
          </select>
          <div>
            <button
              type="button"
              className="btn-secondary"
              disabled={!sec.pinEnabled}
              onClick={() => {
                void (async () => {
                  const ok = await registerBiometric()
                  if (ok) {
                    persistSecurity({ ...sec, biometricEnabled: true })
                    flash('Biometrics registered.')
                  } else flash('Biometrics unavailable or cancelled.')
                })()
              }}
            >
              {sec.biometricEnabled ? 'Re-register biometrics' : 'Enable biometrics'}
            </button>
            <p className="text-xs text-text-subtle mt-3 max-w-xl">
              Face ID / Touch ID (WebAuthn) requires a secure context — use an HTTPS PWA host, not
              plain HTTP LAN.
            </p>
          </div>
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Income</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Monthly income</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Used by Monthly review for surplus calculations.
          </p>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Amount £
          </label>
          <input
            key={`income-${activeId}`}
            type="text"
            inputMode="decimal"
            className="max-w-xs"
            defaultValue={data.monthlyIncome || ''}
            onBlur={(e) => {
              const n = Number(String(e.target.value).replace(/,/g, ''))
              setData((prev) => ({
                ...prev,
                monthlyIncome: Number.isFinite(n) ? n : 0,
              }))
              flash('Monthly income saved.')
            }}
          />
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Prices</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Live market data</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Crypto prices use CoinGecko (no key). Equities use Finnhub if you add a free API key,
            otherwise Yahoo via a CORS proxy. Use the Prices button in the header to refresh.
          </p>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Finnhub API key
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              key={`finnhub-${activeId}`}
              type="password"
              autoComplete="off"
              placeholder="Optional — finnhub.io"
              defaultValue={data.settings.finnhubKey ?? ''}
              onBlur={(e) => {
                const key = e.target.value.trim()
                setData((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, finnhubKey: key || undefined },
                }))
                try {
                  if (key) localStorage.setItem('finnhub_key', key)
                  else localStorage.removeItem('finnhub_key')
                } catch {
                  /* ignore */
                }
                flash(key ? 'Finnhub key saved.' : 'Finnhub key cleared.')
              }}
            />
          </div>
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Devices</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Install on iPhone &amp; iPad</h3>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl leading-relaxed">
            Pin MyDSP as a home-screen app so it opens full-screen with the orange icon. Data on
            each device is local-first (same browser origin). Use Encrypted cloud sync below to
            keep web, iPhone, and iPad aligned.
          </p>
          <ol className="text-sm text-text-muted font-light space-y-2 mb-6 max-w-2xl list-decimal list-inside leading-relaxed">
            <li>
              Open MyDSP in <span className="text-text font-medium">Safari</span> (required on iOS).
            </li>
            <li>
              Tap <span className="text-text font-medium">Share</span>, then{' '}
              <span className="text-text font-medium">Add to Home Screen</span>.
            </li>
            <li>Confirm the name <span className="text-text font-medium">MyDSP</span> and add.</li>
            <li>
              After install, push/pull via Sync so every device shares the same portfolios.
            </li>
          </ol>
          <p className="text-xs text-text-subtle leading-relaxed max-w-2xl">
            On desktop Chrome/Edge, use the install banner or the browser&apos;s Install app menu.
            Android: browser menu → Install app / Add to Home screen.
          </p>
        </section>

        <section id="sync" className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Sync</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Encrypted cloud sync</h3>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Local-first: encrypt all portfolios <em>and</em> a full workspace archive with a
            passphrase, then push/pull to any HTTPS endpoint that accepts JSON. Passphrase stays in
            this tab&apos;s memory so offline queue can flush without re-typing. See{' '}
            <code className="text-accent">sync-endpoint/</code> for a free Cloudflare Worker.
          </p>
          <div className="border border-border p-4 mb-6 max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-subtle mb-3">
              Deploy checklist
            </p>
            <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5">
              <li>
                <code className="text-accent">npm run build</code> → ship{' '}
                <code className="text-accent">dist/</code>
              </li>
              <li>Host on HTTPS — already live at perrda.github.io/MyDSP (GitHub Pages)</li>
              <li>
                Deploy <code className="text-accent">sync-endpoint/worker.js</code> (Cloudflare KV)
                or use S3/R2/NAS
              </li>
              <li>Set remote URL + passphrase → Push from desktop, Pull on phone</li>
            </ol>
          </div>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Remote URL
          </label>
          <input
            type="url"
            className="mb-4"
            placeholder="https://example.com/mydsp-backup.json"
            value={syncCfg.remoteUrl}
            onChange={(e) => {
              const next = { ...syncCfg, remoteUrl: e.target.value }
              setSyncCfg(next)
              saveSyncConfig(next)
            }}
          />
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Passphrase
          </label>
          <input
            type="password"
            className="mb-6 max-w-md"
            autoComplete="new-password"
            placeholder="Sync passphrase (session only — min 8 chars)"
            value={syncPass}
            onChange={(e) => {
              const v = e.target.value
              setSyncPass(v)
              setSessionSyncPassphrase(v)
            }}
          />
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void (async () => {
                  if (!syncPass || syncPass.length < 8) {
                    flash('Use a passphrase of at least 8 characters.')
                    return
                  }
                  if (!syncCfg.remoteUrl) {
                    flash('Set a remote URL first (or use encrypted file download).')
                    return
                  }
                  if (!isOnline()) {
                    enqueueOfflineJob('sync_push', {
                      remoteUrl: syncCfg.remoteUrl,
                      note: 'Will push when online using session passphrase',
                    })
                    setQueue(loadOfflineQueue())
                    flash('Offline — push queued. Come online and press Flush queue.')
                    return
                  }
                  try {
                    await pushSync(syncCfg.remoteUrl, syncPass)
                    const next = {
                      ...syncCfg,
                      enabled: true,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                    }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    flash('Encrypted backup pushed.')
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Push failed'
                    const next = { ...syncCfg, lastSyncError: msg }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    if (!isOnline()) {
                      enqueueOfflineJob('sync_push', { remoteUrl: syncCfg.remoteUrl, note: msg })
                      setQueue(loadOfflineQueue())
                    }
                    flash(msg)
                  }
                })()
              }}
            >
              Push
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void (async () => {
                  if (!syncPass || !syncCfg.remoteUrl) {
                    flash('Need remote URL and passphrase.')
                    return
                  }
                  try {
                    const r = await pullAndMerge(syncCfg.remoteUrl, syncPass, conflictChoices)
                    reload()
                    const next = {
                      ...syncCfg,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                      lastMergeCount: r.merged,
                    }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    setConflicts(r.conflicts)
                    if (r.conflicts.length > 0) {
                      flash(
                        `Merged ${r.merged} · ${r.conflicts.length} conflict(s) — choose Keep local/remote, then pull again.`,
                      )
                    } else {
                      setConflictChoices({})
                      flash(`Pulled & merged ${r.merged} portfolios.`)
                    }
                  } catch (e) {
                    flash(e instanceof Error ? e.message : 'Pull failed')
                  }
                })()
              }}
            >
              Pull & merge
            </button>
            <button type="button" className="btn-ghost" onClick={() => void testSyncEndpoint()}>
              Test endpoint
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                void (async () => {
                  if (!syncPass || syncPass.length < 8) {
                    flash('Use a passphrase of at least 8 characters.')
                    return
                  }
                  await downloadEncryptedBackup(syncPass)
                  flash('Encrypted sync file downloaded.')
                })()
              }}
            >
              Download .enc.json
            </button>
            <button type="button" className="btn-ghost" onClick={() => syncFileRef.current?.click()}>
              Import .enc.json
            </button>
            <input
              ref={syncFileRef}
              type="file"
              accept=".json,.enc.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                void (async () => {
                  if (!syncPass) {
                    flash('Enter passphrase first.')
                    return
                  }
                  try {
                    const r = await importEncryptedFile(f, syncPass)
                    reload()
                    const next = {
                      ...syncCfg,
                      lastMergeCount: r.merged,
                      lastSyncAt: new Date().toISOString(),
                      lastSyncError: undefined,
                    }
                    setSyncCfg(next)
                    saveSyncConfig(next)
                    flash(`Imported & merged ${r.merged} portfolios.`)
                  } catch (err) {
                    flash(err instanceof Error ? err.message : 'Import failed')
                  }
                })()
              }}
            />
          </div>
          {syncCfg.lastSyncAt && (
            <p className="text-xs text-text-subtle mb-2">
              Last sync {new Date(syncCfg.lastSyncAt).toLocaleString('en-GB')}
              {syncCfg.lastSyncError ? ` · ${syncCfg.lastSyncError}` : ''}
            </p>
          )}
          {syncCfg.lastMergeCount != null && (
            <p className="text-xs text-text-subtle">
              Last pull summary: merged {syncCfg.lastMergeCount} portfolio
              {syncCfg.lastMergeCount === 1 ? '' : 's'}
            </p>
          )}

          {queue.length > 0 && (
            <div className="border border-border p-4 mt-6 max-w-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-subtle">
                  Offline queue · {queue.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      void (async () => {
                        if (!isOnline()) {
                          flash('Still offline.')
                          return
                        }
                        for (const job of loadOfflineQueue()) {
                          if (job.type === 'quote_refresh') {
                            removeOfflineJob(job.id)
                            continue
                          }
                          if (job.type === 'sync_push' && job.remoteUrl) {
                            const pass = syncPass || getSessionSyncPassphrase() || ''
                            if (!pass || pass.length < 8) {
                              flash('Enter passphrase once this session, then flush.')
                              break
                            }
                            try {
                              await pushSync(job.remoteUrl, pass)
                              removeOfflineJob(job.id)
                            } catch (e) {
                              flash(e instanceof Error ? e.message : 'Flush failed')
                              break
                            }
                          }
                        }
                        setQueue(loadOfflineQueue())
                        flash('Queue flushed.')
                      })()
                    }}
                  >
                    Flush queue
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      clearOfflineQueue()
                      setQueue([])
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="text-sm text-text-muted space-y-1">
                {queue.map((j) => (
                  <li key={j.id}>
                    {j.type.replace('_', ' ')} · {new Date(j.createdAt).toLocaleString('en-GB')}
                    {j.note ? ` — ${j.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="mt-6 border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Sync conflicts</p>
              <p className="text-xs text-text-muted font-light">
                Same-id rows differ locally and remotely. Pick a side, then Pull &amp; merge again.
              </p>
              {conflicts.map((c) => {
                const key = conflictKey(c)
                return (
                  <div
                    key={`${c.portfolioId}-${key}`}
                    className="flex flex-wrap items-center gap-2 text-sm border-b border-border/60 pb-3"
                  >
                    <span className="uppercase text-[10px] tracking-widest text-text-subtle font-bold">
                      {c.collection}
                    </span>
                    <span className="font-medium">{c.localLabel}</span>
                    <span className="text-text-subtle">vs</span>
                    <span className="text-text-muted">{c.remoteLabel}</span>
                    <div className="flex gap-1 ml-auto">
                      <button
                        type="button"
                        className={`btn-sm ${conflictChoices[key] === 'local' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() =>
                          setConflictChoices((prev) => ({ ...prev, [key]: 'local' }))
                        }
                      >
                        Keep local
                      </button>
                      <button
                        type="button"
                        className={`btn-sm ${conflictChoices[key] === 'remote' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() =>
                          setConflictChoices((prev) => ({ ...prev, [key]: 'remote' }))
                        }
                      >
                        Keep remote
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Account</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Cloud account (preview)</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Optional email for a future cloud account. Sync remains passphrase-based — no OAuth yet.
          </p>
          <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
            Email
          </label>
          <input
            type="email"
            className="max-w-md"
            placeholder="you@example.com"
            value={cloudEmail}
            onChange={(e) => {
              const v = e.target.value
              setCloudEmail(v)
              try {
                if (v.trim()) localStorage.setItem('mydsp_cloud_email', v.trim())
                else localStorage.removeItem('mydsp_cloud_email')
              } catch {
                /* ignore */
              }
            }}
          />
        </section>

        <section className="surface p-6 sm:p-8" id="portfolios">
          <p className="eyebrow mb-3">Portfolios</p>
          <h3 className="text-lg font-bold tracking-tight mb-2">Family portfolios</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Up to {maxPortfolios} workspaces — <strong className="text-text">David</strong>{' '}
            plus {maxPortfolios - 1} others. New portfolios start empty so you can enter data
            manually. Set currency / tax residency per active portfolio above.{' '}
            <Link to="/setup/opening" className="text-accent hover:underline">
              Opening wizard
            </Link>
            {' · '}
            <Link to="/compare" className="text-accent hover:underline">
              Compare
            </Link>
          </p>
          <ul className="divide-y divide-border mb-6">
            {portfolios.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
                {renameId === p.id ? (
                  <form
                    className="flex flex-wrap gap-2 flex-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (renameDraft.trim()) {
                        renamePortfolio(p.id, renameDraft.trim())
                        flash(`Renamed to ${renameDraft.trim()}.`)
                      }
                      setRenameId(null)
                    }}
                  >
                    <input
                      className="flex-1 min-w-[10rem]"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary btn-sm">
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setRenameId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`text-left font-medium ${p.id === activeId ? 'text-accent' : ''}`}
                      onClick={() => switchPortfolio(p.id)}
                    >
                      {p.name}
                      {p.id === activeId ? ' · active' : ''}
                      {p.id === 'default' ? (
                        <span className="text-text-subtle font-light"> · primary</span>
                      ) : null}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setRenameId(p.id)
                          setRenameDraft(p.name)
                        }}
                      >
                        Rename
                      </button>
                      {p.id !== 'default' && (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete “${p.name}”? All holdings and history in that portfolio will be removed.`,
                              )
                            ) {
                              deletePortfolio(p.id)
                              flash(`Deleted ${p.name}.`)
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              placeholder="New portfolio name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!canAddPortfolio}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!canAddPortfolio}
              onClick={() => {
                if (!newName.trim()) return
                const r = createPortfolio(newName.trim())
                if (!r.ok) {
                  flash(r.error ?? 'Could not create')
                  return
                }
                setNewName('')
                flash('Empty portfolio created — add holdings when ready.')
              }}
            >
              Add portfolio
            </button>
          </div>
          <p className="text-xs text-text-subtle mt-3">
            {portfolios.length} / {maxPortfolios} used
            {!canAddPortfolio ? ' · delete one to add another' : ''}
          </p>
        </section>

        <section className="surface p-6 sm:p-8" id="full-backup">
          <p className="eyebrow mb-3">Backup</p>
          <h3 className="text-lg font-bold tracking-tight mb-2">Full MyDSP backup</h3>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Snapshots <strong className="text-text">every portfolio</strong> automatically once per
            day (keeps the last {MAX_BACKUPS}). You can also back up manually, download a file, or
            restore. Active-portfolio JSON export remains below for single-workspace copies.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              type="button"
              className="btn-primary"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    await createFullBackup('manual')
                    refreshBackupList()
                    flash('Full backup saved on this device.')
                  } catch {
                    flash('Backup failed — check browser storage permissions.')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              Backup now
            </button>
            {canUseNativeShare() && (
              <button
                type="button"
                className="btn-secondary"
                disabled={backupBusy}
                onClick={() => {
                  void (async () => {
                    setBackupBusy(true)
                    try {
                      const meta = await createFullBackup('manual', 'Share archive')
                      const full = await getFullBackup(meta.id)
                      if (full) {
                        const result = await shareBackupFile(full)
                        if (result === 'shared') {
                          flash('Backup shared successfully.')
                        } else if (result === 'cancelled') {
                          flash('Share cancelled.')
                        }
                      }
                      refreshBackupList()
                    } catch {
                      flash('Share failed.')
                    } finally {
                      setBackupBusy(false)
                    }
                  })()
                }}
              >
                Share backup
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    const meta = await createFullBackup('manual', 'Download archive')
                    const full = await getFullBackup(meta.id)
                    if (full) downloadFullBackupFile(full)
                    refreshBackupList()
                    flash('Full backup downloaded.')
                  } catch {
                    flash('Download failed.')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              Download JSON
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    const meta = await createFullBackup('manual', 'Folder export')
                    const full = await getFullBackup(meta.id)
                    if (!full) {
                      flash('Could not read backup.')
                      return
                    }
                    const result = await saveFullBackupToFolder(full)
                    refreshBackupList()
                    if (result === 'saved') {
                      flash('Saved to chosen folder (iCloud Drive / Google Drive / local).')
                    } else if (result === 'fallback') {
                      flash(
                        'Folder picker unavailable — file downloaded instead (share to iCloud/Drive).',
                      )
                    }
                  } catch {
                    flash('Folder export failed.')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              Save to folder…
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fullBackupFileRef.current?.click()}
            >
              Restore from file
            </button>
            <input
              ref={fullBackupFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                void (async () => {
                  try {
                    const text = await f.text()
                    const parsed = parseFullBackupFile(JSON.parse(text) as unknown)
                    if (!parsed) {
                      flash('Not a MyDSP full backup file.')
                      return
                    }
                    if (
                      !window.confirm(
                        `Replace ALL portfolios with backup from ${parsed.createdAt.slice(0, 10)} (v${parsed.appVersion})?`,
                      )
                    ) {
                      return
                    }
                    restoreFullWorkspace(parsed)
                    reload()
                    flash('Full workspace restored.')
                  } catch {
                    flash('Could not restore that file.')
                  }
                })()
                e.target.value = ''
              }}
            />
          </div>

          {backups.length === 0 ? (
            <p className="text-sm text-text-subtle">No local backups yet — one will run automatically today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {backups.map((b) => (
                <li key={b.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <p className="font-medium text-sm">{b.label}</p>
                    <p className="text-xs text-text-subtle">
                      {new Date(b.createdAt).toLocaleString('en-GB')} · v{b.appVersion} ·{' '}
                      {b.portfolioCount} portfolios · {b.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        void (async () => {
                          const full = await getFullBackup(b.id)
                          if (!full) return
                          if (
                            !window.confirm(
                              `Restore “${b.label}”? This replaces all current portfolios.`,
                            )
                          ) {
                            return
                          }
                          restoreFullWorkspace(full)
                          reload()
                          flash('Restored from local backup.')
                        })()
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        void (async () => {
                          const full = await getFullBackup(b.id)
                          if (full) downloadFullBackupFile(full)
                        })()
                      }}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        void (async () => {
                          await deleteFullBackup(b.id)
                          refreshBackupList()
                        })()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Export</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Active portfolio only</h3>
          <p className="text-sm text-text-muted font-light mb-6">
            Active: <strong>{portfolios.find((p) => p.id === activeId)?.name}</strong> ·{' '}
            {data.crypto.length} crypto · {data.equities.length} equities ·{' '}
            {data.creditCards.length + data.loans.length} debts
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={onExport}>
              Download JSON (active)
            </button>
            <button type="button" className="btn-ghost" onClick={onExportCsv}>
              Export spending CSV
            </button>
            <button type="button" className="btn-ghost" onClick={() => reload()}>
              Reload from storage
            </button>
          </div>
        </section>

        <section className="surface p-6 sm:p-8" id="versions">
          <p className="eyebrow mb-3">Versions</p>
          <h3 className="text-lg font-bold tracking-tight mb-2">App version &amp; rollback</h3>
          <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
            Running <strong className="text-text">v{__APP_VERSION__}</strong>. Full backups store
            the app version they were taken under. To roll back the <em>app code</em>, redeploy a
            previous build (see DEPLOY.md / Netlify–Vercel history), then restore a matching data
            backup if needed.
          </p>
          <ol className="text-sm text-text-muted font-light space-y-2 list-decimal pl-5 mb-6 max-w-2xl">
            <li>Take a manual full backup before upgrading or rolling back.</li>
            <li>Redeploy the older MyDSP release from your host or git tag.</li>
            <li>Clear the service worker cache (below) and hard-refresh.</li>
            <li>Restore the backup taken under that version if data looks wrong.</li>
          </ol>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void (async () => {
                await clearServiceWorkerCaches()
                flash('Caches cleared — reload the page to finish.')
                window.setTimeout(() => window.location.reload(), 800)
              })()
            }}
          >
            Clear SW cache &amp; reload
          </button>
        </section>

        <section className="surface p-6 sm:p-8">
          <p className="eyebrow mb-3">Danger zone</p>
          <h3 className="text-lg font-bold tracking-tight mb-3">Reset active portfolio</h3>
          <p className="text-sm text-text-muted font-light mb-6">
            Affects only the active portfolio. Prefer a full backup first.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (window.confirm('Replace active portfolio with FCC sample data?')) {
                  resetToSample()
                  flash('Loaded FCC sample portfolio.')
                }
              }}
            >
              Load sample data
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (window.confirm('Clear all holdings and history on this portfolio?')) {
                  clearAll()
                  flash('Portfolio cleared.')
                }
              }}
            >
              Clear portfolio
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
