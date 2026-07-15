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
    <div className="surface p-6 sm:p-10 md:p-14 text-center border border-border animate-fade-in">
      {icon && (
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="text-text-subtle opacity-40 text-5xl sm:text-6xl">{icon}</div>
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed mb-5 sm:mb-6">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-3 justify-center">
          {action &&
            (action.to ? (
              <Link to={action.to} className="btn-primary btn-sm min-h-11">
                {action.label}
              </Link>
            ) : (
              <button type="button" className="btn-primary btn-sm min-h-11" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
          {secondaryAction &&
            (secondaryAction.to ? (
              <Link to={secondaryAction.to} className="btn-secondary btn-sm min-h-11">
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                className="btn-secondary btn-sm min-h-11"
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

export function EmptyStateInline({
  icon,
  message,
  action,
}: {
  icon?: ReactNode
  message: string
  action?: { label: string; onClick?: () => void; to?: string }
}) {
  return (
    <div className="py-10 sm:py-12 text-center animate-fade-in px-4">
      {icon && (
        <div className="flex justify-center mb-3">
          <div className="text-text-subtle opacity-30 text-4xl">{icon}</div>
        </div>
      )}
      <p className="text-sm text-text-muted mb-4">{message}</p>
      {action ? (
        action.to ? (
          <Link to={action.to} className="btn-secondary btn-sm">
            {action.label}
          </Link>
        ) : (
          <button type="button" className="btn-secondary btn-sm" onClick={action.onClick}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  )
}
