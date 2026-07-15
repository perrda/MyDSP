// Error Boundary — branded MyDSP fallback

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../utils/logger'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { BrandMark } from './BrandMark'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React Error Boundary caught an error', error, 'ui')
    this.props.onError?.(error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    const base = typeof __BASE_PATH__ === 'string' ? __BASE_PATH__ : '/'
    window.location.assign(base === '/' ? '/' : base)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[100dvh] bg-bg flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md w-full border border-border-strong bg-bg-elevated p-8 sm:p-10">
            <div className="flex justify-center mb-6">
              <BrandMark size="md" />
            </div>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 border border-border-strong text-accent">
              <AlertTriangle className="w-6 h-6" strokeWidth={1.75} />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-text text-center mb-2">
              Something went wrong
            </h1>

            <p className="text-sm text-text-muted text-center mb-6 font-light leading-relaxed">
              Don&apos;t worry — your data stays on this device. Try again, or return to Overview.
            </p>

            {import.meta.env.DEV && this.state.error ? (
              <div className="mb-6 p-4 border border-border bg-surface overflow-auto max-h-40">
                <p className="text-xs font-mono text-accent mb-2">{this.state.error.toString()}</p>
                {this.state.errorInfo ? (
                  <pre className="text-[10px] text-text-subtle whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-primary flex-1 inline-flex items-center justify-center gap-2 min-h-12"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
                Try again
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 min-h-12"
              >
                <Home className="w-4 h-4" strokeWidth={1.75} />
                Go home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  return function ErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
