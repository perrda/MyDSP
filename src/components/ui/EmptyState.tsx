import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EmptyIllustration } from './EmptyIllustration'

interface EmptyStateProps {
  icon?: ReactNode
  /** When true, shows the shared EmptyIllustration geometric mark (accent). */
  illustration?: boolean
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

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const mark = illustration ? <EmptyIllustration /> : icon
  return (
    <div className="surface p-10 sm:p-12 md:p-16 text-center border border-border animate-fade-in">
      {mark && (
        <div className="flex justify-center mb-4">
          <div
            className={
              illustration
                ? 'text-accent opacity-90'
                : 'text-text-subtle opacity-40 text-6xl'
            }
          >
            {mark}
          </div>
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

export function EmptyStateInline({
  icon,
  illustration,
  message,
  action,
}: {
  icon?: ReactNode
  illustration?: boolean
  message: string
  action?: { label: string; onClick?: () => void; to?: string }
}) {
  const mark = illustration ? <EmptyIllustration className="w-12 h-12" /> : icon
  return (
    <div className="py-10 sm:py-12 text-center animate-fade-in px-4">
      {mark && (
        <div className="flex justify-center mb-3">
          <div
            className={
              illustration
                ? 'text-accent opacity-90'
                : 'text-text-subtle opacity-30 text-4xl'
            }
          >
            {mark}
          </div>
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
