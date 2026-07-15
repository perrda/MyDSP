// Performance monitoring HOC for pages

import { type ComponentType, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { logger } from '../utils/logger'

export function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  pageName: string,
) {
  return function PerformanceMonitoredComponent(props: P) {
    const location = useLocation()

    useEffect(() => {
      const startTime = performance.now()
      const markName = `page-render-${pageName}`

      performance.mark(`${markName}-start`)
      logger.pageView(location.pathname, pageName)

      return () => {
        const endTime = performance.now()
        const renderTime = endTime - startTime

        performance.mark(`${markName}-end`)
        try {
          performance.measure(markName, `${markName}-start`, `${markName}-end`)
        } catch {
          /* mark missing */
        }

        logger.metric(`${pageName}-render-time`, renderTime, {
          unit: 'ms',
          path: location.pathname,
        })

        if (renderTime > 1000) {
          logger.warn(
            `Slow page render: ${pageName} took ${renderTime.toFixed(2)}ms`,
            undefined,
            'performance',
          )
        }
      }
    }, [location.pathname])

    return <Component {...props} />
  }
}
