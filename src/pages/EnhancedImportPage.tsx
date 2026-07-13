import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle, Upload, X } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { parseBankCsv } from '../services/csvImport'
import type { ParsedBankRow } from '../services/csvImport'
import {
  BANK_PRESETS,
  detectBankPreset,
  type BankPreset,
} from '../services/enhancedCsvImport'
import { formatGBP, formatGBPPrecise } from '../utils/format'

type ImportStep = 'upload' | 'preview' | 'mapping' | 'confirm'

export function EnhancedImportPage() {
  const { setData, data } = usePortfolio()
  const { success, error: showError, warning } = useToasts()
  
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState<BankPreset | null>(null)
  const [rows, setRows] = useState<ParsedBankRow[]>([])

  const handleFileSelect = async (selectedFile: File) => {
    try {
      setFile(selectedFile)
      const text = await selectedFile.text()
      const lines = text.trim().split('\n')
      
      if (lines.length < 2) {
        showError('Invalid CSV', 'File must have at least a header row and one data row')
        return
      }
      
      const fileHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
      setHeaders(fileHeaders)
      
      // Detect bank preset
      const detected = detectBankPreset(fileHeaders)
      setSelectedPreset(detected)
      
      if (detected) {
        success('Bank detected', `Detected ${detected.name} format`)
      }
      
      // Parse CSV data
      const dataRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        const row: any = {}
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

  const handlePreviewConfirm = () => {
    if (!selectedPreset) {
      showError('No preset selected', 'Please select a bank preset')
      return
    }
    
    // Use existing parser with detected preset
    const text = csvData.map(row => 
      headers.map(h => row[h]).join(',')
    ).join('\n')
    const fullCsv = [headers.join(','), text].join('\n')
    
    const convention = selectedPreset.amountConvention === 'positive_income' ? 'monzo' : 'positive_expense'
    const parsed = parseBankCsv(fullCsv, data.merchantRules, { convention })
    
    setRows(parsed)
    setStep('confirm')
  }

  const handleImport = () => {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) {
      warning('No rows selected', 'Please select at least one transaction to import')
      return
    }
    
    const startId = data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1
    const expenses = selected.filter(r => !r.isIncome)
    
    setData(prev => ({
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
    
    success('Import complete', `Imported ${expenses.length} transactions`)
    
    // Reset
    setStep('upload')
    setFile(null)
    setCsvData([])
    setHeaders([])
    setRows([])
  }

  const stats = useMemo(() => {
    if (!rows.length) return null
    const selected = rows.filter(r => r.selected)
    const expenses = selected.filter(r => !r.isIncome)
    const income = selected.filter(r => r.isIncome)
    const totalExpense = expenses.reduce((sum, r) => sum + Math.abs(r.amount), 0)
    const totalIncome = income.reduce((sum, r) => sum + Math.abs(r.amount), 0)
    
    return {
      total: selected.length,
      expenses: expenses.length,
      income: income.length,
      totalExpense,
      totalIncome,
    }
  }, [rows])

  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Enhanced CSV Import"
        description="Smart bank detection with auto-column mapping and duplicate detection"
      />

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {['upload', 'preview', 'confirm'].map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              step === s ? 'bg-accent text-white' :
              ['upload', 'preview', 'mapping', 'confirm'].indexOf(step) > i ? 'bg-green-500/20 text-green-500' :
              'bg-surface-hover text-text-muted'
            }`}>
              {['upload', 'preview', 'mapping', 'confirm'].indexOf(step) > i && <CheckCircle size={16} />}
              {s === 'upload' ? '1. Upload' : s === 'preview' ? '2. Preview' : '3. Confirm'}
            </div>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="surface p-6 md:p-8 rounded-xl md:rounded-none shadow-sm md:shadow-none">
          <h3 className="font-bold text-lg mb-4">Upload CSV File</h3>
          <p className="text-sm text-text-muted mb-6">
            We support {BANK_PRESETS.length} banks including Monzo, Revolut, Starling, HSBC, Barclays, and more.
            The system will automatically detect your bank format.
          </p>
          
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-accent transition-colors">
            <Upload size={48} className="text-accent mb-3" />
            <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-text-muted">CSV files only</p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFileSelect(f)
                e.target.value = ''
              }}
            />
          </label>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-blue-500" />
              Supported Banks
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {BANK_PRESETS.slice(0, -1).map(preset => (
                <div key={preset.id} className="text-text-muted">• {preset.name}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          <div className="surface p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg mb-1">Bank Format Detected</h3>
                <p className="text-sm text-text-muted">
                  {file?.name} · {csvData.length} rows
                </p>
              </div>
              <button type="button" onClick={() => setStep('upload')} className="btn-ghost btn-sm">
                <X size={14} /> Cancel
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Bank Format</label>
              <select
                value={selectedPreset?.id || ''}
                onChange={(e) => setSelectedPreset(BANK_PRESETS.find(p => p.id === e.target.value) || null)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded"
              >
                {BANK_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {headers.slice(0, 5).map(h => (
                      <th key={h} className="text-left p-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      {headers.slice(0, 5).map(h => (
                        <td key={h} className="p-2 text-text-muted">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.length > 5 && (
                <p className="text-xs text-text-muted mt-2 text-center">
                  Showing 5 of {csvData.length} rows
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('upload')} className="btn-ghost">
              Back
            </button>
            <button type="button" onClick={handlePreviewConfirm} className="btn-primary">
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Total Selected</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Expenses</p>
              <p className="text-2xl font-bold text-red-500">{stats.expenses}</p>
              <p className="text-xs text-text-muted mt-1">{formatGBP(stats.totalExpense)}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Income</p>
              <p className="text-2xl font-bold text-green-500">{stats.income}</p>
              <p className="text-xs text-text-muted mt-1">{formatGBP(stats.totalIncome)}</p>
            </div>
            <div className="surface p-4 rounded-xl md:rounded-none shadow-sm md:shadow-none">
              <p className="text-xs uppercase tracking-wider text-text-subtle mb-1 font-semibold">Net</p>
              <p className="text-2xl font-bold">{formatGBP(stats.totalIncome - stats.totalExpense, { signed: true })}</p>
            </div>
          </div>

          <div className="surface p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Review Transactions</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRows(rows.map(r => ({ ...r, selected: true })))}
                  className="btn-ghost btn-sm text-xs"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setRows(rows.map(r => ({ ...r, selected: false })))}
                  className="btn-ghost btn-sm text-xs"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rows.map((row, i) => (
                <label
                  key={i}
                  className="flex items-center gap-3 p-3 bg-surface-hover rounded-lg cursor-pointer hover:bg-surface transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => {
                      const newRows = [...rows]
                      newRows[i].selected = e.target.checked
                      setRows(newRows)
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.description}</p>
                    <p className="text-xs text-text-muted">{row.date} · {row.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${row.isIncome ? 'text-green-500' : 'text-text'}`}>
                      {formatGBPPrecise(row.amount)}
                    </p>
                    {row.isIncome && (
                      <p className="text-xs text-green-500">Income</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setStep('preview')} className="btn-ghost">
              Back
            </button>
            <button 
              type="button" 
              onClick={handleImport} 
              className="btn-primary"
              disabled={!stats.total}
            >
              Import {stats.total} Transaction{stats.total !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
