import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Shared-element style page enter: opacity + short slide on main route change.
 * CSS respects prefers-reduced-motion (animation disabled).
 */
export function PageRouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-route-transition">
      {children}
    </div>
  )
}
