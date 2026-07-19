import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { BackNav } from '../components/ui/BackNav'
import { Field } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import type { ParsedBankRow } from '../services/csvImport'
import { parseBankCsv } from '../services/csvImport'
import { formatGBPPrecise } from '../utils/format'

type Convention = 'monzo' | 'positive_expense'

export function ImportPage() {
  const { setData, data } = usePortfolio()
  const [rows, setRows] = useState<ParsedBankRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [convention, setConvention] = useState<Convention>('monzo')

  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows])

  const onFile = async (file: File) => {
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseBankCsv(text, data.merchantRules, { convention })
    setRows(parsed)
    const income = parsed.filter((r) => r.isIncome).length
    const expense = parsed.length - income
    setMessage(
      parsed.length
        ? `Parsed ${parsed.length} rows (${expense} expenses, ${income} income). Income deselected by default.`
        : 'No valid rows found — check the CSV format.',
    )
  }

  const importSelected = () => {
    const selected = rows.filter((r) => r.selected)
    if (!selected.length) return
    const startId = data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1
    const expenses = selected.filter((r) => !r.isIncome)
    const incomes = selected.filter((r) => r.isIncome)
    setData((prev) => ({
      ...prev,
      spending: [
        ...prev.spending,
        ...expenses.map((r, i) => ({
          id: startId + i,
          date: r.date,
          description: r.description,
          amount: Math.abs(r.amount),
          category: r.category.toLowerCase(),
          method: 'debit' as const,
          createdAt: new Date().toISOString(),
        })),
      ],
    }))
    setMessage(
      `Imported ${expenses.length} expenses` +
        (incomes.length
          ? ` · skipped ${incomes.length} income rows (use Settings → monthly income)`
          : '') +
        '.',
    )
    setRows([])
    setFileName('')
  }

  return (
    <div>
      <div className="mb-4">
        <BackNav to="/import" label="Back to CSV import" />
      </div>
      <PageHeader
        eyebrow="Import"
        title="Bank CSV import"
        description="Upload Monzo or generic bank CSVs. Merchant rules apply first, then keyword guesses. Income rows are deselected by default."
      />

      <div className="legacy-import-psd2-notice surface border-l-2 border-l-border-strong px-5 py-3 mb-6">
        <p className="text-sm text-text font-normal">
          Open banking (PSD2) is not available — import CSVs only.
        </p>
        <Link
          to="/settings#open-banking"
          className="inline-block mt-1 text-sm font-semibold underline text-text hover:no-underline"
        >
          Settings → Open banking
        </Link>
      </div>
      {message && (
        <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6" role="status">
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="surface p-6 sm:p-10 mb-px">
        <p className="eyebrow mb-3">Upload</p>
        <h3 className="text-lg font-bold mb-4">Choose a CSV file</h3>
        <div className="mb-5 max-w-sm">
          <Field label="Amount sign convention">
            <select
              value={convention}
              onChange={(e) => setConvention(e.target.value as Convention)}
            >
              <option value="monzo">Monzo (positive = income)</option>
              <option value="positive_expense">Positive = expense</option>
            </select>
          </Field>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
        {fileName && (
          <p className="mt-3 text-sm text-text-subtle">Loaded: {fileName}</p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="surface p-5 flex flex-wrap items-center justify-between gap-4 mb-px">
            <p className="text-sm text-text-muted">
              {selectedCount} of {rows.length} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setRows((r) => r.map((x) => ({ ...x, selected: true })))}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setRows((r) => r.map((x) => ({ ...x, selected: false })))}
              >
                Clear
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={importSelected}>
                Import selected
              </button>
            </div>
          </div>

          <div className="surface overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="border-b border-border">
                  {['', 'Date', 'Description', 'Category', 'Type', 'Amount'].map((h) => (
                    <th key={h || 'check'} className="px-5 py-4 label-uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.date}-${i}`} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={() =>
                          setRows((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)),
                          )
                        }
                      />
                    </td>
                    <td className="px-5 py-3 text-sm text-text-muted">{r.date}</td>
                    <td className="px-5 py-3 text-sm font-medium max-w-xs truncate">
                      {r.description}
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-text-subtle">
                      {r.isIncome ? 'Income' : 'Expense'}
                    </td>
                    <td
                      className={`px-5 py-3 text-sm font-semibold tabular-nums ${
                        r.amount < 0 ? 'text-text' : 'text-accent'
                      }`}
                    >
                      {formatGBPPrecise(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p className="px-5 py-4 text-sm text-text-subtle">
                Showing first 200 of {rows.length} rows (all selected rows still import).
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
