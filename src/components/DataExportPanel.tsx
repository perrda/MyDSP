// Data Export & Reporting Component

import { useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { 
  generatePdfHtml, 
  spendingToExcel, 
  goalsToExcel,
  jobsToExcel,
  todosToExcel,
  downloadExcel,
  printPdf 
} from '../utils/exportFormats'
import { Download, FileText, Table as TableIcon, Printer, CheckCircle } from 'lucide-react'
import { logger } from '../utils/logger'
import { useToasts } from './ToastProvider'

type ExportFormat = 'pdf' | 'excel' | 'csv'
type ExportType = 'transactions' | 'spending' | 'goals' | 'portfolio' | 'jobs' | 'todos' | 'full'

export function DataExportPanel() {
  const { data } = usePortfolio()
  const { error: showError } = useToasts()
  const [exporting, setExporting] = useState(false)
  const [lastExport, setLastExport] = useState<{ type: string; format: string } | null>(null)

  const handleExport = async (type: ExportType, format: ExportFormat) => {
    if (!data) return

    setExporting(true)
    const startTime = performance.now()

    try {
      if (format === 'pdf') {
        await exportPdf(type, data)
      } else if (format === 'excel' || format === 'csv') {
        await exportExcel(type, data)
      }

      const duration = performance.now() - startTime
      logger.metric(`export-${type}-${format}`, duration, { unit: 'ms' })
      logger.track('data_export', { type, format, duration })

      setLastExport({ type, format })
      setTimeout(() => setLastExport(null), 3000)
    } catch (error) {
      logger.error('Export failed', error as Error, 'app')
      showError('Export failed', 'Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const exportPdf = async (type: ExportType, data: any) => {
    let htmlContent = ''
    let title = ''

    switch (type) {
      case 'portfolio':
        title = 'Portfolio Summary'
        htmlContent = `
          <h1>Portfolio Summary</h1>
          <h2>Net Worth: ${data.history?.[data.history.length - 1]?.netWorth.toFixed(2) || 'N/A'}</h2>
          <h3>Crypto Holdings</h3>
          <table>
            <thead><tr><th>Symbol</th><th>Quantity</th><th>Value</th></tr></thead>
            <tbody>
              ${(data.crypto || []).map((c: any) => `
                <tr>
                  <td>${c.symbol}</td>
                  <td>${c.qty}</td>
                  <td>£${(c.qty * c.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        break

      case 'spending':
        title = 'Spending Report'
        const totalSpending = (data.spending || []).reduce((sum: number, s: any) => sum + s.amount, 0)
        htmlContent = `
          <h1>Spending Report</h1>
          <p>Total: £${totalSpending.toFixed(2)}</p>
          <p>Transactions: ${data.spending?.length || 0}</p>
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              ${(data.spending || []).slice(0, 100).map((s: any) => `
                <tr>
                  <td>${s.date}</td>
                  <td>${s.description}</td>
                  <td>${s.category}</td>
                  <td>£${s.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        break

      case 'goals':
        title = 'Goals Report'
        htmlContent = `
          <h1>Goals Report</h1>
          <table>
            <thead><tr><th>Goal</th><th>Target</th><th>Deadline</th><th>Type</th></tr></thead>
            <tbody>
              ${(data.goals || []).map((g: any) => `
                <tr>
                  <td>${g.name}</td>
                  <td>£${g.target.toFixed(2)}</td>
                  <td>${g.deadline}</td>
                  <td>${g.type}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        break

      default:
        title = 'Full Report'
        htmlContent = '<h1>Full Financial Report</h1><p>Coming soon...</p>'
    }

    const pdfHtml = generatePdfHtml(htmlContent, {
      title,
      includeDate: true
    })

    printPdf(pdfHtml)
  }

  const exportExcel = async (type: ExportType, data: any) => {
    let excelData
    let filename = ''

    switch (type) {
      case 'spending':
        excelData = spendingToExcel(data.spending || [])
        filename = `spending-${new Date().toISOString().split('T')[0]}.csv`
        break

      case 'goals':
        excelData = goalsToExcel(data.goals || [])
        filename = `goals-${new Date().toISOString().split('T')[0]}.csv`
        break

      case 'jobs':
        excelData = jobsToExcel(data.jobApplications || [])
        filename = `jobs-${new Date().toISOString().split('T')[0]}.csv`
        break

      case 'todos':
        excelData = todosToExcel(data.todoItems || [])
        filename = `todos-${new Date().toISOString().split('T')[0]}.csv`
        break

      default:
        excelData = spendingToExcel(data.spending || [])
        filename = `export-${new Date().toISOString().split('T')[0]}.csv`
    }

    downloadExcel(excelData, filename)
  }

  const exportOptions = [
    { type: 'portfolio' as ExportType, label: 'Portfolio Summary', icon: <FileText /> },
    { type: 'spending' as ExportType, label: 'Spending Data', icon: <TableIcon /> },
    { type: 'goals' as ExportType, label: 'Goals & Targets', icon: <TableIcon /> },
    { type: 'jobs' as ExportType, label: 'Job Applications', icon: <TableIcon /> },
    { type: 'todos' as ExportType, label: 'To Do Lists', icon: <TableIcon /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Data Export & Reporting</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Export your financial data in multiple formats
        </p>
      </div>

      {lastExport && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-900 dark:text-green-100">
            Successfully exported {lastExport.type} as {lastExport.format.toUpperCase()}
          </span>
        </div>
      )}

      <div className="grid gap-4">
        {exportOptions.map(option => (
          <div
            key={option.type}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-blue-600 dark:text-blue-400">
                  {option.icon}
                </div>
                <h3 className="font-semibold text-lg">{option.label}</h3>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport(option.type, 'pdf')}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Export PDF
              </button>

              <button
                onClick={() => handleExport(option.type, 'excel')}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Excel/CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Note:</strong> PDF exports will open in a new window for printing or saving. 
          Excel/CSV exports will download directly to your device.
        </p>
      </div>
    </div>
  )
}
