import { useState } from 'react'
import { Download, Copy, Check, Code, Webhook, FileJson, FileSpreadsheet } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import {
  exportPortfolioSummary,
  exportSpendingData,
  exportGoalsData,
  exportBudgetData,
  exportSpendingCSV,
  API_ENDPOINTS,
  generateApiDocs,
} from '../domain/apiExport'

export function ApiAutomationPage() {
  const { data } = usePortfolio()
  const { success, error: showError } = useToasts()
  
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      success('Copied!', `${label} copied to clipboard`)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      showError('Copy failed', 'Could not copy to clipboard')
    }
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    success('Downloaded', `${filename} has been downloaded`)
  }

  const handleExportJSON = (type: 'summary' | 'spending' | 'goals' | 'budgets') => {
    let response
    let filename
    
    switch (type) {
      case 'summary':
        response = exportPortfolioSummary(data)
        filename = 'portfolio-summary.json'
        break
      case 'spending':
        response = exportSpendingData(data, { format: 'json' })
        filename = 'spending-data.json'
        break
      case 'goals':
        response = exportGoalsData(data)
        filename = 'goals-data.json'
        break
      case 'budgets':
        response = exportBudgetData(data)
        filename = 'budget-data.json'
        break
    }
    
    const content = JSON.stringify(response, null, 2)
    downloadFile(content, filename, 'application/json')
  }

  const handleExportCSV = () => {
    const csv = exportSpendingCSV(data, { format: 'csv' })
    downloadFile(csv, 'spending-export.csv', 'text/csv')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Integration"
        title="API & Automation"
        description="Export data, view API endpoints, and set up automation workflows"
      />

      {/* Quick Export Section */}
      <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Download size={20} className="text-accent" />
          Quick Export
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleExportJSON('summary')}
            className="flex items-center gap-3 p-4 bg-surface-hover rounded-lg hover:bg-surface transition-colors text-left"
          >
            <FileJson size={24} className="text-accent" />
            <div>
              <p className="font-medium">Portfolio Summary</p>
              <p className="text-xs text-text-muted">Net worth, assets, liabilities (JSON)</p>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => handleExportJSON('spending')}
            className="flex items-center gap-3 p-4 bg-surface-hover rounded-lg hover:bg-surface transition-colors text-left"
          >
            <FileJson size={24} className="text-green-500" />
            <div>
              <p className="font-medium">Spending Transactions</p>
              <p className="text-xs text-text-muted">All transactions with filters (JSON)</p>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="flex items-center gap-3 p-4 bg-surface-hover rounded-lg hover:bg-surface transition-colors text-left"
          >
            <FileSpreadsheet size={24} className="text-emerald-500" />
            <div>
              <p className="font-medium">Spending CSV</p>
              <p className="text-xs text-text-muted">Import into Excel or Google Sheets</p>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => handleExportJSON('goals')}
            className="flex items-center gap-3 p-4 bg-surface-hover rounded-lg hover:bg-surface transition-colors text-left"
          >
            <FileJson size={24} className="text-accent" />
            <div>
              <p className="font-medium">Goals Progress</p>
              <p className="text-xs text-text-muted">All goals with progress tracking (JSON)</p>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => handleExportJSON('budgets')}
            className="flex items-center gap-3 p-4 bg-surface-hover rounded-lg hover:bg-surface transition-colors text-left"
          >
            <FileJson size={24} className="text-orange-500" />
            <div>
              <p className="font-medium">Budget Adherence</p>
              <p className="text-xs text-text-muted">Current month budget status (JSON)</p>
            </div>
          </button>
        </div>
      </div>

      {/* API Endpoints Documentation */}
      <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Code size={20} className="text-accent" />
          API Endpoints
        </h3>
        
        <p className="text-sm text-text-muted mb-4">
          These endpoints define the standard API structure for external integrations. 
          Currently designed for local-first architecture - external access requires authentication setup.
        </p>
        
        <div className="space-y-4">
          {API_ENDPOINTS.map((endpoint, i) => (
            <div key={i} className="p-4 bg-surface-hover rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono px-2 py-1 ${
                    endpoint.method === 'GET' ? 'bg-accent/20 text-accent' : 'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm">{endpoint.path}</code>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(endpoint.path, `Endpoint ${i}`)}
                  className="btn-ghost btn-sm"
                >
                  {copied === `Endpoint ${i}` ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-sm text-text-muted mb-2">{endpoint.description}</p>
              
              {endpoint.params && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Parameters:</p>
                  <div className="text-xs text-text-muted space-y-1">
                    {Object.entries(endpoint.params).map(([key, desc]) => (
                      <div key={key}>
                        <code className="text-accent">{key}</code>: {desc}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {endpoint.example && (
                <details className="mt-2">
                  <summary className="text-xs font-medium cursor-pointer hover:text-accent">
                    View example response
                  </summary>
                  <pre className="mt-2 p-2 bg-bg rounded text-xs overflow-x-auto">
                    {JSON.stringify(endpoint.example, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
        
        <button
          type="button"
          onClick={() => {
            const docs = generateApiDocs()
            downloadFile(docs, 'mydsp-api-docs.md', 'text/markdown')
          }}
          className="btn-primary mt-4"
        >
          <Download size={16} />
          Download Full API Documentation
        </button>
      </div>

      {/* Webhook Configuration (Future Feature) */}
      <div className="surface p-6 mb-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Webhook size={20} className="text-accent" />
          Webhook Automation
        </h3>
        
        <p className="text-sm text-text-muted mb-4">
          Configure webhooks to receive real-time notifications for important events.
        </p>
        
        <div className="space-y-3">
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium text-sm mb-1">goal.completed</p>
            <p className="text-xs text-text-muted">Triggered when a financial goal is achieved</p>
          </div>
          
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium text-sm mb-1">budget.exceeded</p>
            <p className="text-xs text-text-muted">Triggered when spending exceeds a budget limit</p>
          </div>
          
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium text-sm mb-1">spending.anomaly</p>
            <p className="text-xs text-text-muted">Triggered when unusual spending is detected</p>
          </div>
          
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium text-sm mb-1">net_worth.milestone</p>
            <p className="text-xs text-text-muted">Triggered when net worth reaches a milestone</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-accent/10 border border-accent/20">
          <p className="text-sm font-medium mb-2">Coming Soon</p>
          <p className="text-xs text-text-muted">
            Webhook configuration will allow you to integrate MyDSP with external services like 
            Zapier, IFTTT, or custom automation workflows. Set up your webhook URL and choose 
            which events to receive notifications for.
          </p>
        </div>
      </div>

      {/* Integration Ideas */}
      <div className="surface p-6 rounded-xl md:rounded-none shadow-sm md:shadow-none">
        <h3 className="font-bold text-lg mb-4">Integration Ideas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium mb-2">📊 Google Sheets</p>
            <p className="text-xs text-text-muted">
              Export spending CSV and import into Google Sheets for custom analysis and reporting
            </p>
          </div>
          
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium mb-2">📧 Email Reports</p>
            <p className="text-xs text-text-muted">
              Use webhooks to send weekly/monthly financial summaries to your inbox
            </p>
          </div>
          
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium mb-2">💬 Slack/Discord</p>
            <p className="text-xs text-text-muted">
              Get notifications in your team chat when budgets are exceeded or goals are achieved
            </p>
          </div>
          
          <div className="p-4 bg-surface-hover rounded-lg">
            <p className="font-medium mb-2">📱 Mobile Apps</p>
            <p className="text-xs text-text-muted">
              Build custom mobile apps using the API to access your financial data on-the-go
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
