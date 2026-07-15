import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle, Upload, X } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import type { ParsedBankRow } from '../services/csvImport'
import { parseCSVLine } from '../services/csvImport'
import {
  BANK_PRESETS,
  analyzeImportData,
  autoMapColumns,
  detectBankPreset,
  parseRowsWithBankPreset,
  validateImportData,
  type BankPreset,
  type ColumnMapping,
} from '../services/enhancedCsvImport'
import { resolveCategory } from '../domain/merchantRules'
import { formatGBP } from '../utils/format'

type ImportStep = 'upload' | 'preview' | 'mapping' | 'confirm'

const STEPS: ImportStep[] = ['upload', 'preview', 'mapping', 'confirm']

export function EnhancedImportPage() {
  const { setData, data } = usePortfolio()
  const { success, error: showError, warning } = useToasts()

  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState<BankPreset | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [rows, setRows] = useState<ParsedBankRow[]>([])
  const [analysisNote, setAnalysisNote] = useState<string | null>(null)
  const [importIncome, setImportIncome] = useState(false)

  const reset = () => {
    setStep('upload')
    setFile(null)
    setCsvData([])
    setHeaders([])
    setRows([])
    setMapping(null)
    setAnalysisNote(null)
    setImportIncome(false)
  }

  const handleFileSelect = async (selectedFile: File) => {
    try {
      setFile(selectedFile)
      const text = await selectedFile.text()
      const lines = text
        .replace(/^\uFEFF/, '')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)

      if (lines.length < 2) {
        showError('Invalid CSV', 'File must have at least a header row and one data row')
        return
      }

      const fileHeaders = parseCSVLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim())
      setHeaders(fileHeaders)

      const detected = detectBankPreset(fileHeaders)
      setSelectedPreset(detected)
      setMapping(autoMapColumns(fileHeaders, detected ?? undefined))

      if (detected) {
        success('Bank detected', `Detected ${detected.name} format`)
      }

      const dataRows = lines.slice(1).map((line) => {
        const values = parseCSVLine(line).map((v) => v.replace(/^["']|["']$/g, '').trim())
        const row: Record<string, string> = {}
        fileHeaders.forEach((header, i) => {
          row[header] = values[i] || ''
        })
        return row
      })

      setCsvData(dataRows)
      setStep('preview')
    } catch (err) {
      showError('Import failed', 'Could not read CSV file')
      console.error(err)
    }
  }

  const handlePreviewContinue = () => {
    if (!selectedPreset) {
      showError('No preset selected', 'Please select a bank preset')
      return
    }
    const nextMap = autoMapColumns(headers, selectedPreset)
    setMapping(nextMap)
    setStep('mapping')
  }

  const handleMappingContinue = () => {
    if (!selectedPreset || !mapping) {
      showError('Mapping incomplete', 'Select a bank format and map date / amount columns')
      return
    }
    const validation = validateImportData(csvData, mapping, selectedPreset)
    if (validation.length > 0 && validation.length >= csvData.length) {
      showError('Validation failed', validation.slice(0, 3).map((e) => e.error).join('; '))
      return
    }

    const parsed = parseRowsWithBankPreset(
      csvData,
      headers,
      selectedPreset,
      (description) => resolveCategory(description, data.merchantRules),
    )

    if (parsed.length === 0) {
      showError('No transactions found', 'Check the bank preset matches your CSV columns.')
      return
    }

    const stats = analyzeImportData(csvData, mapping, selectedPreset, data.spending)
    setAnalysisNote(
      [
        stats.duplicates > 0 ? `${stats.duplicates} possible duplicate(s) vs existing spending` : null,
        stats.dateRange ? `Date range ${stats.dateRange.from} → ${stats.dateRange.to}` : null,
        validation.length > 0 ? `${validation.length} row warning(s)` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    )

    setRows(parsed)
    setStep('confirm')
  }

  const handleImport = () => {
    const selected = rows.filter((r) => r.selected)
    if (!selected.length) {
      warning('No rows selected', 'Please select at least one transaction to import')
      return
    }

    const expenses = selected.filter((r) => !r.isIncome)
    const incomeRows = selected.filter((r) => r.isIncome)
    const toImport = importIncome ? selected : expenses

    if (toImport.length === 0) {
      warning(
        'Only income selected',
        'Turn on “Import income rows” or select expense rows to continue.',
      )
      return
    }

    const startId = data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1

    setData((prev) => ({
      ...prev,
      spending: [
        ...prev.spending,
        ...toImport.map((r, i) => ({
          id: startId + i,
          date: r.date,
          description: r.description,
          amount: Math.abs(r.amount),
          category: r.isIncome ? 'income' : r.category.toLowerCase(),
          method: 'debit' as const,
          createdAt: new Date().toISOString(),
        })),
      ],
    }))

    const skippedIncome = !importIncome ? incomeRows.length : 0
    success(
      'Import complete',
      `Imported ${toImport.length} transaction${toImport.length === 1 ? '' : 's'}${
        skippedIncome ? ` · skipped ${skippedIncome} income` : ''
      }`,
    )
    reset()
  }

  const stats = useMemo(() => {
    if (!rows.length) return null
    const selected = rows.filter((r) => r.selected)
    const expenses = selected.filter((r) => !r.isIncome)
    const income = selected.filter((r) => r.isIncome)
    const willImport = importIncome ? selected.length : expenses.length
    return {
      total: selected.length,
      expenses: expenses.length,
      income: income.length,
      willImport,
      totalExpense: expenses.reduce((sum, r) => sum + Math.abs(r.amount), 0),
      totalIncome: income.reduce((sum, r) => sum + Math.abs(r.amount), 0),
    }
  }, [rows, importIncome])

  const stepIndex = STEPS.indexOf(step)

  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Enhanced CSV Import"
        description="Smart bank detection, column mapping, duplicate hints, and honest income handling"
      />

      <nav className="flex items-center gap-2 mb-6 overflow-x-auto pb-2" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border ${
                step === s
                  ? 'bg-accent text-white border-accent'
                  : stepIndex > i
                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                    : 'bg-surface-hover text-text-muted border-border'
              }`}
              aria-current={step === s ? 'step' : undefined}
            >
              {stepIndex > i && <CheckCircle size={16} aria-hidden />}
              {s === 'upload'
                ? '1. Upload'
                : s === 'preview'
                  ? '2. Preview'
                  : s === 'mapping'
                    ? '3. Mapping'
                    : '4. Confirm'}
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" aria-hidden />}
          </div>
        ))}
      </nav>

      {step === 'upload' && (
        <div className="surface p-6 md:p-8">
          <h3 className="font-bold text-lg mb-4">Upload CSV file</h3>
          <p className="text-sm text-text-muted mb-6">
            We support {BANK_PRESETS.length} banks including Monzo, Revolut, Starling, HSBC, Barclays,
            Lloyds, and Nationwide. The system detects your bank format automatically.
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border p-8 cursor-pointer hover:border-accent transition-colors">
            <Upload size={48} className="text-accent mb-3" aria-hidden />
            <p className="text-sm font-medium mb-1">Choose a CSV file</p>
            <p className="text-xs text-text-muted">CSV only · quoted fields supported</p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Upload bank CSV file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFileSelect(f)
                e.target.value = ''
              }}
            />
          </label>

          <div className="mt-6 p-4 border border-accent/20 bg-accent/5">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-accent" aria-hidden />
              Supported banks
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {BANK_PRESETS.slice(0, -1).map((preset) => (
                <div key={preset.id} className="text-text-muted">
                  · {preset.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="surface p-6">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <h3 className="font-bold text-lg mb-1">Bank format</h3>
                <p className="text-sm text-text-muted" role="status">
                  {file?.name} · {csvData.length} rows
                  {selectedPreset ? ` · ${selectedPreset.name}` : ''}
                </p>
              </div>
              <button type="button" onClick={reset} className="btn-ghost btn-sm" aria-label="Cancel import">
                <X size={14} aria-hidden /> Cancel
              </button>
            </div>

            <label className="block text-sm font-medium mb-2">
              Bank format
              <select
                value={selectedPreset?.id || ''}
                onChange={(e) => {
                  const next = BANK_PRESETS.find((p) => p.id === e.target.value) || null
                  setSelectedPreset(next)
                  if (next) setMapping(autoMapColumns(headers, next))
                }}
                className="mt-1 w-full"
                aria-label="Select bank format"
              >
                {BANK_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm" aria-label="CSV preview sample">
                <caption className="sr-only">First five rows of the uploaded CSV</caption>
                <thead>
                  <tr className="border-b border-border">
                    {headers.slice(0, 5).map((h) => (
                      <th key={h} scope="col" className="text-left p-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      {headers.slice(0, 5).map((h) => (
                        <td key={h} className="p-2 text-text-muted">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={reset} className="btn-ghost">
              Back
            </button>
            <button type="button" onClick={handlePreviewContinue} className="btn-primary">
              Continue to mapping
            </button>
          </div>
        </div>
      )}

      {step === 'mapping' && mapping && (
        <div className="space-y-6">
          <div className="surface p-6 space-y-4">
            <h3 className="font-bold text-lg">Column mapping</h3>
            <p className="text-sm text-text-muted">
              Confirm how CSV columns map to MyDSP fields. Auto-mapped from{' '}
              {selectedPreset?.name ?? 'generic'} — adjust if needed.
            </p>
            {(
              [
                ['date', 'Date'],
                ['description', 'Description'],
                ['amount', 'Amount'],
                ['amountDebit', 'Debit (optional)'],
                ['amountCredit', 'Credit (optional)'],
                ['category', 'Category (optional)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="label-uppercase block mb-1">{label}</span>
                <select
                  value={(mapping[key] as string | null | undefined) ?? ''}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      [key]: e.target.value || null,
                    })
                  }
                  className="w-full"
                  aria-label={`Map ${label} column`}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('preview')} className="btn-ghost">
              Back
            </button>
            <button type="button" onClick={handleMappingContinue} className="btn-primary">
              Continue to review
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && stats && (
        <div className="space-y-6">
          {analysisNote ? (
            <p className="text-sm border border-border px-4 py-3 text-text-muted" role="status">
              {analysisNote}
            </p>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px">
            <div className="surface p-4">
              <p className="label-uppercase mb-1">Selected</p>
              <p className="text-xl font-bold tabular-nums">{stats.total}</p>
            </div>
            <div className="surface p-4">
              <p className="label-uppercase mb-1">Expenses</p>
              <p className="text-xl font-bold tabular-nums">{stats.expenses}</p>
              <p className="text-xs text-text-subtle">{formatGBP(stats.totalExpense)}</p>
            </div>
            <div className="surface p-4">
              <p className="label-uppercase mb-1">Income</p>
              <p className="text-xl font-bold tabular-nums">{stats.income}</p>
              <p className="text-xs text-text-subtle">{formatGBP(stats.totalIncome)}</p>
            </div>
            <div className="surface p-4">
              <p className="label-uppercase mb-1">Will import</p>
              <p className="text-xl font-bold tabular-nums text-accent">{stats.willImport}</p>
            </div>
          </div>

          <label className="flex items-start gap-3 surface p-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={importIncome}
              onChange={(e) => setImportIncome(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium">Import income rows</span>
              <span className="block text-xs text-text-muted font-light mt-0.5">
                Off by default — income stays selectable for review but is skipped unless you enable
                this. Imported income uses category “income”.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Row selection">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: true })))}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: false })))}
            >
              Deselect all
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() =>
                setRows((prev) =>
                  prev.map((r) => ({ ...r, selected: r.isIncome ? false : r.selected })),
                )
              }
            >
              Deselect income
            </button>
          </div>

          <div className="surface overflow-x-auto">
            <table className="w-full text-sm min-w-[36rem]" aria-label="Transactions to import">
              <caption className="sr-only">Select transactions to import into spending</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3" scope="col">
                    <span className="sr-only">Include</span>
                  </th>
                  <th className="p-3 label-uppercase" scope="col">
                    Date
                  </th>
                  <th className="p-3 label-uppercase" scope="col">
                    Description
                  </th>
                  <th className="p-3 label-uppercase text-right" scope="col">
                    Amount
                  </th>
                  <th className="p-3 label-uppercase" scope="col">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.date}-${r.description}-${i}`} className="border-b border-border/50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)),
                          )
                        }
                        aria-label={`Include ${r.description} on ${r.date}`}
                      />
                    </td>
                    <td className="p-3 tabular-nums">{r.date}</td>
                    <td className="p-3">
                      {r.description}
                      {r.isIncome ? (
                        <span className="ml-2 text-[11px] uppercase text-text-subtle">income</span>
                      ) : null}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatGBP(Math.abs(r.amount))}</td>
                    <td className="p-3 capitalize text-text-muted">{r.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('mapping')} className="btn-ghost">
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="btn-primary"
              disabled={stats.willImport === 0}
            >
              Import {stats.willImport}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
