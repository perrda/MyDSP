import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick?: () => void
    to?: string
  }
  secondaryAction?: {
    label: string
    onClick?: () => void
    to?: string
  }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="surface p-10 sm:p-12 md:p-16 text-center border border-border animate-fade-in">
      {icon && (
        <div className="flex justify-center mb-4">
          <div className="text-text-subtle opacity-40 text-6xl">{icon}</div>
        </div>
      )}
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed mb-6">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-3 justify-center">
          {action &&
            (action.to ? (
              <Link to={action.to} className="btn-primary btn-sm">
                {action.label}
              </Link>
            ) : (
              <button type="button" className="btn-primary btn-sm" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
          {secondaryAction &&
            (secondaryAction.to ? (
              <Link to={secondaryAction.to} className="btn-secondary btn-sm">
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export function EmptyStateInline({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="py-12 text-center animate-fade-in">
      {icon && (
        <div className="flex justify-center mb-3">
          <div className="text-text-subtle opacity-30 text-4xl">{icon}</div>
        </div>
      )}
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  )
}
