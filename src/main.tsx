import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { logger } from './utils/logger'
import { registerServiceWorker } from './services/serviceWorker'
import { initializeSearchDB } from './services/search'

// Initialize logger
logger.info('Application starting', {
  version: '1.0.0',
  environment: import.meta.env.MODE,
  timestamp: new Date().toISOString(),
})

// Track performance
const appStartTime = performance.now()
window.addEventListener('load', () => {
  const loadTime = performance.now() - appStartTime
  logger.metric('app-load-time', loadTime, { unit: 'ms' })
})

// Track page views
logger.pageView(window.location.pathname, document.title)

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', event.error ?? new Error(String(event.message)), 'app')
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  logger.error('Unhandled promise rejection', reason, 'app')
})

const root = document.getElementById('root')
if (root) {
  // App owns all providers (Theme, Portfolio, Router, Toast, etc.)
  // Do not wrap with BrowserRouter/PortfolioProvider here — nested routers crash the app.
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  logger.info('Application mounted successfully')
}

// Initialize search database (non-blocking)
initializeSearchDB().catch((error) => {
  logger.error('Failed to initialize search', error instanceof Error ? error : new Error(String(error)), 'app')
})

// Register service worker only in production builds (not during local vite preview debugging)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch((error) => {
      logger.error(
        'Failed to register service worker',
        error instanceof Error ? error : new Error(String(error)),
        'app',
      )
    })
  })
}
