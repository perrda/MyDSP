// API Export and Automation Foundations
// Export data in standard formats for external integrations

import type { PortfolioData } from '../domain/types'

export interface DataExportOptions {
  format: 'json' | 'csv' | 'api'
  includePersonalInfo?: boolean
  dateRange?: { from: string; to: string }
  categories?: string[]
}

export interface ApiEndpoint {
  method: 'GET' | 'POST'
  path: string
  description: string
  params?: Record<string, string>
  example?: any
}

// Standard API format for external consumption
export interface StandardApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  meta: {
    timestamp: string
    version: string
    count?: number
  }
}

// Export portfolio summary in standard API format
export function exportPortfolioSummary(data: PortfolioData): StandardApiResponse {
  const totalAssets = 
    data.crypto.reduce((sum, c) => sum + c.qty * c.cost, 0) +
    data.equities.reduce((sum, e) => sum + e.shares * e.avgCost, 0)
  
  const totalLiabilities = 
    data.creditCards.reduce((sum, c) => sum + c.balance, 0) +
    data.loans.reduce((sum, l) => sum + l.balance, 0)
  
  const netWorth = totalAssets - totalLiabilities
  
  const activeGoals = data.goals.filter(g => {
    const deadline = new Date(g.deadline)
    return deadline >= new Date()
  })
  
  return {
    success: true,
    data: {
      netWorth,
      assets: {
        total: totalAssets,
        crypto: data.crypto.reduce((sum, c) => sum + c.qty * c.cost, 0),
        equities: data.equities.reduce((sum, e) => sum + e.shares * e.avgCost, 0),
      },
      liabilities: {
        total: totalLiabilities,
        creditCards: data.creditCards.reduce((sum, c) => sum + c.balance, 0),
        loans: data.loans.reduce((sum, l) => sum + l.balance, 0),
      },
      counts: {
        cryptoHoldings: data.crypto.length,
        equityHoldings: data.equities.length,
        goals: data.goals.length,
        activeGoals: activeGoals.length,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  }
}

// Export spending data in API format
export function exportSpendingData(
  data: PortfolioData,
  options: DataExportOptions = { format: 'api' }
): StandardApiResponse {
  let spending = data.spending
  
  // Apply date range filter
  if (options.dateRange) {
    spending = spending.filter(s => 
      s.date >= options.dateRange!.from && s.date <= options.dateRange!.to
    )
  }
  
  // Apply category filter
  if (options.categories && options.categories.length > 0) {
    spending = spending.filter(s => 
      options.categories!.includes(s.category.toLowerCase())
    )
  }
  
  return {
    success: true,
    data: {
      transactions: spending.map(s => ({
        id: s.id,
        date: s.date,
        description: s.description,
        amount: Math.abs(s.amount),
        category: s.category,
        method: s.method,
      })),
      summary: {
        totalAmount: spending.reduce((sum, s) => sum + Math.abs(s.amount), 0),
        transactionCount: spending.length,
        avgTransaction: spending.length > 0 
          ? spending.reduce((sum, s) => sum + Math.abs(s.amount), 0) / spending.length 
          : 0,
        categories: [...new Set(spending.map(s => s.category))],
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      count: spending.length,
    },
  }
}

// Export goals in API format
export function exportGoalsData(data: PortfolioData): StandardApiResponse {
  return {
    success: true,
    data: {
      goals: data.goals.map(g => {
        const deadline = new Date(g.deadline)
        const isActive = deadline >= new Date()
        
        return {
          id: g.id,
          name: g.name,
          type: g.type,
          target: g.target,
          metric: g.metric,
          deadline: g.deadline,
          isActive,
          notes: g.notes,
        }
      }),
      summary: {
        total: data.goals.length,
        active: data.goals.filter(g => new Date(g.deadline) >= new Date()).length,
        expired: data.goals.filter(g => new Date(g.deadline) < new Date()).length,
        totalTarget: data.goals.reduce((sum, g) => sum + g.target, 0),
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      count: data.goals.length,
    },
  }
}

// Export budget adherence in API format
export function exportBudgetData(data: PortfolioData): StandardApiResponse {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthSpending = data.spending.filter(s => s.date.startsWith(currentMonth))
  
  const categorySpending = new Map<string, number>()
  monthSpending.forEach(s => {
    const cat = s.category.toLowerCase()
    categorySpending.set(cat, (categorySpending.get(cat) || 0) + Math.abs(s.amount))
  })
  
  const budgets = Object.entries(data.budgetGoals).map(([category, limit]) => {
    const spent = categorySpending.get(category.toLowerCase()) || 0
    const remaining = limit - spent
    const percentUsed = limit > 0 ? (spent / limit) * 100 : 0
    
    return {
      category,
      limit,
      spent,
      remaining,
      percentUsed,
      status: percentUsed >= 100 ? 'exceeded' : percentUsed >= 90 ? 'warning' : 'ok',
    }
  })
  
  return {
    success: true,
    data: {
      month: currentMonth,
      budgets,
      summary: {
        totalBudget: Object.values(data.budgetGoals).reduce((sum, limit) => sum + limit, 0),
        totalSpent: Array.from(categorySpending.values()).reduce((sum, amt) => sum + amt, 0),
        categoriesOverBudget: budgets.filter(b => b.status === 'exceeded').length,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      count: budgets.length,
    },
  }
}

// Convert to CSV format
export function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',')
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  )
  
  return [csvHeaders, ...csvRows].join('\n')
}

// Export spending as CSV
export function exportSpendingCSV(data: PortfolioData, options: DataExportOptions = { format: 'csv' }): string {
  let spending = data.spending
  
  if (options.dateRange) {
    spending = spending.filter(s => 
      s.date >= options.dateRange!.from && s.date <= options.dateRange!.to
    )
  }
  
  if (options.categories && options.categories.length > 0) {
    spending = spending.filter(s => 
      options.categories!.includes(s.category.toLowerCase())
    )
  }
  
  const csvData = spending.map(s => ({
    date: s.date,
    description: s.description,
    amount: Math.abs(s.amount).toFixed(2),
    category: s.category,
    method: s.method,
  }))
  
  return convertToCSV(csvData, ['date', 'description', 'amount', 'category', 'method'])
}

// Webhook payload format for automation
export interface WebhookPayload {
  event: 'goal.completed' | 'budget.exceeded' | 'spending.anomaly' | 'net_worth.milestone'
  timestamp: string
  data: any
}

export function createWebhookPayload(
  event: WebhookPayload['event'],
  data: any
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  }
}

// Simulate webhook trigger (for future integration)
export async function triggerWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MyDSP-Event': payload.event,
        'X-MyDSP-Timestamp': payload.timestamp,
      },
      body: JSON.stringify(payload),
    })
    
    return response.ok
  } catch (error) {
    console.error('Webhook trigger failed:', error)
    return false
  }
}

// Available API endpoints documentation
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/portfolio/summary',
    description: 'Get portfolio summary with net worth, assets, and liabilities',
    example: {
      success: true,
      data: {
        netWorth: 50000,
        assets: { total: 60000, crypto: 20000, equities: 40000 },
        liabilities: { total: 10000, creditCards: 2000, loans: 8000 },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/v1/spending',
    description: 'Get spending transactions with optional filters',
    params: {
      from: 'Start date (YYYY-MM-DD)',
      to: 'End date (YYYY-MM-DD)',
      category: 'Filter by category',
    },
    example: {
      success: true,
      data: {
        transactions: [
          { id: 1, date: '2026-07-01', description: 'Groceries', amount: 45.50, category: 'food' },
        ],
        summary: { totalAmount: 45.50, transactionCount: 1 },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/v1/goals',
    description: 'Get all financial goals with progress',
    example: {
      success: true,
      data: {
        goals: [
          { id: 1, name: 'Emergency Fund', target: 10000, current: 5000, progress: 50 },
        ],
      },
    },
  },
  {
    method: 'GET',
    path: '/api/v1/budgets',
    description: 'Get current month budget adherence',
    example: {
      success: true,
      data: {
        month: '2026-07',
        budgets: [
          { category: 'food', limit: 500, spent: 450, remaining: 50, percentUsed: 90, status: 'warning' },
        ],
      },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks/subscribe',
    description: 'Subscribe to webhook events',
    params: {
      url: 'Your webhook endpoint URL',
      events: 'Array of events to subscribe to',
    },
  },
]

// Generate API documentation
export function generateApiDocs(): string {
  return `
# MyDSP API Documentation

## Base URL
\`https://your-domain.com\`

## Authentication
Currently uses local-first architecture. External API access requires authentication setup.

## Available Endpoints

${API_ENDPOINTS.map(endpoint => `
### ${endpoint.method} ${endpoint.path}

${endpoint.description}

${endpoint.params ? `
**Parameters:**
${Object.entries(endpoint.params).map(([key, desc]) => `- \`${key}\`: ${desc}`).join('\n')}
` : ''}

${endpoint.example ? `
**Example Response:**
\`\`\`json
${JSON.stringify(endpoint.example, null, 2)}
\`\`\`
` : ''}
`).join('\n---\n')}

## Webhook Events

MyDSP can trigger webhooks for the following events:

- \`goal.completed\`: When a financial goal is achieved
- \`budget.exceeded\`: When spending exceeds a budget limit
- \`spending.anomaly\`: When unusual spending is detected
- \`net_worth.milestone\`: When net worth reaches a milestone

## Data Export

All data can be exported in:
- JSON (API format)
- CSV (spreadsheet compatible)
- Standard formats for external integrations
  `.trim()
}
