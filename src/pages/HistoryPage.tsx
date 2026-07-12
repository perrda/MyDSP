import { useMemo, useState } from 'react'
import { PortfolioSeriesChart } from '../components/charts/PortfolioSeriesChart'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { appendManualSnapshot, normalizeHistoryDate } from '../domain/history'
import { formatDate, formatGBP, privacyClass } from '../utils/format'

export function HistoryPage() {
  const { data, setData, privacy } = usePortfolio()
  const [deleteDate, setDeleteDate] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      [...data.history]
        .map((h) => ({ ...h, date: normalizeHistoryDate(h.date) }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.history],
  )

  const exportCsv = () => {
    const header = 'date,netWorth,assets,crypto,equity,liabilities,source,notes\n'
    const body = rows
      .map((h) =>
        [
          h.date,
          h.netWorth,
          h.assets ?? '',
          h.crypto ?? '',
          h.equity ?? '',
          h.liabilities ?? '',
          h.source ?? '',
          `"${(h.notes ?? '').replace(/"/g, '""')}"`,
        ].join(','),
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mydsp-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Net worth history"
        description="Daily snapshots — edit by taking a new snapshot for today, or delete rows."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setData((prev) => appendManualSnapshot(prev))}
            >
              Snapshot now
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        }
      />

      <div className="mb-6">
        <PortfolioSeriesChart
          history={data.history}
          privacy={privacy}
          title="Net worth timeline"
          eyebrow="Chart"
          primary="netWorth"
          allowLayers
          defaultRange="12M"
          onSnapshot={() => setData((prev) => appendManualSnapshot(prev))}
        />
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-text-subtle">
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold text-right">Net worth</th>
              <th className="px-4 py-3 font-bold text-right">Crypto</th>
              <th className="px-4 py-3 font-bold text-right">Equity</th>
              <th className="px-4 py-3 font-bold text-right">Debt</th>
              <th className="px-4 py-3 font-bold">Source</th>
              <th className="px-4 py-3 font-bold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.date} className="border-b border-border/60">
                <td className="px-4 py-3 tabular-nums text-text-muted">{formatDate(h.date)}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${privacyClass(privacy)}`}>
                  {formatGBP(h.netWorth)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${privacyClass(privacy)}`}>
                  {h.crypto != null ? formatGBP(h.crypto) : '—'}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${privacyClass(privacy)}`}>
                  {h.equity != null ? formatGBP(h.equity) : '—'}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${privacyClass(privacy)}`}>
                  {h.liabilities != null ? formatGBP(h.liabilities) : '—'}
                </td>
                <td className="px-4 py-3 text-text-subtle uppercase text-[10px] tracking-widest font-bold">
                  {h.source ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setDeleteDate(h.date)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-10 text-center text-text-subtle">No snapshots yet.</p>
        )}
      </div>

      <ConfirmDialog
        open={deleteDate !== null}
        title="Delete snapshot"
        body={`Remove the snapshot for ${deleteDate}?`}
        onClose={() => setDeleteDate(null)}
        onConfirm={() => {
          if (!deleteDate) return
          setData((prev) => ({
            ...prev,
            history: prev.history.filter((h) => normalizeHistoryDate(h.date) !== deleteDate),
          }))
        }}
      />
    </div>
  )
}
