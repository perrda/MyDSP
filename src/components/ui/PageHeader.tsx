import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 className="headline-md">
          {title.includes(' ') ? (
            <>
              {title.slice(0, title.lastIndexOf(' '))}{' '}
              <span className="gradient-text">{title.slice(title.lastIndexOf(' ') + 1)}</span>
            </>
          ) : (
            <span className="gradient-text">{title}</span>
          )}
        </h2>
        {description && (
          <p className="mt-3 text-sm sm:text-base text-text-muted font-light leading-relaxed max-w-xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 self-start sm:self-end">{action}</div>}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const valueClass =
    tone === 'positive'
      ? 'text-accent'
      : tone === 'negative'
        ? 'text-text-muted'
        : 'text-text'

  return (
    <div className="surface p-5 sm:p-6 lg:p-8 h-full min-w-0">
      <p className="label-uppercase mb-3 sm:mb-4">{label}</p>
      <p
        className={`text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums break-words ${valueClass}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-text-subtle font-light prose-card leading-snug">
          {hint}
        </p>
      )}
    </div>
  )
}
