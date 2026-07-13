import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PortfolioProvider } from './context/PortfolioContext'
import { ToastProvider } from './components/ToastProvider'
import { logger } from './utils/logger'
import { registerServiceWorker } from './services/serviceWorker'
import { initializeSearchDB } from './services/search'

// Initialize logger
logger.info('Application starting', { 
  version: '0.13.0',
  environment: import.meta.env.MODE,
  timestamp: new Date().toISOString()
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
  logger.error('Uncaught error', event.error, 'app')
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', new Error(event.reason), 'app')
})

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <PortfolioProvider>
            <App />
          </PortfolioProvider>
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
  
  logger.info('Application mounted successfully')
}

// Initialize search database
initializeSearchDB().catch((error) => {
  logger.error('Failed to initialize search', error, 'app')
})

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch((error) => {
      logger.error('Failed to register service worker', error, 'app')
    })
  })
}
