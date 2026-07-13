import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({
      errorInfo: errorInfo.componentStack || 'No stack trace available',
    })

    // Log to external service if configured
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const log = {
          timestamp: new Date().toISOString(),
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        }
        const key = `mydsp_error_${Date.now()}`
        localStorage.setItem(key, JSON.stringify(log))
        
        // Keep only last 5 errors
        const errorKeys = Object.keys(localStorage).filter((k) => k.startsWith('mydsp_error_'))
        if (errorKeys.length > 5) {
          errorKeys
            .sort()
            .slice(0, -5)
            .forEach((k) => localStorage.removeItem(k))
        }
      }
    } catch {
      // Ignore logging errors
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
          <div className="max-w-2xl w-full">
            <div className="surface p-8 border-l-4 border-l-red-500">
              <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
              <p className="text-text-muted mb-6">
                MyDSP encountered an unexpected error. Your data is safe — portfolios are stored
                locally and not affected.
              </p>

              {this.state.error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-sm">
                  <p className="font-mono text-red-800 dark:text-red-200 mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-700 dark:text-red-300 hover:underline">
                        Stack trace
                      </summary>
                      <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-x-auto">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={this.handleReset} className="btn-primary">
                  Try again
                </button>
                <button type="button" onClick={this.handleReload} className="btn-secondary">
                  Reload app
                </button>
                <Link to="/" className="btn-ghost">
                  Go to dashboard
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-text-subtle">
                  If this error persists:{' '}
                  <Link to="/settings" className="text-accent hover:underline">
                    Export a backup
                  </Link>
                  , then try clearing browser data. Error logged locally for debugging.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
