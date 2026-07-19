import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

const WEBHOOK_URL_KEY = 'mydsp_webhook_url'

function buildSignedPing(portfolioIdHint: string) {
  const timestamp = new Date().toISOString()
  const nonce = crypto.randomUUID().slice(0, 8)
  // Local-only demo signature — not a real HMAC secret
  const signature = btoa(`mydsp:${timestamp}:${nonce}`).replace(/=+$/, '')
  return {
    event: 'mydsp.ping',
    timestamp,
    nonce,
    signature,
    portfolioHint: portfolioIdHint || 'local',
    meta: { version: '1.0', source: 'mydsp-api-automation' },
  }
}

export function ApiAutomationPage() {
  const { data, activeId } = usePortfolio()
  const { success, error: showError } = useToasts()

  const [copied, setCopied] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState(() => {
    try {
      return localStorage.getItem(WEBHOOK_URL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    try {
      if (webhookUrl.trim()) localStorage.setItem(WEBHOOK_URL_KEY, webhookUrl.trim())
      else localStorage.removeItem(WEBHOOK_URL_KEY)
    } catch {
      /* ignore */
    }
  }, [webhookUrl])

  const portfolioSnapshot = useMemo(() => exportPortfolioSummary(data), [data])
  const snapshotJson = useMemo(
    () => JSON.stringify(portfolioSnapshot, null, 2),
    [portfolioSnapshot],
  )

  const pingPayload = useMemo(() => buildSignedPing(activeId ?? 'local'), [activeId])
  const curlExample = useMemo(() => {
    const url = webhookUrl.trim() || 'https://example.com/hooks/mydsp'
    return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'X-MyDSP-Signature: ${pingPayload.signature}' \\\n  -d '${JSON.stringify(pingPayload)}'`
  }, [webhookUrl, pingPayload])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      success('Copied!', `${label} copied to clipboard`)
      setTimeout(() => setCopied(null), 2000)
    } catch {
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

  const testWebhookPayload = async () => {
    const url = webhookUrl.trim()
    const body = JSON.stringify(pingPayload)
    if (!url) {
      setWebhookStatus('Add a webhook URL, or copy the curl example below.')
      return
    }
    setTesting(true)
    setWebhookStatus(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MyDSP-Signature': pingPayload.signature,
        },
        body,
        mode: 'cors',
      })
      setWebhookStatus(
        res.ok
          ? `Posted ping — HTTP ${res.status}.`
          : `POST completed with HTTP ${res.status}. Check the receiver logs.`,
      )
    } catch (err) {
      setWebhookStatus(
        `Browser blocked or network failed (${err instanceof Error ? err.message : 'error'}). Use the curl example from a terminal instead.`,
      )
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Integration"
        title="API & Automation"
        description="Local-first export foundations: REST-shaped endpoints, portfolio JSON snapshot, and webhook ping testing."
      />

      <section className="surface p-6 mb-6" aria-labelledby="snapshot-heading">
        <h3 id="snapshot-heading" className="font-bold text-lg mb-2 flex items-center gap-2">
          <FileJson size={20} className="text-accent" aria-hidden />
          Portfolio snapshot
        </h3>
        <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
          Copy the current portfolio summary as JSON (same shape as{' '}
          <code className="text-accent">GET /api/v1/portfolio/summary</code>). Data stays in this
          browser — nothing is uploaded until you paste it elsewhere.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            className="btn-primary btn-sm inline-flex items-center gap-2"
            onClick={() => void copyToClipboard(snapshotJson, 'Portfolio snapshot')}
          >
            {copied === 'Portfolio snapshot' ? <Check size={14} /> : <Copy size={14} />}
            Copy JSON snapshot
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm inline-flex items-center gap-2"
            onClick={() => downloadFile(snapshotJson, 'portfolio-summary.json', 'application/json')}
          >
            <Download size={14} />
            Download JSON
          </button>
        </div>
        <pre className="p-3 bg-bg text-xs overflow-x-auto max-h-48 border border-border">
          {snapshotJson}
        </pre>
      </section>

      <section className="surface p-6 mb-6" aria-labelledby="export-heading">
        <h3 id="export-heading" className="font-bold text-lg mb-4 flex items-center gap-2">
          <Download size={20} className="text-accent" aria-hidden />
          Quick export
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
          <button
            type="button"
            onClick={() => handleExportJSON('summary')}
            className="flex items-center gap-3 p-4 bg-surface hover:bg-surface-hover transition-colors text-left"
          >
            <FileJson size={22} className="text-accent shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Portfolio summary</p>
              <p className="text-xs text-text-muted">Net worth, assets, liabilities (JSON)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExportJSON('spending')}
            className="flex items-center gap-3 p-4 bg-surface hover:bg-surface-hover transition-colors text-left"
          >
            <FileJson size={22} className="text-accent shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Spending transactions</p>
              <p className="text-xs text-text-muted">All transactions (JSON)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="flex items-center gap-3 p-4 bg-surface hover:bg-surface-hover transition-colors text-left"
          >
            <FileSpreadsheet size={22} className="text-accent shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Spending CSV</p>
              <p className="text-xs text-text-muted">Excel or Google Sheets</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExportJSON('goals')}
            className="flex items-center gap-3 p-4 bg-surface hover:bg-surface-hover transition-colors text-left"
          >
            <FileJson size={22} className="text-accent shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Goals progress</p>
              <p className="text-xs text-text-muted">Goals with progress (JSON)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExportJSON('budgets')}
            className="flex items-center gap-3 p-4 bg-surface hover:bg-surface-hover transition-colors text-left"
          >
            <FileJson size={22} className="text-accent shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Budget adherence</p>
              <p className="text-xs text-text-muted">Current month status (JSON)</p>
            </div>
          </button>
        </div>
      </section>

      <section className="surface p-6 mb-6" aria-labelledby="endpoints-heading">
        <h3 id="endpoints-heading" className="font-bold text-lg mb-4 flex items-center gap-2">
          <Code size={20} className="text-accent" aria-hidden />
          Documented REST-like endpoints
        </h3>

        <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
          Contract shapes for future remote access. Today these run locally via the export helpers
          above — there is no public authenticated API yet.
        </p>

        <div className="divide-y divide-border border border-border">
          {API_ENDPOINTS.map((endpoint, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`text-xs font-mono px-2 py-1 ${
                      endpoint.method === 'GET'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-emerald-500/15 text-emerald-600'
                    }`}
                  >
                    {endpoint.method}
                  </span>
                  <code className="text-sm">{endpoint.path}</code>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(endpoint.path, `Endpoint ${i}`)}
                  className="btn-ghost btn-sm"
                  aria-label={`Copy ${endpoint.path}`}
                >
                  {copied === `Endpoint ${i}` ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-sm text-text-muted mb-2">{endpoint.description}</p>

              {endpoint.params && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Parameters</p>
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
                    Example response
                  </summary>
                  <pre className="mt-2 p-2 bg-bg text-xs overflow-x-auto border border-border">
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
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          <Download size={16} />
          Download API documentation
        </button>
      </section>

      <section className="surface p-6 mb-6" aria-labelledby="webhook-heading">
        <h3 id="webhook-heading" className="font-bold text-lg mb-4 flex items-center gap-2">
          <Webhook size={20} className="text-accent" aria-hidden />
          Webhook URL
        </h3>

        <p className="text-sm text-text-muted font-light mb-4 max-w-2xl">
          Save a receiver URL in this browser, then post a signed-looking JSON ping. CORS may block
          browser POSTs — use the curl example when that happens.
        </p>

        <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
          Webhook URL
          <input
            type="url"
            className="mt-2 w-full max-w-xl"
            placeholder="https://hooks.example.com/mydsp"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="flex flex-wrap gap-2 mt-4 mb-4">
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={testing}
            onClick={() => void testWebhookPayload()}
            aria-busy={testing}
          >
            {testing ? 'Posting…' : 'Test payload'}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm inline-flex items-center gap-2"
            onClick={() => void copyToClipboard(curlExample, 'curl example')}
          >
            {copied === 'curl example' ? <Check size={14} /> : <Copy size={14} />}
            Copy curl
          </button>
        </div>

        {webhookStatus && (
          <p className="text-sm text-accent mb-4" role="status" aria-live="polite">
            {webhookStatus}
          </p>
        )}

        <p className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
          curl example
        </p>
        <pre className="p-3 bg-bg text-xs overflow-x-auto border border-border whitespace-pre-wrap">
          {curlExample}
        </pre>

        <ul className="mt-4 text-sm text-text-muted font-light space-y-1 max-w-2xl">
          <li>
            <code className="text-accent">goal.completed</code> — financial goal achieved
          </li>
          <li>
            <code className="text-accent">budget.exceeded</code> — spending over a budget limit
          </li>
          <li>
            <code className="text-accent">spending.anomaly</code> — unusual spending detected
          </li>
          <li>
            <code className="text-accent">net_worth.milestone</code> — net worth milestone
          </li>
        </ul>
      </section>

      <section className="surface p-6" aria-labelledby="ideas-heading">
        <h3 id="ideas-heading" className="font-bold text-lg mb-4">
          Integration ideas
        </h3>
        <ul className="text-sm text-text-muted font-light space-y-3 max-w-2xl list-disc pl-5">
          <li>
            <span className="text-text font-medium">Google Sheets</span> — export spending CSV and
            import for custom analysis
          </li>
          <li>
            <span className="text-text font-medium">Email reports</span> — pipe webhook pings into
            Zapier / Make for weekly summaries
          </li>
          <li>
            <span className="text-text font-medium">Slack / Discord</span> — notify when budgets are
            exceeded or goals are hit
          </li>
        </ul>
      </section>

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary API actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/settings" className="btn-secondary btn-sm">
          Settings
        </Link>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
