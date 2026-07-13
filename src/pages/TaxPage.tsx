import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import {
  CGT_ALLOWANCES,
  calcTaxSummaryFromMatched,
  getCurrentTaxYear,
  type Disposal,
} from '../domain/cgt'
import {
  buildCgtReportHtml,
  exportCgtCsv,
  exportSa108Csv,
  exportTransactionLog,
  section104Summary,
  suggestDisposalsFromJournal,
} from '../domain/section104'
import { formatDate, formatGBP, formatGBPPrecise, privacyClass } from '../utils/format'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

export function TaxPage() {
  const { data, setData, privacy } = usePortfolio()
  const residency = data.settings.taxResidency || 'GB'
  const isUkTax = residency === 'GB'
  const years = Object.keys(CGT_ALLOWANCES)
  const [taxYear, setTaxYear] = useState(getCurrentTaxYear())
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    assetType: 'crypto' as 'crypto' | 'equity',
    symbol: '',
    qty: '',
    proceeds: '',
    cost: '',
  })

  const s104 = useMemo(
    () => section104Summary(data.disposals, taxYear, data.journal),
    [data.disposals, data.journal, taxYear],
  )

  const summary = useMemo(
    () => calcTaxSummaryFromMatched(s104.matched, taxYear),
    [s104.matched, taxYear],
  )

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
        title={isUkTax ? 'UK CGT' : `Capital gains (${residency})`}
        description={
          isUkTax
            ? 'Capital gains with §104 pooling from journal buys. Same-day / B&B heuristics when journal acquisitions exist.'
            : `Tax residency is ${residency}. Calculations below use UK CGT rules for reference only.`
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
            <button
              type="button"
              className="btn-secondary btn-sm inline-flex items-center gap-1.5"
              onClick={onExportCsv}
            >
              <Download size={14} strokeWidth={1.5} /> Export CSV
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={onExportSa108}>
              SA108 CSV
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={onExportTransactionLog}>
              Transaction log
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={onPrintReport}>
              Print / PDF
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
              Add disposal
            </button>
          </div>
        }
      />

      <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6">
        <p className="text-sm text-text-muted font-light">
          {isUkTax ? (
            <>
              Allowable cost prefers §104 pooled average from journal buys. Manual disposal cost is
              used when no pool exists. Not formal tax advice.
            </>
          ) : (
            <>
              <strong>Portfolio tax residency: {residency}</strong> — calculations below follow UK
              CGT rules and may not reflect {residency} tax law. Update residency in{' '}
              <Link to="/settings" className="text-accent hover:underline">
                Settings
              </Link>{' '}
              if needed. Not formal tax advice.
            </>
          )}
        </p>
      </div>
      <div className="surface p-5 sm:p-6 mb-px">
        <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
          Tax year
        </label>
        <select
          className="sm:w-56"
          value={taxYear}
          onChange={(e) => setTaxYear(e.target.value)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y} (allowance £{CGT_ALLOWANCES[y].toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-6">
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Same-day</p>
          <p className="text-2xl font-bold tabular-nums">{s104.byRule.sameDay}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Bed &amp; breakfast</p>
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

      {s104.matched.length > 0 && (
        <div className="surface overflow-x-auto mb-8">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-border">
                {['Date', 'Symbol', 'Rule', 'Allowable cost', 'Gain', 'Note'].map((h) => (
                  <th key={h} className="px-5 py-4 label-uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s104.matched.map((m) => (
                <tr key={`m-${m.disposal.id}`} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-sm">{formatDate(m.disposal.date)}</td>
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
          <p className="label-uppercase mb-2">Est. CGT (20%)</p>
          <p className="text-2xl font-bold text-accent">{formatGBP(summary.cgtDue)}</p>
        </div>
      </div>

      <div className="progress-track mb-8 mx-0">
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(100, (Math.max(0, summary.netGain) / summary.allowance) * 100)}%`,
          }}
        />
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              {['Date', 'Asset', 'Type', 'Qty', 'Proceeds', 'Cost', 'Gain / loss', ''].map((h) => (
                <th key={h || 'a'} className="px-5 py-4 label-uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.disposals.map((d) => {
              const matched = s104.matched.find((m) => m.disposal.id === d.id)
              const g = matched?.gain ?? d.proceeds - d.cost
              const cost = matched?.allowableCost ?? d.cost
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-sm">{formatDate(d.date)}</td>
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
