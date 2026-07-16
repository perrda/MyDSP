import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { type Disposal } from '../domain/cgt'
import {
  buildCgtReportHtml,
  exportCgtCsv,
  exportSa108Csv,
  exportTransactionLog,
  section104Summary,
  suggestDisposalsFromJournal,
} from '../domain/section104'
import {
  calcTaxSummaryForPack,
  getCurrentPackYear,
  getTaxPack,
  listPackYears,
  matchDisposalsSimple,
} from '../domain/taxPacks'
import { taxYearProgress } from '../domain/taxYearProgress'
import { formatDate, formatGBP, formatGBPPrecise, privacyClass } from '../utils/format'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const ISA_ALLOWANCE_GBP = 20_000
const ISA_REMAINING_KEY = 'mydsp_isa_remaining_gbp'

function loadIsaRemainingDraft(): string {
  try {
    return localStorage.getItem(ISA_REMAINING_KEY) ?? ''
  } catch {
    return ''
  }
}

export function TaxPage() {
  const { data, setData, privacy } = usePortfolio()
  const [searchParams, setSearchParams] = useSearchParams()
  const residency = data.settings.taxResidency || 'GB'
  const pack = useMemo(() => getTaxPack(residency), [residency])
  const isUkTax = pack.code === 'GB' && pack.matching === 'uk-section104'
  const years = listPackYears(pack)
  const [taxYear, setTaxYear] = useState(() => getCurrentPackYear(pack))
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [exportsExplainerOpen, setExportsExplainerOpen] = useState(false)
  const [isaRemainingDraft, setIsaRemainingDraft] = useState(() => loadIsaRemainingDraft())
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    assetType: 'crypto' as 'crypto' | 'equity',
    symbol: '',
    qty: '',
    proceeds: '',
    cost: '',
  })

  useEffect(() => {
    const next = getCurrentPackYear(pack)
    const keys = listPackYears(pack)
    setTaxYear((prev) => (keys.includes(prev) ? prev : next))
  }, [pack])

  useEffect(() => {
    const symbol = searchParams.get('symbol')
    if (!symbol) return
    const assetType = searchParams.get('assetType') === 'equity' ? 'equity' : 'crypto'
    setForm({
      date: searchParams.get('date') || new Date().toISOString().slice(0, 10),
      assetType,
      symbol: symbol.toUpperCase(),
      qty: searchParams.get('qty') ?? '',
      proceeds: searchParams.get('proceeds') ?? '',
      cost: searchParams.get('cost') ?? '',
    })
    setOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    try {
      if (isaRemainingDraft.trim()) localStorage.setItem(ISA_REMAINING_KEY, isaRemainingDraft)
      else localStorage.removeItem(ISA_REMAINING_KEY)
    } catch {
      /* ignore */
    }
  }, [isaRemainingDraft])

  const matchedRows = useMemo(() => {
    if (isUkTax) {
      return section104Summary(data.disposals, taxYear, data.journal).matched.map((m) => ({
        disposal: m.disposal,
        gain: m.gain,
        allowableCost: m.allowableCost,
        matchedRule: m.matchedRule,
        note: m.note,
      }))
    }
    return matchDisposalsSimple(data.disposals, pack, taxYear)
  }, [data.disposals, data.journal, taxYear, isUkTax, pack])

  const s104 = useMemo(
    () =>
      isUkTax
        ? section104Summary(data.disposals, taxYear, data.journal)
        : {
            matched: matchedRows,
            byRule: { sameDay: 0, bedAndBreakfast: 0, section104: 0, unpooled: matchedRows.length },
          },
    [data.disposals, data.journal, taxYear, isUkTax, matchedRows],
  )

  const summary = useMemo(
    () => calcTaxSummaryForPack(matchedRows, taxYear, pack),
    [matchedRows, taxYear, pack],
  )

  const yearProgress = useMemo(
    () => taxYearProgress(pack, taxYear, summary.netGain),
    [pack, taxYear, summary.netGain],
  )

  const ratePct = Math.round(pack.rate * 100)
  const isaRemaining = isaRemainingDraft.trim()
    ? Math.max(0, Math.min(ISA_ALLOWANCE_GBP, parseNum(isaRemainingDraft)))
    : ISA_ALLOWANCE_GBP
  const isaUsed = ISA_ALLOWANCE_GBP - isaRemaining
  const isaUsedPct = ISA_ALLOWANCE_GBP > 0 ? isaUsed / ISA_ALLOWANCE_GBP : 0

  const onExportCsv = () => {
    const csv = exportCgtCsv(data.disposals, taxYear, data.journal)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cgt-${taxYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onExportSa108 = () => {
    const csv = exportSa108Csv(data.disposals, taxYear, data.journal)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sa108-${taxYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onPrintReport = () => {
    const html = buildCgtReportHtml(data.disposals, taxYear, data.journal, summary)
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  const onExportTransactionLog = () => {
    const csv = exportTransactionLog(data.disposals, taxYear, data.journal)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cgt-transactions-${taxYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFromJournal = () => {
    const suggested = suggestDisposalsFromJournal(data.journal, data.disposals)
    if (suggested.length === 0) return
    setData((prev) => ({ ...prev, disposals: [...prev.disposals, ...suggested] }))
  }

  const save = () => {
    const d: Disposal = {
      id: nextId(data.disposals),
      date: form.date,
      assetType: form.assetType,
      symbol: form.symbol.trim().toUpperCase() || '???',
      qty: parseNum(form.qty),
      proceeds: parseNum(form.proceeds),
      cost: parseNum(form.cost),
    }
    setData((prev) => ({ ...prev, disposals: [...prev.disposals, d] }))
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tax"
        title={isUkTax ? 'UK CGT' : `Capital gains (${pack.code})`}
        description={
          isUkTax
            ? 'Capital gains with §104 pooling from journal buys. Same-day / B&B heuristics when journal acquisitions exist.'
            : pack.hasCgt
              ? `${pack.label} pack — simplified ${ratePct}% reference rate on a ${pack.yearKind === 'calendar' ? 'calendar' : 'UK'} tax year.`
              : `${pack.label} — no personal CGT computed; disposal journal kept for records.`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={importFromJournal}
            >
              Import sells from journal
            </button>
            {pack.hasCgt ? (
              <button
                type="button"
                className="btn-secondary btn-sm inline-flex items-center gap-1.5"
                onClick={onExportCsv}
              >
                <Download size={14} strokeWidth={1.5} /> {pack.exportLabel}
              </button>
            ) : null}
            {isUkTax ? (
              <button type="button" className="btn-ghost btn-sm" onClick={onExportSa108}>
                SA108 CSV
              </button>
            ) : null}
            <button type="button" className="btn-ghost btn-sm" onClick={onExportTransactionLog}>
              Transaction log
            </button>
            {pack.hasCgt ? (
              <button type="button" className="btn-ghost btn-sm" onClick={onPrintReport}>
                Print / PDF
              </button>
            ) : null}
            <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
              Add disposal
            </button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-center gap-2 mb-4 text-xs text-text-muted"
        role="status"
        aria-label="Tax residency"
      >
        <span className="sync-chip sync-chip--ok !no-underline cursor-default">
          <span className="sync-chip-dot" aria-hidden />
          <span className="sync-chip-label">
            {pack.label} · {pack.code}
            {pack.hasCgt
              ? ` · ${pack.yearKind === 'calendar' ? 'calendar year' : 'UK tax year'}`
              : ' · no CGT computed'}
          </span>
        </span>
        <Link to="/settings#display" className="text-accent hover:underline min-h-11 inline-flex items-center">
          Change in Settings
        </Link>
      </div>

      <div className="surface border border-border px-4 py-3 mb-6">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 text-left min-h-11"
          aria-expanded={exportsExplainerOpen}
          onClick={() => setExportsExplainerOpen((v) => !v)}
        >
          <span className="text-sm font-semibold tracking-tight">What these exports mean</span>
          <span className="text-xs text-text-subtle shrink-0">
            {exportsExplainerOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        {exportsExplainerOpen ? (
          <div className="tax-exports-explainer mt-3 space-y-2 text-sm text-text-muted font-light leading-relaxed border-t border-border pt-3">
            <p>
              Residency pack: <strong className="text-text font-medium">{pack.label}</strong> ({pack.code}
              ). Export buttons above produce worksheets and journals for this pack — not a filed return.
            </p>
            <p>{pack.disclaimer}</p>
            {isUkTax ? (
              <p>
                UK CGT / SA108 CSV and the transaction log are working papers for Self Assessment or your
                adviser. Figures use §104 pooling when journal buys exist.
              </p>
            ) : pack.hasCgt ? (
              <p>
                “{pack.exportLabel}” is a simplified estimate export for {pack.label}. Use it with tax
                software or a preparer — MyDSP does not submit forms.
              </p>
            ) : (
              <p>
                This residency has no personal CGT computed here. Exports are disposal / journal records
                only.
              </p>
            )}
            <p>
              Change residency in{' '}
              <Link to="/settings#display" className="text-accent hover:underline">
                Settings → Display
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>

      <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6">
        <p className="text-sm text-text-muted font-light">
          {pack.disclaimer}{' '}
          {!isUkTax ? (
            <>
              Update residency in{' '}
              <Link to="/settings#display" className="text-accent hover:underline">
                Settings → Display
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>

      {pack.code === 'US' ? (
        <section
          className="surface border-l-2 border-l-border-strong px-5 py-4 mb-6"
          aria-labelledby="us-8949-heading"
        >
          <h2 id="us-8949-heading" className="text-sm font-bold tracking-tight mb-2">
            US Form 8949 / wash-sale (informational)
          </h2>
          <p className="text-sm text-text-muted font-light leading-relaxed max-w-3xl">
            MyDSP does <strong className="text-text font-medium">not</strong> generate Form 8949 or
            apply IRS wash-sale adjustments. The US pack uses a simplified FIFO-style cost basis and
            a flat long-term reference rate for estimates only. Export your journal CSV and complete
            Form 8949 (and Schedule D) in tax software or with a qualified preparer. Wash-sale
            tracking across accounts is out of scope here.
          </p>
        </section>
      ) : null}

      {!pack.hasCgt ? (
        <div className="surface p-8 sm:p-10 text-center mb-8">
          <p className="text-lg font-semibold mb-2">No CGT computed for {pack.label}</p>
          <p className="text-sm text-text-muted font-light max-w-lg mx-auto mb-6">
            You can still log disposals below for records. Switch residency in Settings if you need
            a simplified gain estimate for another jurisdiction.
          </p>
          <Link to="/settings" className="btn-secondary btn-sm">
            Open Settings
          </Link>
        </div>
      ) : null}

      <div className="surface p-5 sm:p-6 mb-px">
        <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
          {pack.yearKind === 'uk-apr' ? 'UK tax year' : 'Tax year'}
        </label>
        <select
          className="sm:w-56"
          value={taxYear}
          onChange={(e) => setTaxYear(e.target.value)}
          aria-label="Tax year"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
              {pack.hasCgt
                ? ` (allowance ${formatGBP(pack.allowances[y] ?? 0)})`
                : ''}
            </option>
          ))}
        </select>
      </div>

      <div
        className="tax-year-progress surface p-5 sm:p-6 mb-6 flex flex-wrap items-center gap-5"
        role="group"
        aria-label="Tax year progress"
      >
        <div
          className="relative shrink-0 w-16 h-16"
          role="img"
          aria-label={`${yearProgress.daysLeft} days left in tax year ${taxYear}`}
        >
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--border)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${yearProgress.yearPct * 97.4} 97.4`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums leading-tight text-center px-1">
            {yearProgress.daysLeft}d
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-text-subtle font-semibold mb-1">
            Tax year · {taxYear}
          </p>
          <p className="text-sm font-semibold tracking-tight">
            {yearProgress.daysLeft === 0
              ? 'Tax year ended'
              : `${yearProgress.daysLeft} day${yearProgress.daysLeft === 1 ? '' : 's'} left`}
          </p>
          {pack.hasCgt && yearProgress.allowance > 0 ? (
            <p className={`text-xs text-text-muted font-light mt-1 tabular-nums ${privacyClass(privacy)}`}>
              Est. CGT used {formatGBP(yearProgress.cgtUsed)} of {formatGBP(yearProgress.allowance)}
              {yearProgress.cgtUsedPct != null
                ? ` (${Math.round(Math.min(yearProgress.cgtUsedPct, 9.99) * 100)}%)`
                : ''}
            </p>
          ) : pack.hasCgt ? (
            <p className={`text-xs text-text-muted font-light mt-1 tabular-nums ${privacyClass(privacy)}`}>
              Net gain {formatGBP(summary.netGain)} · no annual allowance in this pack
            </p>
          ) : (
            <p className="text-xs text-text-muted font-light mt-1">
              No personal CGT computed for this residency
            </p>
          )}
        </div>
        {pack.hasCgt && yearProgress.allowance > 0 ? (
          <div
            className="relative shrink-0 w-16 h-16"
            role="img"
            aria-label={`CGT allowance ${Math.round(Math.min(yearProgress.cgtUsedPct ?? 0, 1) * 100)}% used`}
          >
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--border)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(yearProgress.cgtUsedPct ?? 0, 1) * 97.4} 97.4`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
              {Math.round(Math.min(yearProgress.cgtUsedPct ?? 0, 9.99) * 100)}%
            </span>
          </div>
        ) : null}
        {isUkTax ? (
          <div
            className="tax-isa-allowance-progress flex min-w-[12rem] flex-1 items-center gap-3 border-l border-border pl-4"
            aria-label="ISA annual allowance progress"
          >
            <div
              className="relative shrink-0 w-16 h-16"
              role="img"
              aria-label={`ISA annual allowance ${Math.round(Math.min(isaUsedPct, 1) * 100)}% used`}
            >
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(isaUsedPct, 1) * 97.4} 97.4`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
                {Math.round(Math.min(isaUsedPct, 1) * 100)}%
              </span>
            </div>
            <label className="min-w-0 flex-1 text-xs text-text-muted font-light">
              <span className="block text-xs uppercase tracking-wider text-text-subtle font-semibold mb-1">
                ISA allowance
              </span>
              <span className={`block mb-2 tabular-nums ${privacyClass(privacy)}`}>
                Used {formatGBP(isaUsed)} of {formatGBP(ISA_ALLOWANCE_GBP)}
              </span>
              <span className="sr-only">Manual remaining GBP</span>
              <input
                type="text"
                inputMode="decimal"
                className="max-w-[9rem] px-2 py-1 text-xs"
                value={isaRemainingDraft}
                onChange={(e) => setIsaRemainingDraft(e.target.value)}
                placeholder="Remaining £"
                aria-label="Manual remaining ISA allowance in pounds"
              />
            </label>
          </div>
        ) : null}
      </div>

      {isUkTax ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-6">
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Same-day</p>
          <p className="text-2xl font-bold tabular-nums">{s104.byRule.sameDay}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Bed & breakfast</p>
          <p className="text-2xl font-bold tabular-nums">{s104.byRule.bedAndBreakfast}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Section 104</p>
          <p className="text-2xl font-bold tabular-nums">{s104.byRule.section104}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Unpooled</p>
          <p className="text-2xl font-bold tabular-nums">{s104.byRule.unpooled}</p>
        </div>
      </div>
      ) : pack.hasCgt ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px mb-6">
          <div className="surface p-6">
            <p className="label-uppercase mb-2">Matching</p>
            <p className="text-2xl font-bold tabular-nums">{matchedRows.length}</p>
            <p className="text-xs text-text-subtle mt-1">Simplified cost basis rows</p>
          </div>
          <div className="surface p-6">
            <p className="label-uppercase mb-2">Reference rate</p>
            <p className="text-2xl font-bold tabular-nums text-accent">{ratePct}%</p>
          </div>
        </div>
      ) : null}

      {matchedRows.length > 0 && pack.hasCgt && (
        <div className="table-wrap surface overflow-x-auto mb-8">
          <table className="w-full text-left min-w-[720px]" aria-label="Matched disposals">
            <caption className="sr-only">Matched disposal rules and gains for {taxYear}</caption>
            <thead>
              <tr className="border-b border-border">
                {['Date', 'Symbol', 'Rule', 'Allowable cost', 'Gain', 'Note'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-4 label-uppercase${i === 0 ? ' table-sticky-col' : ''}`}
                    scope="col"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matchedRows.map((m) => (
                <tr key={`m-${m.disposal.id}`} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-sm table-sticky-col">{formatDate(m.disposal.date)}</td>
                  <td className="px-5 py-3 font-semibold">{m.disposal.symbol}</td>
                  <td className="px-5 py-3 text-xs uppercase tracking-wider text-text-subtle">
                    {m.matchedRule}
                  </td>
                  <td className={`px-5 py-3 text-sm tabular-nums ${privacyClass(privacy)}`}>
                    {formatGBPPrecise(m.allowableCost)}
                  </td>
                  <td className={`px-5 py-3 text-sm tabular-nums ${privacyClass(privacy)}`}>
                    {formatGBP(m.gain, { signed: true })}
                  </td>
                  <td className="px-5 py-3 text-xs text-text-muted font-light max-w-xs">
                    {m.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pack.hasCgt ? (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Net gain</p>
          <p className="text-2xl font-bold">{formatGBP(summary.netGain)}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Allowance used</p>
          <p className="text-2xl font-bold">
            {formatGBP(Math.min(summary.allowance, Math.max(0, summary.netGain)))}
          </p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Taxable</p>
          <p className="text-2xl font-bold">{formatGBP(summary.taxableGain)}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">
            Est. tax{ratePct > 0 ? ` (${ratePct}%)` : ''}
          </p>
          <p className="text-2xl font-bold text-accent">{formatGBP(summary.cgtDue)}</p>
        </div>
      </div>
      ) : null}

      {pack.hasCgt && summary.allowance > 0 ? (
      <div className="progress-track mb-8 mx-0">
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(100, (Math.max(0, summary.netGain) / summary.allowance) * 100)}%`,
          }}
        />
      </div>
      ) : null}

      <div className="table-wrap surface overflow-x-auto">
        <table className="w-full text-left min-w-[720px]" aria-label="Disposals list">
          <caption className="sr-only">All disposals in {taxYear}</caption>
          <thead>
            <tr className="border-b border-border">
              {['Date', 'Asset', 'Type', 'Qty', 'Proceeds', 'Cost', 'Gain / loss', ''].map((h, i) => (
                <th
                  key={h || 'a'}
                  className={`px-5 py-4 label-uppercase${i === 0 ? ' table-sticky-col' : ''}`}
                  scope="col"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.disposals.map((d) => {
              const matched = matchedRows.find((m) => m.disposal.id === d.id)
              const g = matched?.gain ?? d.proceeds - d.cost
              const cost = matched?.allowableCost ?? d.cost
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-sm table-sticky-col">{formatDate(d.date)}</td>
                  <td className="px-5 py-3 font-semibold">{d.symbol}</td>
                  <td className="px-5 py-3 text-sm text-text-subtle">{d.assetType}</td>
                  <td className="px-5 py-3 text-sm tabular-nums">{d.qty}</td>
                  <td className="px-5 py-3 text-sm tabular-nums">{formatGBPPrecise(d.proceeds)}</td>
                  <td className="px-5 py-3 text-sm tabular-nums">{formatGBPPrecise(cost)}</td>
                  <td
                    className={`px-5 py-3 text-sm font-semibold tabular-nums ${
                      g >= 0 ? 'text-accent' : 'text-text-muted'
                    }`}
                  >
                    {formatGBPPrecise(g)}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setDeleteId(d.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
            {summary.disposals.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-text-subtle">
                  No disposals in {taxYear}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Add disposal" onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Date">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <select
                value={form.assetType}
                onChange={(e) =>
                  setForm({ ...form, assetType: e.target.value as 'crypto' | 'equity' })
                }
              >
                <option value="crypto">Crypto</option>
                <option value="equity">Equity</option>
              </select>
            </Field>
            <Field label="Symbol">
              <input
                type="text"
                required
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Qty">
              <input
                type="text"
                inputMode="decimal"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </Field>
            <Field label="Proceeds £">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.proceeds}
                onChange={(e) => setForm({ ...form, proceeds: e.target.value })}
              />
            </Field>
            <Field label="Cost £">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete disposal"
        body="Remove this disposal from the tax year?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            disposals: prev.disposals.filter((d) => d.id !== deleteId),
          }))
        }}
      />
    </div>
  )
}
