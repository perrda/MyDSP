// Performance monitoring HOC for pages

import { type ComponentType, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { logger } from '../utils/logger'

export function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  pageName: string
) {
  return function PerformanceMonitoredComponent(props: P) {
    const location = useLocation()

    useEffect(() => {
      const startTime = performance.now()
      const markName = `page-render-${pageName}`
      
      performance.mark(`${markName}-start`)
      
      // Log page view
      logger.pageView(location.pathname, pageName)
      logger.info(`Rendering ${pageName}`, { path: location.pathname }, 'performance')

      return () => {
        const endTime = performance.now()
        const renderTime = endTime - startTime
        
        performance.mark(`${markName}-end`)
        performance.measure(markName, `${markName}-start`, `${markName}-end`)
        
        // Log performance metric
        logger.metric(`${pageName}-render-time`, renderTime, {
          unit: 'ms',
          path: location.pathname,
        })
        
        if (renderTime > 1000) {
          logger.warn(`Slow page render: ${pageName} took ${renderTime.toFixed(2)}ms`, undefined, 'performance')
        }
      }
    }, [location.pathname])

    return <Component {...props} />
  }
}

// Hook for tracking component-level performance
export function usePerformanceTracking(componentName: string, dependencies: any[] = []) {
  useEffect(() => {
    const startTime = performance.now()
    const stop = logger.startTimer(`component-${componentName}`)

    return () => {
      const duration = performance.now() - startTime
      stop()
      
      if (duration > 500) {
        logger.warn(`Slow component: ${componentName} took ${duration.toFixed(2)}ms`, undefined, 'performance')
      }
    }
  }, dependencies)
}

// Track user interactions
export function trackInteraction(actionName: string, metadata?: Record<string, any>) {
  logger.track(actionName, {
    timestamp: Date.now(),
    ...metadata,
  })
}

// Track API calls
export function trackApiCall(endpoint: string, method: string, duration: number, success: boolean) {
  logger.metric(`api-${method.toLowerCase()}-${endpoint}`, duration, {
    unit: 'ms',
    success,
  })
  
  if (!success || duration > 3000) {
    logger.warn(`Slow or failed API call: ${method} ${endpoint}`, { duration, success }, 'api')
  }
}
