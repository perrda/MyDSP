import { Download } from 'lucide-react'
import type { PortfolioData } from '../domain/types'
import { formatGBP, formatPct } from '../utils/format'
import { monthKey } from '../domain/monthUtils'

interface ExportReportOptions {
  includeHoldings?: boolean
  includeSpending?: boolean
  includeBudgets?: boolean
  includeGoals?: boolean
  includeTodos?: boolean
  includeJobs?: boolean
}

export function generateFinancialReport(
  data: PortfolioData,
  breakdown: any,
  options: ExportReportOptions = {}
): string {
  const {
    includeHoldings = true,
    includeSpending = true,
    includeBudgets = true,
    includeGoals = true,
    includeTodos = false,
    includeJobs = false,
  } = options

  const lines: string[] = []
  const date = new Date().toLocaleString('en-GB')

  // Header
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('             MyDSP FINANCIAL REPORT')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push(`Generated: ${date}`)
  lines.push('')

  // Summary
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('PORTFOLIO SUMMARY')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('')
  lines.push(`Net Worth:        ${formatGBP(breakdown.netWorth).padStart(15)}`)
  lines.push(`Total Assets:     ${formatGBP(breakdown.assets).padStart(15)}`)
  lines.push(`Total Liabilities:${formatGBP(breakdown.liabilities).padStart(15)}`)
  lines.push('')
  lines.push(`Crypto Value:     ${formatGBP(breakdown.crypto.value).padStart(15)}  (${formatPct(breakdown.crypto.pct)})`)
  lines.push(`Equity Value:     ${formatGBP(breakdown.equity.value).padStart(15)}  (${formatPct(breakdown.equity.pct)})`)
  lines.push('')

  // Holdings
  if (includeHoldings && (data.crypto.length > 0 || data.equities.length > 0)) {
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('HOLDINGS')
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('')

    if (data.crypto.length > 0) {
      lines.push('Cryptocurrency:')
      lines.push('  Symbol'.padEnd(12) + 'Quantity'.padStart(15) + 'Value (GBP)'.padStart(15) + 'Cost'.padStart(12))
      lines.push('  ' + '─'.repeat(52))
      data.crypto.forEach((h) => {
        const value = (h.qty || 0) * (h.price || 0)
        lines.push(
          `  ${h.symbol.padEnd(12)}${(h.qty || 0).toFixed(4).padStart(15)}${formatGBP(value).padStart(15)}${formatGBP(h.cost || 0).padStart(12)}`
        )
      })
      lines.push('')
    }

    if (data.equities.length > 0) {
      lines.push('Equities:')
      lines.push('  Symbol'.padEnd(12) + 'Shares'.padStart(15) + 'Avg Cost'.padStart(15) + 'Total Cost'.padStart(12))
      lines.push('  ' + '─'.repeat(52))
      data.equities.forEach((h) => {
        const totalCost = (h.shares || 0) * (h.avgCost || 0)
        lines.push(
          `  ${h.symbol.padEnd(12)}${(h.shares || 0).toFixed(4).padStart(15)}${formatGBP(h.avgCost || 0).padStart(15)}${formatGBP(totalCost).padStart(12)}`
        )
      })
      lines.push('')
    }
  }

  // Budgets
  if (includeBudgets && Object.keys(data.budgetGoals).length > 0) {
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('MONTHLY BUDGETS')
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('')

    const ym = monthKey()
    const spentByCategory = new Map<string, number>()
    data.spending.forEach((s) => {
      if (!s.date.startsWith(ym)) return
      const cat = s.category.toLowerCase()
      spentByCategory.set(cat, (spentByCategory.get(cat) || 0) + Math.abs(s.amount))
    })

    lines.push('  Category'.padEnd(20) + 'Budget'.padStart(12) + 'Spent'.padStart(12) + 'Remaining'.padStart(12) + 'Usage'.padStart(10))
    lines.push('  ' + '─'.repeat(64))

    Object.entries(data.budgetGoals).forEach(([category, limit]) => {
      const spent = spentByCategory.get(category.toLowerCase()) || 0
      const remaining = (limit as number) - spent
      const usage = (limit as number) > 0 ? `${Math.round((spent / (limit as number)) * 100)}%` : 'N/A'
      lines.push(
        `  ${category.padEnd(20)}${formatGBP(limit as number).padStart(12)}${formatGBP(spent).padStart(12)}${formatGBP(remaining, { signed: true }).padStart(12)}${usage.padStart(10)}`
      )
    })
    lines.push('')
  }

  // Spending
  if (includeSpending && data.spending.length > 0) {
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('SPENDING SUMMARY (LAST 30 DAYS)')
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('')

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentSpending = data.spending.filter((s) => new Date(s.date) >= thirtyDaysAgo)

    const byCategory = new Map<string, number>()
    recentSpending.forEach((s) => {
      byCategory.set(s.category, (byCategory.get(s.category) || 0) + Math.abs(s.amount))
    })

    const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])
    const total = sorted.reduce((sum, [, amt]) => sum + amt, 0)

    lines.push('  Category'.padEnd(20) + 'Amount'.padStart(12) + 'Percentage'.padStart(12))
    lines.push('  ' + '─'.repeat(42))

    sorted.forEach(([category, amount]) => {
      const pct = total > 0 ? `${Math.round((amount / total) * 100)}%` : '0%'
      lines.push(`  ${category.padEnd(20)}${formatGBP(amount).padStart(12)}${pct.padStart(12)}`)
    })

    lines.push('  ' + '─'.repeat(42))
    lines.push(`  ${'TOTAL'.padEnd(20)}${formatGBP(total).padStart(12)}${'100%'.padStart(12)}`)
    lines.push('')
  }

  // Goals
  if (includeGoals && data.goals.length > 0) {
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('FINANCIAL GOALS')
    lines.push('───────────────────────────────────────────────────────────')
    lines.push('')

    lines.push('  Goal'.padEnd(30) + 'Type'.padEnd(12) + 'Target'.padStart(12) + 'Current'.padStart(12) + 'Progress'.padStart(10))
    lines.push('  ' + '─'.repeat(74))

    data.goals.forEach((goal: any) => {
      const progress = goal.target > 0 ? `${Math.round((goal.current / goal.target) * 100)}%` : 'N/A'
      lines.push(
        `  ${goal.name.substring(0, 28).padEnd(30)}${goal.type.padEnd(12)}${formatGBP(goal.target).padStart(12)}${formatGBP(goal.current).padStart(12)}${progress.padStart(10)}`
      )
    })
    lines.push('')
  }

  // Todos
  if (includeTodos && data.todoItems && data.todoItems.length > 0) {
    const activeTodos = data.todoItems.filter((t: any) => t.status !== 'done' && t.status !== 'archived')
    if (activeTodos.length > 0) {
      lines.push('───────────────────────────────────────────────────────────')
      lines.push("ACTIVE TO DO'S")
      lines.push('───────────────────────────────────────────────────────────')
      lines.push('')

      const highPriority = activeTodos.filter((t: any) => t.priority === 'high')
      const mediumPriority = activeTodos.filter((t: any) => t.priority === 'medium')
      const lowPriority = activeTodos.filter((t: any) => t.priority === 'low')

      if (highPriority.length > 0) {
        lines.push('  HIGH PRIORITY:')
        highPriority.slice(0, 10).forEach((t: any) => {
          const due = t.dueDate ? ` (Due: ${t.dueDate})` : ''
          lines.push(`    • ${t.title}${due}`)
        })
        lines.push('')
      }

      if (mediumPriority.length > 0) {
        lines.push('  MEDIUM PRIORITY:')
        mediumPriority.slice(0, 10).forEach((t: any) => {
          const due = t.dueDate ? ` (Due: ${t.dueDate})` : ''
          lines.push(`    • ${t.title}${due}`)
        })
        lines.push('')
      }

      if (lowPriority.length > 0 && lowPriority.length <= 5) {
        lines.push('  LOW PRIORITY:')
        lowPriority.forEach((t: any) => {
          const due = t.dueDate ? ` (Due: ${t.dueDate})` : ''
          lines.push(`    • ${t.title}${due}`)
        })
        lines.push('')
      }
    }
  }

  // Jobs
  if (includeJobs && data.jobApplications && data.jobApplications.length > 0) {
    const activeJobs = data.jobApplications.filter((j: any) => 
      !['rejected', 'withdrawn', 'archived', 'accepted'].includes(j.status)
    )
    if (activeJobs.length > 0) {
      lines.push('───────────────────────────────────────────────────────────')
      lines.push('ACTIVE JOB APPLICATIONS')
      lines.push('───────────────────────────────────────────────────────────')
      lines.push('')

      lines.push('  Company'.padEnd(25) + 'Role'.padEnd(25) + 'Status'.padEnd(15) + 'Applied')
      lines.push('  ' + '─'.repeat(88))

      activeJobs.forEach((job: any) => {
        const applied = job.appliedDate || 'Not yet'
        lines.push(
          `  ${job.companyName.substring(0, 23).padEnd(25)}${job.jobTitle.substring(0, 23).padEnd(25)}${job.status.padEnd(15)}${applied}`
        )
      })
      lines.push('')
    }
  }

  // Footer
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('              End of Report')
  lines.push('═══════════════════════════════════════════════════════════')

  return lines.join('\n')
}

interface ExportButtonProps {
  data: PortfolioData
  breakdown: any
  options?: ExportReportOptions
  filename?: string
  label?: string
}

export function ExportReportButton({ 
  data, 
  breakdown, 
  options = {}, 
  filename,
  label = 'Export Report'
}: ExportButtonProps) {
  const handleExport = () => {
    const report = generateFinancialReport(data, breakdown, options)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `mydsp-report-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" onClick={handleExport} className="btn-secondary btn-sm inline-flex items-center gap-2">
      <Download size={14} /> {label}
    </button>
  )
}
