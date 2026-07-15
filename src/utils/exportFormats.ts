// Advanced data export utilities for PDF, Excel, and other formats

import type { Goal, SpendingEntry } from '../domain/types'
import type { JobApplication } from '../domain/job-types'
import type { TodoItem } from '../domain/todo-types'
import { formatGBP, formatGBPPrecise } from './format'
import { formatDate } from './helpers'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Bank transaction type for export (not part of main types)
interface Transaction {
  date: string
  description: string
  category: string
  amount: number
  balance: number
}

// === PDF GENERATION (HTML-to-PDF ready) ===

export interface PdfOptions {
  title: string
  orientation?: 'portrait' | 'landscape'
  paperSize?: 'A4' | 'letter'
  includeDate?: boolean
  includePageNumbers?: boolean
}

export function generatePdfHtml(content: string, options: PdfOptions): string {
  const { title, orientation = 'portrait', includeDate = true } = options
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: ${orientation};
      margin: 2cm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1a1a;
    }
    h1 {
      font-size: 20pt;
      font-weight: 700;
      margin-bottom: 0.5em;
      color: #111;
      border-bottom: 2px solid #F7931A;
      padding-bottom: 0.5em;
      letter-spacing: -0.02em;
    }
    h2 {
      font-size: 14pt;
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #111;
      border-left: 3px solid #F7931A;
      padding-left: 0.5em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: 9pt;
    }
    th, td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #e5e5e5;
    }
    th {
      background-color: #fafafa;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.04em;
    }
    tr:hover {
      background-color: #f9f9f9;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2em;
    }
    .date {
      font-size: 9pt;
      color: #666;
    }
    .summary-card {
      background: #fafafa;
      border-left: 4px solid #F7931A;
      padding: 1em;
      margin: 1em 0;
    }
    .text-right {
      text-align: right;
    }
    .text-green {
      color: #10b981;
    }
    .text-red {
      color: #ef4444;
    }
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    ${includeDate ? `<div class="date">Generated: ${formatDateTime(new Date())}</div>` : ''}
  </div>
  ${content}
</body>
</html>
  `.trim()
}

export function generateTransactionsPdf(transactions: Transaction[]): string {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0)
  const income = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const expenses = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
  
  const summaryHtml = `
    <div class="summary-card">
      <h2>Summary</h2>
      <p><strong>Total Transactions:</strong> ${transactions.length}</p>
      <p><strong>Total Income:</strong> <span class="text-green">${formatGBP(income)}</span></p>
      <p><strong>Total Expenses:</strong> <span class="text-red">${formatGBP(expenses)}</span></p>
      <p><strong>Net:</strong> ${formatGBP(total)}</p>
    </div>
  `
  
  const tableHtml = `
    <h2>Transactions</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(t => `
          <tr>
            <td>${formatDate(new Date(t.date))}</td>
            <td>${t.description}</td>
            <td>${t.category}</td>
            <td class="text-right ${t.amount >= 0 ? 'text-green' : 'text-red'}">${formatGBPPrecise(t.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
  
  return generatePdfHtml(summaryHtml + tableHtml, {
    title: 'Transaction Report',
    orientation: 'portrait'
  })
}

export function generateSpendingPdf(spending: SpendingEntry[]): string {
  const totalSpent = spending.reduce((sum, s) => sum + s.amount, 0)
  
  const categoryBreakdown = spending.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + s.amount
    return acc
  }, {} as Record<string, number>)
  
  const summaryHtml = `
    <div class="summary-card">
      <h2>Summary</h2>
      <p><strong>Total Spending:</strong> ${formatGBP(totalSpent)}</p>
      <p><strong>Number of Entries:</strong> ${spending.length}</p>
      <p><strong>Average per Entry:</strong> ${formatGBP(totalSpent / spending.length)}</p>
    </div>
  `
  
  const categoryHtml = `
    <h2>Category Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="text-right">Amount</th>
          <th class="text-right">% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(categoryBreakdown)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, amt]) => `
            <tr>
              <td>${cat}</td>
              <td class="text-right">${formatGBP(amt)}</td>
              <td class="text-right">${((amt / totalSpent) * 100).toFixed(1)}%</td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  `
  
  return generatePdfHtml(summaryHtml + categoryHtml, {
    title: 'Spending Analysis',
    orientation: 'portrait'
  })
}

export function generateGoalsPdf(goals: Goal[]): string {
  const activeGoals = goals.filter(g => new Date(g.deadline) >= new Date())
  const completedGoals = goals.filter(g => new Date(g.deadline) < new Date())
  
  const summaryHtml = `
    <div class="summary-card">
      <h2>Summary</h2>
      <p><strong>Total Goals:</strong> ${goals.length}</p>
      <p><strong>Active:</strong> ${activeGoals.length}</p>
      <p><strong>Expired:</strong> ${completedGoals.length}</p>
    </div>
  `
  
  const activeHtml = activeGoals.length > 0 ? `
    <h2>Active Goals</h2>
    <table>
      <thead>
        <tr>
          <th>Goal</th>
          <th class="text-right">Target</th>
          <th>Deadline</th>
        </tr>
      </thead>
      <tbody>
        ${activeGoals.map(g => `
          <tr>
            <td>${g.name}</td>
            <td class="text-right">${formatGBP(g.target)}</td>
            <td>${formatDate(new Date(g.deadline))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''
  
  return generatePdfHtml(summaryHtml + activeHtml, {
    title: 'Goals Report',
    orientation: 'portrait'
  })
}

// === EXCEL GENERATION (CSV with formatting) ===

export interface ExcelOptions {
  sheetName?: string
  includeFormatting?: boolean
  freezeHeader?: boolean
}

export interface ExcelCell {
  value: string | number
  type?: 'text' | 'number' | 'date' | 'currency'
  format?: string
  bold?: boolean
  color?: string
  backgroundColor?: string
}

export type ExcelRow = ExcelCell[]
export type ExcelData = ExcelRow[]

export function generateExcelCsv(data: ExcelData, options: ExcelOptions = {}): string {
  const { includeFormatting = false } = options
  
  const rows = data.map(row => {
    return row.map(cell => {
      let value = String(cell.value)
      
      if (includeFormatting && cell.type === 'currency') {
        value = `"${value}"`
      }
      
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`
      }
      
      return value
    }).join(',')
  })
  
  return rows.join('\n')
}

export function transactionsToExcel(transactions: Transaction[]): ExcelData {
  const header: ExcelRow = [
    { value: 'Date', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Description', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Category', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Amount', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Balance', bold: true, backgroundColor: '#f5f5f5' },
  ]
  
  const rows: ExcelRow[] = transactions.map(t => [
    { value: formatDate(new Date(t.date)), type: 'date' },
    { value: t.description, type: 'text' },
    { value: t.category, type: 'text' },
    { value: formatGBPPrecise(t.amount), type: 'currency', color: t.amount >= 0 ? '#10b981' : '#ef4444' },
    { value: formatGBPPrecise(t.balance), type: 'currency' },
  ])
  
  return [header, ...rows]
}

export function spendingToExcel(spending: SpendingEntry[]): ExcelData {
  const header: ExcelRow = [
    { value: 'Date', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Category', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Description', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Amount', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Payment Method', bold: true, backgroundColor: '#f5f5f5' },
  ]
  
  const rows: ExcelRow[] = spending.map(s => [
    { value: formatDate(new Date(s.date)), type: 'date' },
    { value: s.category, type: 'text' },
    { value: s.description, type: 'text' },
    { value: formatGBP(s.amount), type: 'currency' },
    { value: s.method || 'N/A', type: 'text' },
  ])
  
  return [header, ...rows]
}

export function goalsToExcel(goals: Goal[]): ExcelData {
  const header: ExcelRow = [
    { value: 'Goal', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Type', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Target Amount', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Deadline', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Status', bold: true, backgroundColor: '#f5f5f5' },
  ]
  
  const rows: ExcelRow[] = goals.map(g => {
    const isActive = new Date(g.deadline) >= new Date()
    return [
      { value: g.name, type: 'text' },
      { value: g.type, type: 'text' },
      { value: formatGBP(g.target), type: 'currency' },
      { value: formatDate(new Date(g.deadline)), type: 'date' },
      { value: isActive ? 'Active' : 'Expired', type: 'text', color: isActive ? '#10b981' : '#ef4444' },
    ]
  })
  
  return [header, ...rows]
}

export function jobsToExcel(jobs: JobApplication[]): ExcelData {
  const header: ExcelRow = [
    { value: 'Company', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Position', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Status', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Applied Date', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Location', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Salary', bold: true, backgroundColor: '#f5f5f5' },
  ]
  
  const rows: ExcelRow[] = jobs.map(j => {
    const salaryRange = j.salaryMin && j.salaryMax 
      ? `${formatGBP(j.salaryMin)} - ${formatGBP(j.salaryMax)}`
      : 'Not specified'
    
    return [
      { value: j.companyName, type: 'text' },
      { value: j.jobTitle, type: 'text' },
      { value: j.status, type: 'text' },
      { value: j.appliedDate ? formatDate(new Date(j.appliedDate)) : 'Not applied', type: 'text' },
      { value: j.location || 'Remote', type: 'text' },
      { value: salaryRange, type: 'text' },
    ]
  })
  
  return [header, ...rows]
}

export function todosToExcel(todos: TodoItem[]): ExcelData {
  const header: ExcelRow = [
    { value: 'Title', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Priority', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Status', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Category', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Due Date', bold: true, backgroundColor: '#f5f5f5' },
    { value: 'Created', bold: true, backgroundColor: '#f5f5f5' },
  ]
  
  const rows: ExcelRow[] = todos.map(t => [
    { value: t.title, type: 'text' },
    { value: t.priority, type: 'text', color: t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#6b7280' },
    { value: t.status, type: 'text' },
    { value: t.isFinanceRelated ? 'Finance' : 'General', type: 'text' },
    { value: t.dueDate ? formatDate(new Date(t.dueDate)) : 'No due date', type: 'text' },
    { value: formatDate(new Date(t.createdAt)), type: 'date' },
  ])
  
  return [header, ...rows]
}

// === DOWNLOAD HELPERS ===

export function downloadPdf(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadExcel(data: ExcelData, filename: string): void {
  const csv = generateExcelCsv(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// === PRINT HELPERS ===

export function printPdf(html: string): void {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}
