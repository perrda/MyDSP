import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const BACK_CLASS =
  'inline-flex items-center gap-2 min-h-11 px-1 -ml-1 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-accent transition-colors'

type Common = {
  label: string
  className?: string
  /** Optional trailing content on the same row (e.g. RAG badge). */
  trailing?: ReactNode
}

type LinkProps = Common & { to: string; onClick?: never }
type ButtonProps = Common & { onClick: () => void; to?: never }

export type BackNavProps = LinkProps | ButtonProps

/**
 * Consistent “back to parent” control for detail views and filtered list states.
 * Use `to` for routes, or `onClick` for in-page state (e.g. clear a list filter).
 */
export function BackNav(props: BackNavProps) {
  const { label, className = '', trailing } = props
  const classes = `${BACK_CLASS} ${className}`.trim()

  const control =
    'to' in props && props.to ? (
      <Link to={props.to} className={classes}>
        <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
        {label}
      </Link>
    ) : (
      <button type="button" onClick={props.onClick} className={classes}>
        <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
        {label}
      </button>
    )

  if (!trailing) return control

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      {control}
      {trailing}
    </div>
  )
}
